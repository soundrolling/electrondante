import { computed, unref } from 'vue'

/**
 * Cable-estimate compute core.
 *
 * Turns placed nodes + the signal-flow connections into a measured cable
 * estimate. Each `connections` row is treated as one physical cable run
 * between the two nodes it links; the run length comes from the on-floor-plan
 * distance between those nodes, scaled by a calibration.
 *
 * ⚠️ Coordinates (`node.x`, `node.y`) are normalized fractions of the
 * floor-plan image — x of the image *width*, y of the *height*. They are
 * therefore anisotropic: distance MUST be computed in image-pixel space using
 * the image's natural width/height, never on the raw 0..1 values. The scale is
 * likewise derived from the calibration line in pixel space, so the absolute
 * pixel resolution cancels out and only the image aspect ratio matters.
 *
 * Grouping follows the signal flow: a `transformer` ("stagebox") aggregates the
 * source mics wired into it, so its incoming source count is the channel count
 * that drives the suggested multicore size.
 */

// Standard multicore / sub-snake channel counts, ascending.
export const STANDARD_MULTICORE = [4, 8, 12, 16, 24, 32, 48]

const M_TO_FT = 3.280839895

const DEFAULT_OPTIONS = {
  slackFactor: 1.15,  // extra-slack multiplier (1.15 = +15%)
  roundStep: 5,       // round each run UP to the nearest multiple (display unit); 0 = off
  displayUnit: 'm',   // 'm' | 'ft'
}

function toMetres(value, unit) {
  return unit === 'ft' ? value / M_TO_FT : value
}
function fromMetres(metres, unit) {
  return unit === 'ft' ? metres * M_TO_FT : metres
}

/** Coarse node classification used for run categorisation + grouping. */
export function nodeKind(node) {
  const t = String(node?.gear_type || node?.node_type || node?.type || '').toLowerCase()
  if (t.includes('source')) return 'source'
  if (t.includes('recorder')) return 'recorder'
  if (t.includes('transformer')) return 'transformer'
  return 'other'
}

/** A node is measurable only once it has been placed on the floor plan. */
export function hasPosition(node) {
  if (!node) return false
  const { x, y } = node
  // Reject null/undefined/'' explicitly — Number(null) and Number('') are 0
  // (finite), which would otherwise pass an unplaced node as positioned.
  if (x == null || x === '' || y == null || y === '') return false
  return Number.isFinite(Number(x)) && Number.isFinite(Number(y))
}

/** Real-world elevation of a node above the floor, in metres (0 if unset). */
export function heightMetres(node) {
  const h = Number(node?.height_m)
  return Number.isFinite(h) ? h : 0
}

/**
 * A node's position for cabling, honouring a per-stage layout override if one
 * exists. Overrides live only in the cabling layout — the mic-map x/y is never
 * mutated. Falls back to the mic-map position.
 */
export function effectivePosition(node, layout) {
  const o = layout?.positions?.[node?.id]
  if (o && Number.isFinite(Number(o.x)) && Number.isFinite(Number(o.y))) {
    return { x: Number(o.x), y: Number(o.y) }
  }
  return { x: Number(node?.x), y: Number(node?.y) }
}

export function labelOf(node) {
  if (!node) return 'Unknown'
  return node.track_name || node.label || node.gear_name || `Node ${node.id}`
}

/** Smallest standard multicore that carries `channels`; multiples beyond the max. */
export function nearestMulticore(channels) {
  if (!channels || channels <= 0) return 0
  for (const size of STANDARD_MULTICORE) {
    if (channels <= size) return size
  }
  const max = STANDARD_MULTICORE[STANDARD_MULTICORE.length - 1]
  return Math.ceil(channels / max) * max
}

function categoryFor(fromKind, toKind) {
  if (fromKind === 'source' && toKind === 'transformer') return 'tail'   // mic → stagebox
  if (fromKind === 'source' && toKind === 'recorder') return 'direct'    // mic → recorder
  if (fromKind === 'transformer' && toKind === 'recorder') return 'trunk' // stagebox → recorder
  if (fromKind === 'transformer' && toKind === 'transformer') return 'link'
  return 'other'
}

