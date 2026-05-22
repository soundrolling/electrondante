// src/services/signalGraph.js
import { supabase } from '../supabase'
import { getNodes, getConnections } from './signalMapperService'
import { getCached, setCached, invalidateTableCache } from './cacheService'

// Build an in-memory graph snapshot for a project.
// Returns { nodes, nodeMap, connections, mapsByConnId, parentsByToNode }
export async function buildGraph(projectId, locationId = null, stageHourId = null) {
  // Include locationId and stageHourId in cache key to avoid cross-contamination
  const cacheKey = `graph:${projectId}:${locationId || 'all'}:${stageHourId || 'all'}`
  
  // Check cache first
  const cached = getCached(cacheKey)
  if (cached !== null) {
    return cached
  }
  
  // Fetch nodes and connections (these are already cached individually)
  const nodes = await getNodes(projectId, locationId, stageHourId)
  const connections = await getConnections(projectId, locationId, stageHourId)

  // Cache port maps separately
  const connIds = connections.map(c => c.id)
  let allPortMaps = []
  if (connIds.length) {
    const portMapCacheKey = `port_maps:${projectId}:${connIds.sort().join(',')}`
    const cachedPortMaps = getCached(portMapCacheKey)
    
    if (cachedPortMaps !== null) {
      allPortMaps = cachedPortMaps
    } else {
      try {
        const { data } = await supabase
          .from('connection_port_map')
          .select('connection_id, from_port, to_port')
          .in('connection_id', connIds)
        allPortMaps = data || []
        // Cache port maps for 30 seconds
        setCached(portMapCacheKey, allPortMaps, 30000)
      } catch {
        allPortMaps = []
      }
    }
  }

  const mapsByConnId = allPortMaps.reduce((acc, m) => {
    ;(acc[m.connection_id] = acc[m.connection_id] || []).push(m)
    return acc
  }, {})

  const parentsByToNode = connections.reduce((acc, c) => {
    ;(acc[c.to_node_id] = acc[c.to_node_id] || []).push(c)
    return acc
  }, {})

  const nodeMap = {}
  nodes.forEach(n => { nodeMap[n.id] = n })

  const graph = { nodes, nodeMap, connections, mapsByConnId, parentsByToNode }
  
  // Cache the complete graph for 30 seconds
  setCached(cacheKey, graph, 30000)
  
  return graph
}

export function getParents(graph, toNodeId) {
  return graph.parentsByToNode[toNodeId] || []
}

export function getPortMaps(graph, connectionId) {
  return graph.mapsByConnId[connectionId] || []
}

export function getNodeType(node) {
  return (node?.gear_type || node?.node_type || node?.type || '').toLowerCase()
}

// Detect transformer nodes that should behave as transparent network hubs
// (network switches like Netgear). Hubs pass signals through transparently,
// without a strict 1:1 input→output port mapping.
const HUB_NAME_PATTERN = /\b(netgear|switch|hub|cisco|d-link|tp-?link|unifi|ubiquiti|router)\b/i
export function isHubTransformer(node, gearName = null) {
  if (!node) return false
  if (getNodeType(node) !== 'transformer') return false
  if (node.is_hub === true) return true
  const label = String(node.label || node.track_name || '')
  const gear = String(gearName || node.gear_name || '')
  return HUB_NAME_PATTERN.test(label) || HUB_NAME_PATTERN.test(gear)
}

// Compute the effective channel capacity for a transformer acting as a hub.
// A network switch is transparent: when multiple sources feed into it, all of
// their channels become available on the output side. The transformer's
// physical port count is the floor — actual capacity grows with what's
// connected so multiple stageboxes can share one switch without colliding.
export function effectiveTransformerChannelCount(transformer, allConnections, portMapsByConnId, nodes) {
  if (!transformer) return 0
  const phys = Number(
    transformer.num_outputs || transformer.numoutputs ||
    transformer.num_inputs || transformer.numinputs ||
    transformer.outputs || transformer.inputs || 0
  ) || 0

  let maxClaimed = 0
  let sumOfParentChannels = 0

  const incoming = (allConnections || []).filter(c =>
    (c.to_node_id === transformer.id) || (c.to === transformer.id)
  )

  for (const conn of incoming) {
    const maps = (portMapsByConnId && portMapsByConnId[conn.id]) || []
    for (const m of maps) {
      const slot = Number(m.to_port) || 0
      if (slot > maxClaimed) maxClaimed = slot
    }
    const inputNum = Number(conn.input_number) || 0
    if (inputNum > maxClaimed) maxClaimed = inputNum

    if (nodes && nodes.length) {
      const parent = nodes.find(n => n.id === (conn.from_node_id || conn.from))
      if (parent) {
        const out = Number(
          parent.num_outputs || parent.numoutputs || parent.outputs ||
          parent.num_tracks || parent.tracks || parent.num_records || parent.numrecord || 0
        ) || 0
        sumOfParentChannels += out
      }
    }
  }

  return Math.max(phys, maxClaimed, sumOfParentChannels)
}


