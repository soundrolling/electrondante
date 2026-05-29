import { describe, it, expect } from 'vitest'
import {
  computeCableEstimate,
  nearestMulticore,
  nodeKind,
  hasPosition,
} from './useCableEstimate'

// A 2:1 floor plan makes the anisotropy explicit: the same fractional delta
// resolves to twice the real distance horizontally as vertically.
const IMG = { width: 2000, height: 1000 }

// Horizontal calibration line spanning half the width = 10 m.
//   half width = 0.5 * 2000 = 1000 px  ->  0.01 m/px
const CAL = { p1: { x: 0, y: 0.5 }, p2: { x: 0.5, y: 0.5 }, realLength: 10, unit: 'm' }

// Exact-metres options: no slack, no rounding.
const EXACT = { slackFactor: 1, roundStep: 0, displayUnit: 'm' }

function n(id, kind, x, y, extra = {}) {
  return { id, gear_type: kind, x, y, label: `${kind}-${id}`, ...extra }
}
function conn(id, from, to) {
  return { id, from_node_id: from, to_node_id: to }
}

describe('helpers', () => {
  it('classifies node kinds from gear_type/type', () => {
    expect(nodeKind({ gear_type: 'source' })).toBe('source')
    expect(nodeKind({ gear_type: 'transformer' })).toBe('transformer')
    expect(nodeKind({ type: 'recorder' })).toBe('recorder')
    expect(nodeKind({ gear_type: 'mystery' })).toBe('other')
  })

  it('treats only nodes with finite x/y as positioned', () => {
    expect(hasPosition({ x: 0.1, y: 0.2 })).toBe(true)
    expect(hasPosition({ x: null, y: 0.2 })).toBe(false)
    expect(hasPosition({})).toBe(false)
  })

  it('rounds channel counts up to the nearest standard multicore', () => {
    expect(nearestMulticore(1)).toBe(4)
    expect(nearestMulticore(12)).toBe(12)
    expect(nearestMulticore(13)).toBe(16)
    expect(nearestMulticore(0)).toBe(0)
    expect(nearestMulticore(50)).toBe(96) // beyond 48 -> next multiple of 48
  })
})

describe('computeCableEstimate — distances respect image anisotropy', () => {
  const nodes = [
    n('mic', 'source', 0, 0),
    n('box', 'transformer', 0.5, 0),
    n('rec', 'recorder', 0.5, 0.5),
  ]
  const connections = [
    conn('c1', 'mic', 'box'), // horizontal: Δx=0.5 of width -> 1000px -> 10 m
    conn('c2', 'box', 'rec'), // vertical:   Δy=0.5 of height -> 500px -> 5 m
  ]
  const est = computeCableEstimate({ nodes, connections, calibration: CAL, imageNaturalSize: IMG, options: EXACT })

  it('is calibrated and produces a run per connection', () => {
    expect(est.calibrated).toBe(true)
    expect(est.runs).toHaveLength(2)
    expect(est.unmeasured).toHaveLength(0)
  })

  it('measures the horizontal tail at 10 m and the vertical trunk at 5 m', () => {
    const tail = est.runs.find(r => r.connectionId === 'c1')
    const trunk = est.runs.find(r => r.connectionId === 'c2')
    expect(tail.category).toBe('tail')
    expect(trunk.category).toBe('trunk')
    expect(tail.length).toBeCloseTo(10, 6)
    expect(trunk.length).toBeCloseTo(5, 6)
  })

  it('rolls up totals and the longest run', () => {
    expect(est.totals.totalLength).toBeCloseTo(15, 6)
    expect(est.totals.longestRun).toBeCloseTo(10, 6)
    expect(est.totals.xlrTails).toBe(1) // one source-originating run
  })
})

describe('computeCableEstimate — per-stagebox combinations', () => {
  it('sizes the multicore from the number of mics wired into the stagebox', () => {
    const nodes = [n('box', 'transformer', 0.5, 0.5), n('rec', 'recorder', 0.9, 0.5)]
    const connections = [conn('trunk', 'box', 'rec')]
    for (let i = 0; i < 12; i++) {
      nodes.push(n(`m${i}`, 'source', 0.1, i / 24))
      connections.push(conn(`t${i}`, `m${i}`, 'box'))
    }
    const est = computeCableEstimate({ nodes, connections, calibration: CAL, imageNaturalSize: IMG, options: EXACT })
    const box = est.stageboxes.find(s => s.id === 'box')
    expect(box.micCount).toBe(12)
    expect(box.suggestedMulticore).toBe(12)
    expect(box.trunkLength).not.toBeNull()
    expect(est.totals.multicoreSummary).toEqual({ 12: 1 })

    // 13th mic should bump the suggestion to a 16-way.
    nodes.push(n('m12', 'source', 0.1, 0.6))
    connections.push(conn('t12', 'm12', 'box'))
    const est2 = computeCableEstimate({ nodes, connections, calibration: CAL, imageNaturalSize: IMG, options: EXACT })
    expect(est2.stageboxes.find(s => s.id === 'box').suggestedMulticore).toBe(16)
  })
})