/**
 * @param {object}   args
 * @param {Array}    args.nodes            node rows (must include x/y for measurable ones)
 * @param {Array}    args.connections      connection rows (from_node_id → to_node_id)
 * @param {object?}  args.calibration      { p1:{x,y}, p2:{x,y}, realLength, unit }
 * @param {object?}  args.imageNaturalSize { width, height } natural px of the floor-plan image
 * @param {object?}  args.options          { slackFactor, roundUpToStock, displayUnit }
 */
export function computeCableEstimate({
  nodes = [],
  connections = [],
  calibration = null,
  imageNaturalSize = null,
  layout = null,
  options = {},
} = {}) {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  const unit = opts.displayUnit === 'ft' ? 'ft' : 'm'

  const nodeById = new Map()
  for (const n of nodes) nodeById.set(n.id, n)

  // Derive scale (display-unit per pixel) from the calibration line. Needs the
  // image's natural size so the anisotropic x/y fractions resolve to real px.
  let metresPerPixel = null
  let calibrated = false
  if (
    calibration?.p1 && calibration?.p2 &&
    Number(calibration.realLength) > 0 &&
    imageNaturalSize?.width && imageNaturalSize?.height
  ) {
    const W = imageNaturalSize.width
    const H = imageNaturalSize.height
    const calPx = Math.hypot(
      (calibration.p2.x - calibration.p1.x) * W,
      (calibration.p2.y - calibration.p1.y) * H,
    )
    if (calPx > 0) {
      const realMetres = toMetres(Number(calibration.realLength), calibration.unit === 'ft' ? 'ft' : 'm')
      metresPerPixel = realMetres / calPx
      calibrated = true
    }
  }

  function pixelLength(a, b) {
    const W = imageNaturalSize?.width ?? 1
    const H = imageNaturalSize?.height ?? 1
    return Math.hypot((b.x - a.x) * W, (b.y - a.y) * H)
  }

  const runs = []
  const unmeasured = []
  const connectedNodeIds = new Set()

  for (const c of connections) {
    const from = nodeById.get(c.from_node_id)
    const to = nodeById.get(c.to_node_id)
    if (from) connectedNodeIds.add(from.id)
    if (to) connectedNodeIds.add(to.id)

    if (!from || !to || !hasPosition(from) || !hasPosition(to)) {
      unmeasured.push({
        connectionId: c.id,
        fromId: c.from_node_id,
        toId: c.to_node_id,
        fromLabel: labelOf(from),
        toLabel: labelOf(to),
        reason: (!from || !to) ? 'missing-node' : 'no-position',
      })
      continue
    }

    // Routed polyline: effective endpoints (cabling overrides, mic map
    // untouched) with any turning points between them.
    const effFrom = effectivePosition(from, layout)
    const effTo = effectivePosition(to, layout)
    const waypoints = (layout?.waypoints?.[c.id] || [])
      .filter(p => Number.isFinite(Number(p?.x)) && Number.isFinite(Number(p?.y)))
      .map(p => ({ x: Number(p.x), y: Number(p.y) }))
    const points = [effFrom, ...waypoints, effTo]

    // Horizontal path = sum of the routed segments; the vertical run
    // (|Δheight|, up/down a tower) is added once. Cable runs along structure,
    // not diagonally through the air.
    let px = 0
    for (let i = 0; i < points.length - 1; i++) px += pixelLength(points[i], points[i + 1])
    const horizontalMetres = metresPerPixel != null ? px * metresPerPixel : null
    const verticalMetres = Math.abs(heightMetres(from) - heightMetres(to))
    const totalMetres = horizontalMetres != null ? horizontalMetres + verticalMetres : null
    const rawLength = totalMetres != null ? fromMetres(totalMetres, unit) : null
    const slackLength = rawLength != null ? rawLength * opts.slackFactor : null
    const length = slackLength != null
      ? (opts.roundStep > 0 ? Math.ceil(slackLength / opts.roundStep) * opts.roundStep : slackLength)
      : null
    const fromKind = nodeKind(from)
    const toKind = nodeKind(to)

    runs.push({
      connectionId: c.id,
      fromId: from.id,
      toId: to.id,
      fromLabel: labelOf(from),
      toLabel: labelOf(to),
      fromKind,
      toKind,
      category: categoryFor(fromKind, toKind),
      cableType: layout?.cables?.[c.id]?.type || null,
      from: effFrom,
      to: effTo,
      points,
      waypointCount: waypoints.length,
      pixelLength: px,
      verticalLength: fromMetres(verticalMetres, unit),
      rawLength,
      length,
    })
  }

  // Per-stagebox (transformer) combinations: the mics wired into it define the
  // local multicore it needs; its run to a recorder is the trunk.
  const stageboxes = []
  for (const n of nodes) {
    if (nodeKind(n) !== 'transformer') continue
    const incomingSources = runs.filter(r => r.toId === n.id && r.fromKind === 'source')
    const trunkRun = runs.find(r => r.fromId === n.id && r.toKind === 'recorder')
    stageboxes.push({
      id: n.id,
      label: labelOf(n),
      micCount: incomingSources.length,
      suggestedMulticore: nearestMulticore(incomingSources.length),
      trunkLength: trunkRun ? trunkRun.length : null,
      hasPosition: hasPosition(n),
    })
  }

  // Source mics placed on the plan but not wired into anything.
  const unroutedMics = nodes
    .filter(n => nodeKind(n) === 'source' && hasPosition(n) && !connectedNodeIds.has(n.id))
    .map(n => ({ id: n.id, label: labelOf(n) }))

  // Totals.
  const byCategory = {}
  const byCableType = {}
  let totalLength = 0
  let longestRun = 0
  let measuredRuns = 0
  let totalVertical = 0
  for (const r of runs) {
    const cat = (byCategory[r.category] ||= { count: 0, length: 0 })
    cat.count += 1
    if (r.length != null) {
      cat.length += r.length
      totalLength += r.length
      measuredRuns += 1
      if (r.length > longestRun) longestRun = r.length
      if (r.verticalLength) totalVertical += r.verticalLength
    }
    if (r.cableType) {
      const ct = (byCableType[r.cableType] ||= { count: 0, length: 0 })
      ct.count += 1
      if (r.length != null) ct.length += r.length
    }
  }
  const elevatedNodeCount = nodes.filter(node => heightMetres(node) > 0).length

  const xlrTails = runs.filter(r => r.fromKind === 'source').length
  const multicoreSummary = {}
  for (const sb of stageboxes) {
    if (sb.suggestedMulticore > 0) {
      multicoreSummary[sb.suggestedMulticore] = (multicoreSummary[sb.suggestedMulticore] || 0) + 1
    }
  }

  return {
    unit,
    calibrated,
    slackFactor: opts.slackFactor,
    roundStep: opts.roundStep,
    metresPerPixel,
    runs,
    stageboxes,
    unmeasured,
    unroutedMics,
    totals: {
      totalRuns: runs.length,
      measuredRuns,
      totalLength,
      longestRun,
      totalVertical,
      elevatedNodeCount,
      xlrTails,
      totalChannels: xlrTails,
      byCategory,
      byCableType,
      multicoreSummary,
      unmeasuredCount: unmeasured.length,
      unroutedMicCount: unroutedMics.length,
    },
  }
}

/**
 * Reactive wrapper. Pass refs/getters; returns a computed estimate that
 * recomputes when nodes, connections, calibration, image size or options change.
 */
export function useCableEstimate({ nodes, connections, calibration, imageNaturalSize, layout, options }) {
  return computed(() => computeCableEstimate({
    nodes: unref(nodes) || [],
    connections: unref(connections) || [],
    calibration: unref(calibration) || null,
    imageNaturalSize: unref(imageNaturalSize) || null,
    layout: unref(layout) || null,
    options: unref(options) || {},
  }))
}
