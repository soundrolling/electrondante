// src/services/signalGraph.js
import { supabase } from '../supabase'
import { getNodes, getConnections } from './signalMapperService'

// Build an in-memory graph snapshot for a project.
// Returns { nodes, nodeMap, connections, mapsByConnId, parentsByToNode }
export async function buildGraph(projectId) {
  const nodes = await getNodes(projectId)
  const connections = await getConnections(projectId)

  const connIds = connections.map(c => c.id)
  let allPortMaps = []
  if (connIds.length) {
    try {
      const { data } = await supabase
        .from('connection_port_map')
        .select('connection_id, from_port, to_port')
        .in('connection_id', connIds)
      allPortMaps = data || []
    } catch {
      allPortMaps = []
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

  return { nodes, nodeMap, connections, mapsByConnId, parentsByToNode }
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


