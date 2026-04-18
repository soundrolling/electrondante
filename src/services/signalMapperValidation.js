/**
 * signalMapperValidation.js
 *
 * Pure-function validator for a single recording day's Signal Mapper state.
 * Given the parent's allNodes / allConnections / signalPaths it returns a
 * flat list of actionable warnings grouped by severity + tab. No side effects.
 *
 * Warning shape:
 *   {
 *     id:        string                  // stable per recording day
 *     severity:  'error' | 'warning' | 'info'
 *     tab:       'placement' | 'flow' | 'tracklist'
 *     title:     string                  // short, actionable
 *     detail:    string                  // one-line explanation
 *     target?:   { nodeId?, connectionId?, trackId? }  // for future highlight
 *   }
 */

const SOURCE_TYPES = new Set(['source'])
const RECORDER_TYPES = new Set(['recorder', 'tracks', 'track'])

function isSourceNode(n) {
  return (
    SOURCE_TYPES.has(String(n.gear_type || '').toLowerCase()) ||
    SOURCE_TYPES.has(String(n.node_type || '').toLowerCase())
  )
}

function isRecorderNode(n) {
  const g = String(n.gear_type || '').toLowerCase()
  const t = String(n.node_type || '').toLowerCase()
  return RECORDER_TYPES.has(g) || RECORDER_TYPES.has(t) || g.includes('recorder') || t.includes('recorder')
}

function nodeLabel(n) {
  return (
    n.track_name ||
    n.label ||
    n.display_name ||
    n.gear_name ||
    n.gear_label ||
    n.name ||
    `Node ${String(n.id || '').slice(0, 6)}`
  )
}

