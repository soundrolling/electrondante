// src/services/signalMapperService.js
import { supabase } from '../supabase'

// --- CRUD for Nodes ---
export async function getNodes(projectId) {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return data
}

export async function addNode(node) {
  const { data, error } = await supabase
    .from('nodes')
    .insert([node])
    .select()
  if (error) throw error
  return data[0]
}

export async function updateNode(node) {
  const { id, ...fields } = node
  const { data, error } = await supabase
    .from('nodes')
    .update(fields)
    .eq('id', id)
    .select()
  if (error) throw error
  return data[0]
}

export async function deleteNode(id) {
  const { error } = await supabase
    .from('nodes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// --- CRUD for Connections ---
export async function getConnections(projectId) {
  const { data, error } = await supabase
    .from('connections')
    .select('*')
    .eq('project_id', projectId)
  if (error) throw error
  return data
}

export async function addConnection(connection) {
  const { data, error } = await supabase
    .from('connections')
    .insert([connection])
    .select()
  if (error) throw error
  return data[0]
}

export async function updateConnection(connection) {
  const { id, ...fields } = connection
  const { data, error } = await supabase
    .from('connections')
    .update(fields)
    .eq('id', id)
    .select()
  if (error) throw error
  return data[0]
}

export async function deleteConnection(id) {
  const { error } = await supabase
    .from('connections')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// --- Real-time Subscriptions ---
export function subscribeToNodes(projectId, callback) {
  return supabase
    .channel('nodes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'nodes', filter: `project_id=eq.${projectId}` },
      payload => callback(payload)
    )
    .subscribe()
}

export function subscribeToConnections(projectId, callback) {
  return supabase
    .channel('connections')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'connections', filter: `project_id=eq.${projectId}` },
      payload => callback(payload)
    )
    .subscribe()
}

// --- Helper Functions ---
export async function getSourceNodes(projectId) {
  const { data, error } = await supabase
    .from('nodes')
    .select('*')
    .eq('project_id', projectId)
    .eq('gear_type', 'source')
  if (error) throw error
  return data
}

export async function getCompleteSignalPath(projectId) {
  // Get all nodes and connections
  const nodes = await getNodes(projectId)
  const connections = await getConnections(projectId)
  
  // Build a map of node id to node
  const nodeMap = {}
  nodes.forEach(node => {
    nodeMap[node.id] = node
  })
  
  // Find all recorder nodes
  const recorders = nodes.filter(n => n.gear_type === 'recorder' || n.node_type === 'recorder')
  
  // Build signal paths for each recorder track
  const signalPaths = []
  
  recorders.forEach(recorder => {
    // Get all connections to this recorder
    const recorderConnections = connections.filter(c => c.to_node_id === recorder.id)
    
    recorderConnections.forEach(conn => {
      // Build the path backwards from recorder to source
      const path = buildPathToSource(conn.from_node_id, connections, nodeMap)
      
      // Find the source node at the start of the path
      const sourceNode = path.length > 0 ? nodeMap[path[0]] : null
      
      signalPaths.push({
        recorder_id: recorder.id,
        recorder_label: recorder.label,
        track_number: conn.track_number,
        source_id: sourceNode?.id,
        source_label: sourceNode?.label,
        track_name: sourceNode?.track_name,
        path: path.map(nodeId => nodeMap[nodeId]?.label || nodeId),
        pad: conn.pad || false,
        phantom_power: conn.phantom_power || false,
        connection_id: conn.id
      })
    })
  })
  
  // Sort by track number
  signalPaths.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
  
  return signalPaths
}

function buildPathToSource(nodeId, connections, nodeMap) {
  const visited = new Set()
  const path = []
  
  function traverse(currentId) {
    if (visited.has(currentId)) return
    visited.add(currentId)
    
    const node = nodeMap[currentId]
    if (!node) return
    
    // If this is a source, we've reached the beginning
    if (node.gear_type === 'source' || node.node_type === 'source') {
      path.unshift(currentId)
      return
    }
    
    // Find connections leading to this node
    const incomingConnections = connections.filter(c => c.to_node_id === currentId)
    
    if (incomingConnections.length > 0) {
      // Add this node to path
      path.unshift(currentId)
      // Traverse backwards through the first connection (if multiple, just pick first)
      traverse(incomingConnections[0].from_node_id)
    }
  }
  
  traverse(nodeId)
  return path
}