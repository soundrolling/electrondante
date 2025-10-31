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
  
  // Fetch gear data for nodes that have gear_id
  const gearIds = nodes.filter(n => n.gear_id).map(n => n.gear_id)
  const gearMap = {}
  if (gearIds.length > 0) {
    try {
      const { data: gearData } = await supabase
        .from('gear_table')
        .select('id, gear_name')
        .in('id', gearIds)
      if (gearData) {
        gearData.forEach(gear => {
          gearMap[gear.id] = gear.gear_name
        })
      }
    } catch {}
  }
  
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
            from_port: row.from_port, // Store the source output port for later use
            pad: parentById[row.connection_id]?.pad,
            phantom_power: parentById[row.connection_id]?.phantom_power,
            connection_type: parentById[row.connection_id]?.connection_type,
            id: `${row.connection_id}:${row.to_port}`,
            connection_id: row.connection_id // Keep reference to original connection for port map lookup
          })).filter(v => v.from_node_id)
          trackConns = trackConns.concat(expanded)
        }
      } catch {}
    }
    
    trackConns.forEach(conn => {
      // Build the path backwards from the recorder to source
      const pathIds = buildPathToSource(conn.from_node_id, connections, nodeMap)

      // For port-mapped connections direct to recorder, use from_port to determine source output (L/R)
      // Otherwise use input_number which will be resolved through port maps
      let startInput = conn.input_number
      let recorderTrackNum = conn.input_number // Default to input_number for label
      if (conn.from_port && typeof conn.from_port === 'number') {
        // This is an expanded port map connection - from_port tells us the source output (1=L, 2=R)
        // Check if the from_node is a source - if so, we can use from_port directly for L/R determination
        const fromNode = nodeMap[conn.from_node_id]
        if (fromNode && (fromNode.gear_type === 'source' || fromNode.node_type === 'source')) {
          startInput = conn.from_port // Use from_port (1 or 2) for source output detection
          recorderTrackNum = conn.input_number // Keep original track number for label
        }
      }

      // Build human labels: Recorder Track -> each intermediate node with its input number -> Source
      const { labels, finalSourceNode, finalSourceLabel } = resolveUpstreamPath(conn.from_node_id, startInput, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder, recorderTrackNum)

      // For uniqueness, key off recorder + track + first node id at end of traversal
      const uniqueKey = `${recorder.id}|${conn.input_number || conn.track_number || ''}|${finalSourceNode?.id || ''}`
      if (seen.has(uniqueKey)) return
      seen.add(uniqueKey)

      // Get source gear name if the source node has a gear_id
      const sourceGearName = finalSourceNode?.gear_id ? gearMap[finalSourceNode.gear_id] : null

      signalPaths.push({
        recorder_id: recorder.id,
        recorder_label: recorder.label,
        // Use recorder connection input as the track number shown to the user
        track_number: conn.input_number || conn.track_number,
        source_id: finalSourceNode?.id || null,
        // Prefer computed source label (includes L/R for stereo ad-hoc sources)
        source_label: finalSourceLabel || finalSourceNode?.track_name || finalSourceNode?.label || null,
        track_name: finalSourceLabel || finalSourceNode?.track_name || finalSourceNode?.label || null,
        source_gear_name: sourceGearName,
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

function resolveUpstreamPath(startNodeId, startInput, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder, recorderTrackNumber) {
  const labels = []
  // Use recorderTrackNumber if provided (for direct port-mapped connections), otherwise use startInput
  const trackLabel = (recorderTrackNumber !== undefined && recorderTrackNumber !== null) 
    ? `Track ${recorderTrackNumber}` 
    : (startInput ? `Track ${startInput}` : undefined)
  labels.push(trackLabel ? `${recorder.label} ${trackLabel}` : `${recorder.label}`)

  let currentNodeId = startNodeId
  let currentInput = startInput
  const maxHops = 25
  let finalSourceNode = null
  let finalSourceLabel = null
  
  for (let hop = 0; hop < maxHops; hop++) {
    const node = nodeMap[currentNodeId]
    if (!node) break
    
    if (node.gear_type === 'source' || node.node_type === 'source') {
      // For sources, prefer custom track_name; if the source has two outputs and
      // we arrived carrying the source output index in currentInput, append L/R.
      // Clean the base name to avoid duplicate numbers and LR suffix
      const label = node.label || ''
      const trackName = node.track_name || ''
      const m = label.match(/^(.*) \((\d+)\)$/)
      const num = m ? m[2] : ''
      let base
      if (trackName) {
        base = trackName.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
      } else if (m) {
        base = m[1].replace(/\s*LR$/i,'').trim()
      } else {
        base = label.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
      }
      const numSuffix = num ? ` (${num})` : ''
      
      let sourceName = base + numSuffix
      if ((node.num_outputs === 2 || node.outputs === 2) && typeof currentInput === 'number') {
        if (Number(currentInput) === 1) sourceName = `${base} L${numSuffix}`
        else if (Number(currentInput) === 2) sourceName = `${base} R${numSuffix}`
      }
      labels.push(sourceName)
      finalSourceNode = node
      finalSourceLabel = sourceName
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
      // Move to the parent node - from_port tells us which input/output on the parent
      currentNodeId = parentWithMap.from_node_id
      currentInput = row.from_port
      // Continue loop to trace from the parent node's input/output
      continue
    }
    
    // No port map: parents are already connections TO the current node (e.g., Stage L → Yamaha)
    // Find the parent connection with matching input_number
    const matchingConn = parents.find(c => 
      typeof c.input_number === 'number' && 
      Number(c.input_number) === Number(currentInput)
    )
    
    if (matchingConn) {
      // Found the connection feeding this input; move to the parent node
      currentNodeId = matchingConn.from_node_id
      const fromNode = nodeMap[currentNodeId]
      
      if (fromNode && (fromNode.gear_type === 'source' || fromNode.node_type === 'source')) {
        // Reached a source - determine L/R for stereo sources
        if ((fromNode.num_outputs === 2 || fromNode.outputs === 2)) {
          // Find all connections from this source to the transformer we just came from
          // The transformer we were at is the one that has currentNodeId set before we moved to source
          // We need to look back at the node we came from to find all its incoming connections
          const transformerId = matchingConn.to_node_id
          const transformerConnections = parentConnsByToNode[transformerId] || []
          
          // Find all connections from this source to that transformer
          const siblings = transformerConnections.filter(c => 
            c.from_node_id === matchingConn.from_node_id &&
            typeof c.input_number === 'number'
          ).map(c => Number(c.input_number)).sort((a,b) => a - b)
          
          if (siblings.length >= 2) {
            // Multiple connections from same stereo source
            // The transformer inputs are in siblings array, find which position currentInput is at
            const currentInputNum = Number(currentInput)
            const index = siblings.indexOf(currentInputNum)
            if (index >= 0) {
              // Position 0 (lowest input number) = L (output 1), position 1 = R (output 2)
              currentInput = index === 0 ? 1 : 2
            } else {
              // Current input not in siblings - use parity heuristic
              currentInput = Number(currentInput) % 2 === 1 ? 1 : 2
            }
          } else if (siblings.length === 1) {
            // Single connection - check if there's a port map to tell us which output
            const connId = matchingConn.id
            const portMaps = mapsByConnId[connId] || []
            if (portMaps.length > 0) {
              // Port map exists - use from_port to determine output (1=L, 2=R)
              const portMap = portMaps.find(m => Number(m.to_port) === Number(currentInput)) || portMaps[0]
              currentInput = Number(portMap.from_port) || 1
            } else {
              // No port map - use parity heuristic based on transformer input number
              currentInput = Number(currentInput) % 2 === 1 ? 1 : 2
            }
          } else {
            // No siblings found - use parity heuristic
            currentInput = Number(currentInput) % 2 === 1 ? 1 : 2
          }
        } else {
          currentInput = 1 // Mono source
        }
        // Continue loop to let source check at top handle it
        continue
      } else {
        // Not a source yet - this is a transformer
        // Keep tracing through this transformer - find ANY connection feeding it
        if (!nodeMap[currentNodeId]) break
        
        const transformerParents = parentConnsByToNode[currentNodeId] || []
        if (!transformerParents.length) break
        
        // Try to find connection with matching input, otherwise use first available
        const nextConn = transformerParents.find(c => 
          typeof c.input_number === 'number' && Number(c.input_number) === Number(currentInput)
        ) || transformerParents.find(c => typeof c.input_number === 'number')
        
        if (nextConn) {
          // Continue tracing from the source of this connection
          currentNodeId = nextConn.from_node_id
          // Use the input number from the connection for further tracing
          currentInput = nextConn.input_number
          continue
        }
        // No connection found - stop here
        break
      }
    } else {
      // No matching connection with exact input_number
      // If this is a transformer, try to find ANY connection to continue tracing
      const node = nodeMap[currentNodeId]
      const isTransformer = node && 
        (node.gear_type === 'transformer' || node.node_type === 'transformer' ||
         (node.gear_type !== 'source' && node.node_type !== 'source' && node.gear_type !== 'recorder' && node.node_type !== 'recorder'))
      
      if (isTransformer && parents.length > 0) {
        // Try to use the first available connection to continue tracing
        // But try to find one that matches our input first
        const fallbackConn = parents.find(c => 
          typeof c.input_number === 'number' && Number(c.input_number) === Number(currentInput)
        ) || parents.find(c => typeof c.input_number === 'number')
        if (fallbackConn) {
          currentNodeId = fallbackConn.from_node_id
          // Keep currentInput as is, or use the connection's input_number if we're starting fresh
          // Actually, if we're tracing input 1, we should look for what feeds input 1
          // But the connection's input_number IS the input on the transformer we're at
          // So we should keep it as is for further tracing
          currentInput = fallbackConn.input_number
          continue
        }
      }
      // No connection found; stop traversal
      break
    }
  }
  
  // If we didn't find a source, try to find the source from the last transformer we visited
  // Look at connections feeding the transformer to get the source name
  if (!finalSourceNode && currentNodeId) {
    const lastNode = nodeMap[currentNodeId]
    if (lastNode && (lastNode.gear_type === 'source' || lastNode.node_type === 'source')) {
      // We actually did reach a source
      finalSourceNode = lastNode
      const trackName = lastNode.track_name || ''
      finalSourceLabel = trackName || lastNode.label || 'Unknown Source'
    } else if (lastNode) {
      // Last node is a transformer - look for what feeds it
      const transformerParents = parentConnsByToNode[currentNodeId] || []
      if (transformerParents.length > 0) {
        // Try to find a connection that matches our input, or use the first one
        const sourceConn = transformerParents.find(c => 
          typeof c.input_number === 'number' && Number(c.input_number) === Number(currentInput)
        ) || transformerParents[0]
        
        if (sourceConn) {
          const sourceNode = nodeMap[sourceConn.from_node_id]
          if (sourceNode && (sourceNode.gear_type === 'source' || sourceNode.node_type === 'source')) {
            finalSourceNode = sourceNode
            // Build source label
            const label = sourceNode.label || ''
            const trackName = sourceNode.track_name || ''
            const m = label.match(/^(.*) \((\d+)\)$/)
            const num = m ? m[2] : ''
            let base
            if (trackName) {
              base = trackName.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
            } else if (m) {
              base = m[1].replace(/\s*LR$/i,'').trim()
            } else {
              base = label.replace(/ \([\d]+\)\s*$/g,'').replace(/\s*LR$/i,'').trim()
            }
            const numSuffix = num ? ` (${num})` : ''
            
            let sourceName = base + numSuffix
            if ((sourceNode.num_outputs === 2 || sourceNode.outputs === 2)) {
              // First check if there's a port map that tells us which source output (1=L, 2=R)
              const sourcePortMaps = mapsByConnId[sourceConn.id] || []
              if (sourcePortMaps.length > 0) {
                // Port map exists - find which source output port (from_port) maps to currentInput
                const portMapRow = sourcePortMaps.find(m => Number(m.to_port) === Number(currentInput))
                if (portMapRow) {
                  // from_port is the source output: 1 = L, 2 = R
                  const sourceOutputPort = Number(portMapRow.from_port)
                  sourceName = sourceOutputPort === 1 ? `${base} L${numSuffix}` : `${base} R${numSuffix}`
                } else {
                  // No exact match, try first port map
                  const firstMap = sourcePortMaps[0]
                  if (firstMap) {
                    const sourceOutputPort = Number(firstMap.from_port)
                    sourceName = sourceOutputPort === 1 ? `${base} L${numSuffix}` : `${base} R${numSuffix}`
                  }
                }
              } else {
                // No port map - determine L/R from connection position relative to siblings
                // Get all connections from this source to the transformer, sorted by input number
                const siblings = transformerParents.filter(c => 
                  c.from_node_id === sourceConn.from_node_id &&
                  typeof c.input_number === 'number'
                ).map(c => Number(c.input_number)).sort((a,b) => a - b)
                
                if (siblings.length >= 2) {
                  // Multiple connections from same source - use position to determine L/R
                  const sourceConnInput = Number(sourceConn.input_number)
                  const index = siblings.indexOf(sourceConnInput)
                  sourceName = index === 0 ? `${base} L${numSuffix}` : `${base} R${numSuffix}`
                } else {
                  // Single connection - use input_number parity
                  const sourceConnInput = Number(sourceConn.input_number)
                  sourceName = sourceConnInput % 2 === 1 ? `${base} L${numSuffix}` : `${base} R${numSuffix}`
                }
              }
            }
            finalSourceLabel = sourceName
          }
        }
      }
    }
  }
  
  return { labels, finalSourceNode, finalSourceLabel }
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