export function computeWarnings({ nodes = [], connections = [], signalPaths = [] } = {}) {
  const warnings = []
  const push = (w) => warnings.push(w)

  // Index connections by from/to node id for quick lookups
  const outByFrom = new Map()
  const inByTo = new Map()
  for (const c of connections) {
    if (!c || !c.from_node_id || !c.to_node_id) continue
    if (!outByFrom.has(c.from_node_id)) outByFrom.set(c.from_node_id, [])
    outByFrom.get(c.from_node_id).push(c)
    if (!inByTo.has(c.to_node_id)) inByTo.set(c.to_node_id, [])
    inByTo.get(c.to_node_id).push(c)
  }

  // ── 1. Unrouted mic (source with no outgoing connection) ──
  for (const n of nodes) {
    if (!isSourceNode(n)) continue
    const outs = outByFrom.get(n.id) || []
    if (!outs.length) {
      push({
        id: `unrouted-source-${n.id}`,
        severity: 'error',
        tab: 'flow',
        title: `${nodeLabel(n)} has no signal path`,
        detail: 'This mic source is placed but not connected to any stagebox or recorder.',
        target: { nodeId: n.id },
      })
    }
  }

  // ── 2. Recorder with no inputs ──
  for (const n of nodes) {
    if (!isRecorderNode(n)) continue
    const ins = inByTo.get(n.id) || []
    if (!ins.length) {
      push({
        id: `dead-recorder-${n.id}`,
        severity: 'warning',
        tab: 'flow',
        title: `${nodeLabel(n)} has no incoming feed`,
        detail: 'No connections reach this recorder — its tracks will not record anything.',
        target: { nodeId: n.id },
      })
    }
  }

  // ── 3. Fully orphaned intermediate nodes (not source or recorder, no in + no out) ──
  for (const n of nodes) {
    if (isSourceNode(n) || isRecorderNode(n)) continue
    const outs = outByFrom.get(n.id) || []
    const ins = inByTo.get(n.id) || []
    if (!outs.length && !ins.length) {
      push({
        id: `orphan-node-${n.id}`,
        severity: 'info',
        tab: 'flow',
        title: `${nodeLabel(n)} is unused`,
        detail: 'This gear node has no connections in or out. Consider removing it or wiring it up.',
        target: { nodeId: n.id },
      })
    }
  }

  // ── 4. Track list issues ──
  const perRecorder = new Map() // recorder_label -> { byNumber: Map<string, count> }
  const getRecorderMap = (label) => {
    if (!perRecorder.has(label)) perRecorder.set(label, new Map())
    return perRecorder.get(label)
  }

  for (const p of signalPaths) {
    const recorderName = p.recorder_label || 'Unknown recorder'
    const trackNum = String(p.track_number ?? '').trim()
    const trackName = String(p.track_name || '').trim()
    const sourceLabel = String(p.source_label || p.source_gear_name || '').trim()
    const trackKey = `${recorderName}::${trackNum || '_'}::${trackName || sourceLabel || '_'}`

    // Missing track name
    if (!trackName && !sourceLabel) {
      push({
        id: `missing-trackname-${trackKey}`,
        severity: 'warning',
        tab: 'tracklist',
        title: `Track ${trackNum || '?'} on ${recorderName} has no name`,
        detail: 'Name the source so the recorded file is easy to identify afterwards.',
        target: { connectionId: p.connection_id, trackId: trackKey },
      })
    }

    // Missing recorder label
    if (!p.recorder_label) {
      push({
        id: `missing-recorder-${trackKey}`,
        severity: 'warning',
        tab: 'flow',
        title: `Track "${trackName || sourceLabel || 'unnamed'}" has no recorder`,
        detail: 'The signal path does not resolve to a recorder. Double-check the routing.',
        target: { connectionId: p.connection_id, trackId: trackKey },
      })
    }

    // Duplicate track number per recorder
    if (trackNum) {
      const mapForRec = getRecorderMap(recorderName)
      mapForRec.set(trackNum, (mapForRec.get(trackNum) || 0) + 1)
    }
  }

  // Emit duplicate-track-number warnings (one per recorder per duplicated number)
  for (const [recorderName, byNumber] of perRecorder) {
    for (const [num, count] of byNumber) {
      if (count > 1) {
        push({
          id: `dup-track-${recorderName}-${num}`,
          severity: 'error',
          tab: 'tracklist',
          title: `Track ${num} is used ${count}× on ${recorderName}`,
          detail: 'Two or more connections are routed to the same recorder track. Only one will land.',
          target: { trackId: `${recorderName}::${num}` },
        })
      }
    }
  }

  // ── 5. Empty-state hints (only when nothing else is wrong) ──
  const hasSources = nodes.some(isSourceNode)
  const hasRecorders = nodes.some(isRecorderNode)

  if (!hasSources) {
    push({
      id: 'empty-no-sources',
      severity: 'info',
      tab: 'placement',
      title: 'No mics placed yet',
      detail: 'Add microphones on the Mic Placement tab to start building the signal chain.',
    })
  }
  if (hasSources && !hasRecorders) {
    push({
      id: 'empty-no-recorders',
      severity: 'info',
      tab: 'flow',
      title: 'No recorders in the signal flow',
      detail: 'Add a recorder on the Signal Flow tab so your mics have somewhere to land.',
    })
  }
  if (hasSources && hasRecorders && connections.length === 0) {
    push({
      id: 'empty-no-connections',
      severity: 'warning',
      tab: 'flow',
      title: 'Nothing is wired up',
      detail: 'You have mics and recorders but no connections between them yet.',
    })
  }

  return warnings
}

/**
 * Quick summary of warning counts by severity for badge rendering.
 */
export function warningsSummary(warnings) {
  const out = { total: warnings.length, error: 0, warning: 0, info: 0 }
  for (const w of warnings) {
    if (w.severity in out) out[w.severity] += 1
  }
  return out
}

/**
 * Severity level for the headline badge (highest wins).
 */
export function topSeverity(warnings) {
  if (warnings.some(w => w.severity === 'error')) return 'error'
  if (warnings.some(w => w.severity === 'warning')) return 'warning'
  if (warnings.length) return 'info'
  return null
}
