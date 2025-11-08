// src/services/signalGraph.js
import { supabase } from '../supabase'
import { getNodes, getConnections } from './signalMapperService'
import { getCached, setCached, invalidateTableCache } from './cacheService'

// Build an in-memory graph snapshot for a project.
// Returns { nodes, nodeMap, connections, mapsByConnId, parentsByToNode }
export async function buildGraph(projectId, locationId = null) {
  // Include locationId in cache key to avoid cross-contamination
  const cacheKey = `graph:${projectId}:${locationId || 'all'}`
  
  // Check cache first
  const cached = getCached(cacheKey)
  if (cached !== null) {
    return cached
  }
  
  // Fetch nodes and connections (these are already cached individually)
  const nodes = await getNodes(projectId, locationId)
  const connections = await getConnections(projectId, locationId)

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