describe('computeCableEstimate — edge cases', () => {
  it('lists runs as unmeasured when an endpoint has no position', () => {
    const nodes = [n('mic', 'source', 0.1, 0.1), { id: 'box', gear_type: 'transformer' }]
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: EXACT,
    })
    expect(est.runs).toHaveLength(0)
    expect(est.unmeasured).toHaveLength(1)
    expect(est.unmeasured[0].reason).toBe('no-position')
  })

  it('flags source mics placed but not wired into anything', () => {
    const nodes = [n('mic', 'source', 0.1, 0.1), n('lonely', 'source', 0.2, 0.2), n('box', 'transformer', 0.5, 0.5)]
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: EXACT,
    })
    expect(est.unroutedMics.map(m => m.id)).toEqual(['lonely'])
  })

  it('still reports counts/combinations without a calibration (no lengths)', () => {
    const nodes = [n('mic', 'source', 0, 0), n('box', 'transformer', 0.5, 0)]
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: null,
      imageNaturalSize: IMG,
      options: EXACT,
    })
    expect(est.calibrated).toBe(false)
    expect(est.runs[0].length).toBeNull()
    expect(est.totals.totalLength).toBe(0)
    expect(est.stageboxes[0].suggestedMulticore).toBe(4) // grouping still works
  })

  it('applies slack then rounds up to the nearest step', () => {
    const nodes = [n('mic', 'source', 0, 0), n('box', 'transformer', 0.5, 0)] // raw 10 m
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: { slackFactor: 1.15, roundStep: 5, displayUnit: 'm' },
    })
    // 10 m * 1.15 = 11.5 m -> ceil to nearest 5 m = 15 m
    expect(est.runs[0].rawLength).toBeCloseTo(10, 6)
    expect(est.runs[0].length).toBe(15)
  })

  it('rounds up to a custom step (e.g. 2 m)', () => {
    const nodes = [n('mic', 'source', 0, 0), n('box', 'transformer', 0.5, 0)] // raw 10 m
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: { slackFactor: 1, roundStep: 2, displayUnit: 'm' },
    })
    // 10 m -> ceil to nearest 2 m = 10 m (already a multiple); 10.1 would be 12
    expect(est.runs[0].length).toBe(10)
  })

  it('converts lengths to feet when displayUnit is ft', () => {
    const nodes = [n('mic', 'source', 0, 0), n('box', 'transformer', 0.5, 0)] // 10 m
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: { slackFactor: 1, roundStep: 0, displayUnit: 'ft' },
    })
    expect(est.unit).toBe('ft')
    expect(est.runs[0].length).toBeCloseTo(32.8084, 3)
  })
})

describe('computeCableEstimate — mic height (towers)', () => {
  it('adds the vertical run for an elevated mic', () => {
    const nodes = [
      n('mic', 'source', 0, 0, { height_m: 8 }), // 8 m up a tower
      n('box', 'transformer', 0.5, 0),           // 10 m horizontal away, on the ground
    ]
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: EXACT,
    })
    expect(est.runs[0].verticalLength).toBeCloseTo(8, 6)
    expect(est.runs[0].length).toBeCloseTo(18, 6) // 10 horizontal + 8 vertical
    expect(est.totals.totalVertical).toBeCloseTo(8, 6)
    expect(est.totals.elevatedNodeCount).toBe(1)
  })

  it('uses the height difference when both ends are elevated', () => {
    const nodes = [
      n('mic', 'source', 0, 0, { height_m: 10 }),
      n('box', 'transformer', 0.5, 0, { height_m: 4 }),
    ]
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      options: EXACT,
    })
    expect(est.runs[0].verticalLength).toBeCloseTo(6, 6) // |10 - 4|
    expect(est.runs[0].length).toBeCloseTo(16, 6)        // 10 + 6
  })
})

describe('computeCableEstimate — cabling layout (overrides + waypoints)', () => {
  const nodes = [n('mic', 'source', 0, 0), n('box', 'transformer', 0.5, 0)] // straight = 10 m

  it('uses an override position without touching the mic-map coords', () => {
    const layout = { positions: { box: { x: 0.25, y: 0 } } } // box dragged to 5 m away
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      layout,
      options: EXACT,
    })
    expect(est.runs[0].to).toEqual({ x: 0.25, y: 0 })
    expect(est.runs[0].length).toBeCloseTo(5, 6) // 0.25 * 2000px * 0.01 m/px
    // Original node object is untouched.
    expect(nodes.find(x => x.id === 'box').x).toBe(0.5)
  })

  it('routes through waypoints and sums the polyline segments', () => {
    const layout = { waypoints: { c: [{ x: 0.25, y: 0.25 }] } } // detour
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      layout,
      options: EXACT,
    })
    const run = est.runs[0]
    expect(run.points).toHaveLength(3) // from + 1 waypoint + to
    expect(run.waypointCount).toBe(1)
    // 2 × hypot(500px, 250px) = 2 × 559.017 px = 1118.034 px × 0.01 = 11.180 m
    expect(run.length).toBeCloseTo(11.1803, 3)
  })

  it('ignores malformed waypoints', () => {
    const layout = { waypoints: { c: [{ x: 'oops' }, { x: 0.25, y: 0.25 }, null] } }
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      layout,
      options: EXACT,
    })
    expect(est.runs[0].waypointCount).toBe(1)
  })

  it('tags runs with their assigned cable type and groups by it', () => {
    const layout = { cables: { c: { type: 'XLR' } } }
    const est = computeCableEstimate({
      nodes,
      connections: [conn('c', 'mic', 'box')],
      calibration: CAL,
      imageNaturalSize: IMG,
      layout,
      options: EXACT,
    })
    expect(est.runs[0].cableType).toBe('XLR')
    expect(est.totals.byCableType.XLR.count).toBe(1)
    expect(est.totals.byCableType.XLR.length).toBeCloseTo(10, 6)
  })
})
