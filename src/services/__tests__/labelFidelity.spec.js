/*
  Unit tests for label fidelity across venue_sources, transformer chains,
  and recorder paths. Uses Jest-style syntax.
*/

jest.mock('../../supabase', () => {
  return {
    supabase: {
      from: jest.fn(() => ({ select: jest.fn().mockReturnThis(), eq: jest.fn().mockReturnThis(), in: jest.fn().mockReturnThis(), maybeSingle: jest.fn(), then: jest.fn() }))
    }
  }
})

import { getOutputLabel, resolveTransformerInputLabel } from '../portLabelService'

function makeGraph(nodes, connections, maps) {
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]))
  const parentsByToNode = {}
  connections.forEach(c => {
    (parentsByToNode[c.to_node_id] = parentsByToNode[c.to_node_id] || []).push(c)
  })
  const mapsByConnId = {}
  ;(maps || []).forEach(m => {
    (mapsByConnId[m.connection_id] = mapsByConnId[m.connection_id] || []).push(m)
  })
  return { nodes, nodeMap, connections, parentsByToNode, mapsByConnId }
}

describe('Label fidelity', () => {
  test('venue_sources uses node.output_port_labels when present', async () => {
    const venue = { id: 'vs1', gear_type: 'venue_sources', num_outputs: 2, output_port_labels: { '1': 'DJA L', '2': 'DJA R' } }
    const graph = makeGraph([venue], [], [])
    await expect(getOutputLabel(venue, 1, graph)).resolves.toBe('DJA L')
    await expect(getOutputLabel(venue, 2, graph)).resolves.toBe('DJA R')
  })

  test('transformer chain with port map prefers mapped from_port labels', async () => {
    const src = { id: 's1', gear_type: 'source', num_outputs: 2, label: 'Stage (1)', track_name: 'Stage LR (1)' }
    const xfr = { id: 't1', gear_type: 'transformer', num_inputs: 2, num_outputs: 2, label: 'Mixer' }
    const conn = { id: 'c1', from_node_id: src.id, to_node_id: xfr.id }
    const maps = [ { connection_id: 'c1', from_port: 2, to_port: 1 } ] // map R->Input1
    const graph = makeGraph([src, xfr], [conn], maps)
    // Transformer input 1 should resolve to source port 2 (R)
    await expect(resolveTransformerInputLabel(xfr, 1, graph)).resolves.toContain('R')
  })

  test('recorder track naming path uses final source label (no Output N)', async () => {
    const venue = { id: 'vs2', gear_type: 'venue_sources', num_outputs: 1, output_port_labels: { '1': 'HH1' } }
    const xfr = { id: 't2', gear_type: 'transformer', num_inputs: 1, num_outputs: 1, label: 'Submix' }
    const rec = { id: 'r1', gear_type: 'recorder', num_inputs: 1, num_tracks: 1, label: 'Recorder' }
    const c1 = { id: 'cx', from_node_id: venue.id, to_node_id: xfr.id, input_number: 1 }
    const c2 = { id: 'cr', from_node_id: xfr.id, to_node_id: rec.id, input_number: 1 }
    const graph = makeGraph([venue, xfr, rec], [c1, c2], [])
    // Transformer input 1 should resolve to HH1, not Output 1
    await expect(resolveTransformerInputLabel(xfr, 1, graph)).resolves.toBe('HH1')
  })
})


