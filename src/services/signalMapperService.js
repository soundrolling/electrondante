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
  // Preload all connection_port_map rows for this project to resolve transformer→transformer/recorder chains
  let allPortMaps = []
  try {
    const { data } = await supabase
      .from('connection_port_map')
      .select('connection_id, from_port, to_port')
    allPortMaps = data || []
  } catch {}
  const mapsByConnId = allPortMaps.reduce((acc, m)=>{
    (acc[m.connection_id] = acc[m.connection_id] || []).push(m)
    return acc
  }, {})
  const parentConnsByToNode = connections.reduce((acc, c)=>{
    (acc[c.to_node_id] = acc[c.to_node_id] || []).push(c)
    return acc
  }, {})
  
  // Build a map of node id to node
  const nodeMap = {}
  nodes.forEach(node => {
    nodeMap[node.id] = node
  })
  
  // Find all recorder nodes
  const recorders = nodes.filter(n => n.gear_type === 'recorder' || n.node_type === 'recorder')
  
  // Build signal paths for each recorder track
  const signalPaths = []
  const seen = new Set()
  
  for (const recorder of recorders) {
    // Get all connections to this recorder
    const recorderConnections = connections.filter(c => c.to_node_id === recorder.id)

    // Expand port-mapped parent connections (transformer→recorder with connection_port_map rows)
    let trackConns = recorderConnections.filter(c => !!c.input_number)
    const parentConnIds = recorderConnections.map(c => c.id)
    if (parentConnIds.length) {
      try {
        const mapRows = allPortMaps.filter(r => parentConnIds.includes(r.connection_id))
        if (mapRows && mapRows.length) {
          const parentById = Object.fromEntries(recorderConnections.map(p => [p.id, p]))
          const expanded = mapRows.map(row => ({
            from_node_id: parentById[row.connection_id]?.from_node_id,
            to_node_id: recorder.id,
            input_number: row.to_port,
            pad: parentById[row.connection_id]?.pad,
            phantom_power: parentById[row.connection_id]?.phantom_power,
            connection_type: parentById[row.connection_id]?.connection_type,
            id: `${row.connection_id}:${row.to_port}`
          })).filter(v => v.from_node_id)
          trackConns = trackConns.concat(expanded)
        }
      } catch {}
    }
    
    trackConns.forEach(conn => {
      // Build the path backwards from the recorder to source
      const pathIds = buildPathToSource(conn.from_node_id, connections, nodeMap)

      // Build human labels: Recorder Track -> each intermediate node with its input number -> Source
      const { labels, finalSourceNode } = resolveUpstreamPath(conn.from_node_id, conn.input_number, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder)

      // For uniqueness, key off recorder + track + first node id at end of traversal
      const uniqueKey = `${recorder.id}|${conn.input_number || conn.track_number || ''}|${finalSourceNode?.id || ''}`
      if (seen.has(uniqueKey)) return
      seen.add(uniqueKey)

      signalPaths.push({
        recorder_id: recorder.id,
        recorder_label: recorder.label,
        // Use recorder connection input as the track number shown to the user
        track_number: conn.input_number || conn.track_number,
        source_id: finalSourceNode?.id || null,
        // For sources, track_name is the custom mic placement name (e.g., "Stage L")
        source_label: finalSourceNode?.track_name || finalSourceNode?.label || null,
        track_name: finalSourceNode?.track_name || finalSourceNode?.label || null,
        path: labels,
        pad: typeof conn.pad === 'number' ? conn.pad : (conn.pad ? 1 : 0),
        phantom_power: conn.phantom_power || false,
        connection_id: conn.id
      })
    })
  }
  
  // Sort by track number
  signalPaths.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
  
  return signalPaths
}

function resolveUpstreamPath(startNodeId, startInput, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder) {
  const labels = []
  const trackLabel = startInput ? `Track ${startInput}` : undefined
  labels.push(trackLabel ? `${recorder.label} ${trackLabel}` : `${recorder.label}`)

  let currentNodeId = startNodeId
  let currentInput = startInput
  const maxHops = 25
  let finalSourceNode = null
  
  for (let hop = 0; hop < maxHops; hop++) {
    const node = nodeMap[currentNodeId]
    if (!node) break
    
    if (node.gear_type === 'source' || node.node_type === 'source') {
      // For sources, track_name is the custom name set in mic placement (e.g., "Stage L")
      const sourceName = node.track_name || node.label
      labels.push(sourceName)
      finalSourceNode = node
      break
    }
    
    // Add this transformer/recorder with its input number
    labels.push(currentInput ? `${node.label} Input ${currentInput}` : `${node.label}`)
    
    // Find parent connections feeding this node
    const parents = parentConnsByToNode[currentNodeId] || []
    if (!parents.length) break
    
    // Check if any parent has a port map
    const parentWithMap = parents.find(p => (mapsByConnId[p.id] || []).length > 0)
    
    if (parentWithMap) {
      // Use port map to trace back
      const maps = mapsByConnId[parentWithMap.id] || []
      const row = maps.find(m => Number(m.to_port) === Number(currentInput))
      if (!row) {
        // No mapping for this input; stop here
        break
      }
      // Move to the parent node's output (from_port)
      currentNodeId = parentWithMap.from_node_id
      currentInput = row.from_port
      continue
    }
    
    // No port map: parents are already connections TO the current node (e.g., Stage L → Yamaha)
    // Find the parent connection with matching input_number
    const matchingConn = parents.find(c => 
      typeof c.input_number === 'number' && 
      Number(c.input_number) === Number(currentInput)
    )
    
    if (matchingConn) {
      // Found the connection feeding this input; move to the source node
      currentNodeId = matchingConn.from_node_id
      // For the next iteration (though if it's a source, we'll exit immediately)
      currentInput = matchingConn.input_number
    } else {
      // No matching connection; stop traversal
      break
    }
  }
  
  return { labels, finalSourceNode }
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