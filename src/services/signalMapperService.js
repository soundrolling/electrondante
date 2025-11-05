// src/services/signalMapperService.js
import { supabase } from '../supabase'
import { buildGraph, getNodeType } from './signalGraph'
import { getOutputLabel as svcGetOutputLabel } from './portLabelService'

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
  // Remove node_type if present (column doesn't exist in database)
  const { node_type, ...nodeData } = node
  const { data, error } = await supabase
    .from('nodes')
    .insert([nodeData])
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
  // First, delete all port mappings for this connection
  // This must be done before deleting the connection due to foreign key constraints
  try {
    const { error: portMapError } = await supabase
      .from('connection_port_map')
      .delete()
      .eq('connection_id', id)
    if (portMapError) {
      console.error('Error deleting port mappings:', portMapError)
      // Continue with connection deletion even if port mapping deletion fails
    }
  } catch (err) {
    console.error('Error deleting port mappings:', err)
    // Continue with connection deletion
  }
  
  // Then delete the connection itself
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

// Centralized function to get source label from a node
// Always prioritizes output_port_labels (most reliable) and handles mono/stereo correctly
export async function getSourceLabelFromNode(node, outputPort) {
  if (!node) return null
  
  const nodeType = (node.gear_type || node.type || '').toLowerCase()
  
  // Handle venue_sources node type
  if (nodeType === 'venue_sources') {
    const portNum = typeof outputPort === 'number' ? outputPort : 1
    
    // First check node's output_port_labels (these are set from custom labels in port map)
    if (node.output_port_labels && typeof node.output_port_labels === 'object') {
      const storedLabel = node.output_port_labels[String(portNum)] || node.output_port_labels[portNum]
      if (storedLabel) return storedLabel
    }
    
    // Fallback: Query venue_source_feeds table to resolve port number to source label
    try {
      const { data: feeds, error } = await supabase
        .from('venue_source_feeds')
        .select('*')
        .eq('node_id', node.id)
        .eq('port_number', portNum)
        .maybeSingle()
      
      if (error) {
        console.error('Error querying venue_source_feeds:', error)
        return null
      }
      
      if (feeds) {
        // Prioritize output_port_label if it exists (e.g., "DJA L", "Program 1")
        if (feeds.output_port_label) {
          return feeds.output_port_label
        }
        
        // Fallback: construct label from source_type and feed_identifier
        const sourceTypeName = feeds.source_type.charAt(0).toUpperCase() + feeds.source_type.slice(1).replace(/_/g, ' ')
        if (feeds.channel === 2) {
          return `${sourceTypeName} ${feeds.feed_identifier} R`
        } else {
          // Check if stereo (has channel 2)
          const { data: stereoCheck } = await supabase
            .from('venue_source_feeds')
            .select('id')
            .eq('node_id', node.id)
            .eq('source_type', feeds.source_type)
            .eq('feed_identifier', feeds.feed_identifier)
            .eq('channel', 2)
            .maybeSingle()
          
          if (stereoCheck) {
            return `${sourceTypeName} ${feeds.feed_identifier} L`
          }
          return `${sourceTypeName} ${feeds.feed_identifier}`
        }
      }
    } catch (err) {
      console.error('Error in getSourceLabelFromNode for venue_sources:', err)
    }
    return null
  }
  
  if (nodeType !== 'source') return null
  
  const outCount = node?.num_outputs || node?.outputs || 0
  const portNum = typeof outputPort === 'number' ? outputPort : 1
  
  // Always check output_port_labels first (most reliable)
  if (node.output_port_labels && typeof node.output_port_labels === 'object') {
    // Try exact port match
    const storedLabel = node.output_port_labels[String(portNum)] || node.output_port_labels[portNum]
    if (storedLabel) return storedLabel
    
    // For mono sources, try port 1 if portNum doesn't match
    if ((outCount === 1 || node.outputs === 1) && portNum !== 1) {
      const monoLabel = node.output_port_labels['1'] || node.output_port_labels[1]
      if (monoLabel) return monoLabel
    }
  }
  
  // Fallback to computed labels if not stored
  // Extract base name and number suffix consistently
  const label = node.label || ''
  const trackName = node.track_name || ''
  
  // Use consistent regex pattern: match "Name (Number)" or "Name (Letter)"
  const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
  const num = m ? m[2] : ''
  
  // Get clean base name: prefer track_name (cleaned), fall back to label base
  let base
  if (trackName) {
    base = trackName.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
  } else if (m) {
    base = m[1].replace(/\s*LR$/i, '').trim()
  } else {
    base = label.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
  }
  
  const numSuffix = num ? ` (${num})` : ''
  
  // For stereo sources, append L/R based on port number
  if (outCount === 2 && typeof portNum === 'number') {
    if (portNum === 1) {
      return `${base} L${numSuffix}`
    } else if (portNum === 2) {
      return `${base} R${numSuffix}`
    } else {
      // Fallback for other port numbers
      return `${base}${portNum % 2 === 1 ? ' L' : ' R'}${numSuffix}`
    }
  }
  
  // For mono sources, return base with suffix
  return `${base}${numSuffix}`
}

export async function getCompleteSignalPath(projectId) {
  const graph = await buildGraph(projectId)
  // Get all nodes and connections
  const nodes = await getNodes(projectId)
  const connections = await getConnections(projectId)
  // Preload all connection_port_map rows for this project to resolve transformer→transformer/recorder chains
  let allPortMaps = []
  try {
    // Get all connections for this project first
    const connIds = connections.map(c => c.id)
    if (connIds.length > 0) {
      const { data } = await supabase
        .from('connection_port_map')
        .select('connection_id, from_port, to_port')
        .in('connection_id', connIds)
      allPortMaps = data || []
    }
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
        .neq('gear_type', 'accessories_cables')
      if (gearData) {
        gearData.forEach(gear => {
          gearMap[gear.id] = gear.gear_name
        })
      }
    } catch {}
  }
  
  // Find all recorder nodes
  const recorders = nodes.filter(n => n.gear_type === 'recorder' || n.type === 'recorder')
  
  // Build signal paths for each recorder track
  const signalPaths = []
  const seen = new Set()
  
  for (const recorder of recorders) {
    // Get all connections to this recorder
    const recorderConnections = connections.filter(c => c.to_node_id === recorder.id)

    // Expand port-mapped parent connections (transformer→recorder with connection_port_map rows)
    // Start with all direct connections to the recorder (those with input_number set)
    let trackConns = recorderConnections.filter(c => !!c.input_number || !!c.track_number)
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
          
          // Combine direct connections with expanded port-mapped connections
          // Use a Set to avoid duplicates based on input_number
          const seenInputs = new Set(trackConns.map(c => c.input_number || c.track_number).filter(Boolean))
          const uniqueExpanded = expanded.filter(e => !seenInputs.has(e.input_number))
          trackConns = trackConns.concat(uniqueExpanded)
        }
      } catch {}
    }
    
    // Use for...of loop to properly handle async/await
    for (const conn of trackConns) {
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
        if (fromNode && (fromNode.gear_type === 'source' || fromNode.type === 'source')) {
          startInput = conn.from_port // Use from_port (1 or 2) for source output detection
          recorderTrackNum = conn.input_number // Keep original track number for label
        } else {
          // Even if not directly a source, preserve from_port for tracing through transformers
          // The from_port tells us which output from the upstream node (could be transformer or source)
          startInput = conn.from_port
        }
      }

      // Build human labels: Recorder Track -> each intermediate node with its input number -> Source
      const { labels, finalSourceNode, finalSourceLabel, sourceOutputPort } = await resolveUpstreamPath(conn.from_node_id, startInput, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder, recorderTrackNum)

      // For uniqueness, key off recorder + track + source node id + source output port
      // This ensures L and R from the same source are treated as separate paths
      const uniqueKey = `${recorder.id}|${conn.input_number || conn.track_number || ''}|${finalSourceNode?.id || ''}|${sourceOutputPort || ''}`
      if (seen.has(uniqueKey)) continue
      seen.add(uniqueKey)

      // Get source gear name if the source node has a gear_id
      const sourceGearName = finalSourceNode?.gear_id ? gearMap[finalSourceNode.gear_id] : null

      // Resolve final source label using unified service if possible
      let finalLabel = finalSourceLabel
      if (finalSourceNode) {
        try {
          const sourcePort = sourceOutputPort || 1
          const lbl = await svcGetOutputLabel(finalSourceNode, sourcePort, graph)
          if (lbl) finalLabel = lbl
        } catch {}
      }

      signalPaths.push({
        recorder_id: recorder.id,
        recorder_label: recorder.label,
        // Use recorder connection input as the track number shown to the user
        track_number: conn.input_number || conn.track_number,
        source_id: finalSourceNode?.id || null,
        // Prefer unified label resolver
        source_label: finalLabel || finalSourceNode?.track_name || finalSourceNode?.label || null,
        track_name: finalLabel || finalSourceNode?.track_name || finalSourceNode?.label || null,
        source_gear_name: sourceGearName,
        path: labels,
        pad: typeof conn.pad === 'number' ? conn.pad : (conn.pad ? 1 : 0),
        phantom_power: conn.phantom_power || false,
        // For expanded port-mapped connections, use the real connection_id, otherwise use the connection id
        connection_id: conn.connection_id || conn.id
      })
    }
  }
  
  // Sort by track number
  signalPaths.sort((a, b) => (a.track_number || 0) - (b.track_number || 0))
  
  return signalPaths
}

async function resolveUpstreamPath(startNodeId, startInput, nodeMap, parentConnsByToNode, mapsByConnId, connections, recorder, recorderTrackNumber) {
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
  let sourceOutputPort = null // Track the actual source output port (1=L, 2=R)
  
  for (let hop = 0; hop < maxHops; hop++) {
    const node = nodeMap[currentNodeId]
    if (!node) break
    
    if (node.gear_type === 'source' || node.node_type === 'source') {
      // Use centralized helper function - ensures consistent label retrieval
      // currentInput should represent the source output port (1=L, 2=R for stereo)
      const sourceName = await getSourceLabelFromNode(node, currentInput)
      if (sourceName) {
        labels.push(sourceName)
        finalSourceNode = node
        finalSourceLabel = sourceName
        // Capture the source output port (1=L, 2=R) if this is a stereo source
        if ((node.num_outputs === 2 || node.outputs === 2) && typeof currentInput === 'number' && currentInput >= 1 && currentInput <= 2) {
          sourceOutputPort = currentInput
        } else if (node.num_outputs === 1 || node.outputs === 1) {
          sourceOutputPort = 1 // Mono sources always use port 1
        }
      }
      break
    }
    
    // Handle venue_sources node type
    if (node.gear_type === 'venue_sources' || node.type === 'venue_sources') {
      // Use centralized helper function for venue sources
      const sourceName = await getSourceLabelFromNode(node, currentInput)
      if (sourceName) {
        labels.push(sourceName)
        finalSourceNode = node
        finalSourceLabel = sourceName
        // For venue sources, sourceOutputPort is the port number
        sourceOutputPort = currentInput
      }
      break
    }
    
    // Check if this is a recorder - if so, we need to trace what's feeding its track (output port)
    if (node.gear_type === 'recorder' || node.type === 'recorder') {
      // For recorders, currentInput represents the track number (output port)
      // We need to find what's feeding this recorder's track
      const recorderParents = parentConnsByToNode[currentNodeId] || []
      
      // Find connection to this recorder that uses this track number
      // Check both direct connections and port-mapped connections
      let trackConn = recorderParents.find(c => 
        (c.track_number === currentInput || c.input_number === currentInput)
      )
      
      // If no direct connection, check port mappings
      if (!trackConn) {
        for (const parentConn of recorderParents) {
          const portMaps = mapsByConnId[parentConn.id] || []
          // Check if any port map has to_port matching the track number
          const matchingMap = portMaps.find(m => Number(m.to_port) === Number(currentInput))
          if (matchingMap) {
            trackConn = { ...parentConn, _mappedFromPort: matchingMap.from_port }
            break
          }
        }
      }
      
      if (trackConn) {
        // Found connection feeding this recorder track - trace from source
        const sourceNodeId = trackConn.from_node_id
        const sourceNode = nodeMap[sourceNodeId]
        
        if (sourceNode) {
          // Determine which port on the source to trace from
          let sourcePort = 1 // Default to port 1
          
          // If connection has port maps, use the mapped from_port
          if (trackConn._mappedFromPort !== undefined) {
            sourcePort = trackConn._mappedFromPort
          } else {
            // Check if the connection itself has port maps (for port-mapped connections to recorder)
            const trackConnMaps = mapsByConnId[trackConn.id] || []
            if (trackConnMaps.length > 0) {
              // Find the port map entry that matches this track number
              const matchingMap = trackConnMaps.find(m => Number(m.to_port) === Number(currentInput))
              if (matchingMap) {
                sourcePort = matchingMap.from_port
              } else if (trackConnMaps[0]) {
                sourcePort = trackConnMaps[0].from_port
              }
            } else {
              // No port maps - try to determine from connection
              // For direct source-to-recorder connections, we may need to infer
              sourcePort = trackConn.output_number || trackConn.input_number || 1
              
              // If source is stereo and we have multiple connections, try to infer L/R
              if (sourceNode && (sourceNode.gear_type === 'source' || sourceNode.type === 'source')) {
                if ((sourceNode.num_outputs === 2 || sourceNode.outputs === 2)) {
                  const allSourceConns = recorderParents.filter(c => 
                    c.from_node_id === sourceNodeId
                  )
                  if (allSourceConns.length >= 2) {
                    // Multiple connections from stereo source - use track number position to infer
                    const sortedTracks = allSourceConns
                      .map(c => c.track_number || c.input_number)
                      .filter(Boolean)
                      .map(Number)
                      .sort((a, b) => a - b)
                    const trackIndex = sortedTracks.indexOf(Number(currentInput))
                    sourcePort = trackIndex === 0 ? 1 : 2 // First track = L, second = R
                  }
                }
              }
            }
          }
          
          // Check if source is another recorder - recursively trace
          if (sourceNode.gear_type === 'recorder' || sourceNode.type === 'recorder') {
            // Source is another recorder - continue tracing from its output port
            currentNodeId = sourceNodeId
            currentInput = sourcePort
            // Add recorder to labels
            labels.push(`${node.label} Track ${currentInput}`)
            continue
          } else {
            // Source is a transformer or regular source - continue tracing normally
            // currentInput should already be set to sourcePort which is the source output port
            currentNodeId = sourceNodeId
            currentInput = sourcePort
            // Add recorder to labels
            labels.push(`${node.label} Track ${currentInput}`)
            continue
          }
        }
      }
      
      // If we couldn't find what's feeding this recorder track, add label and break
      labels.push(`${node.label} Track ${currentInput}`)
      break
    }
    
    // Add this transformer with its input number
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
      // Move to the parent node - from_port tells us which OUTPUT port on the parent
      // For transformers, output N typically corresponds to input N (1:1 mapping)
      // But we need to check if the parent connection has port maps that tell us
      // which source output feeds this transformer output
      currentNodeId = parentWithMap.from_node_id
      const parentNode = nodeMap[currentNodeId]
      
      // If parent is a source, from_port directly tells us source output (1 or 2)
      if (parentNode && (parentNode.gear_type === 'source' || parentNode.type === 'source')) {
        currentInput = row.from_port // This is the source output port (1 or 2)
        continue
      }
      
      // If parent is a transformer, we need to find which transformer input corresponds to output row.from_port
      // For transformers, assume 1:1 mapping (input N = output N) unless there's a port map telling us otherwise
      // Check if the parent transformer has incoming connections with port maps
      const parentInputConn = (parentConnsByToNode[currentNodeId] || []).find(p => {
        const parentMaps = mapsByConnId[p.id] || []
        if (parentMaps.length > 0) {
          // Check if any port map has from_port matching row.from_port (the parent transformer output we're tracing)
          return parentMaps.some(m => Number(m.to_port) === Number(row.from_port))
        }
        return false
      })
      
      if (parentInputConn) {
        // Found a port-mapped connection to parent - find which port map entry matches
        const parentMaps = mapsByConnId[parentInputConn.id] || []
        const parentMapRow = parentMaps.find(m => Number(m.to_port) === Number(row.from_port))
        if (parentMapRow) {
          // The from_port in parentMapRow tells us which source/upstream output feeds this
          currentInput = parentMapRow.from_port
          currentNodeId = parentInputConn.from_node_id
          continue
        }
      }
      
      // Fallback: for transformers, assume 1:1 mapping (output N = input N)
      currentInput = row.from_port
      // Continue loop to trace from the parent node
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
      
      if (fromNode && (fromNode.gear_type === 'source' || fromNode.type === 'source')) {
        // Reached a source - determine L/R for stereo sources
        if ((fromNode.num_outputs === 2 || fromNode.outputs === 2)) {
          // Check if there's a port map from source to transformer - this is the most reliable way
          const connId = matchingConn.id
          const portMaps = mapsByConnId[connId] || []
          
          if (portMaps.length > 0) {
            // Port map exists - use from_port to determine source output (1=L, 2=R)
            // Find the port map entry that matches the transformer input we came from
            const portMap = portMaps.find(m => Number(m.to_port) === Number(currentInput))
            if (portMap) {
              // from_port tells us which source output (1 or 2)
              currentInput = Number(portMap.from_port) || 1
            } else {
              // If no matching port map found, use first one or default
              currentInput = Number(portMaps[0]?.from_port) || 1
            }
          } else {
            // No port map - try to determine from sibling connections
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
              // Single connection - use parity heuristic based on transformer input number
              currentInput = Number(currentInput) % 2 === 1 ? 1 : 2
            } else {
              // No siblings found - use parity heuristic
              currentInput = Number(currentInput) % 2 === 1 ? 1 : 2
            }
          }
        } else {
          currentInput = 1 // Mono source
        }
        // Continue loop to let source check at top handle it
        continue
      } else {
        // Not a source yet - this is a transformer
        // Keep tracing through this transformer - find connection feeding the input that produces output currentInput
        // For transformers, typically output N = input N (1:1 mapping)
        if (!nodeMap[currentNodeId]) break
        
        const transformerParents = parentConnsByToNode[currentNodeId] || []
        if (!transformerParents.length) break
        
        // Find connection feeding the transformer input that corresponds to output currentInput
        // For 1:1 transformers, input N produces output N
        const inputNum = currentInput // Transformer output N typically comes from input N
        const nextConn = transformerParents.find(c => {
          // Check if connection has port maps
          const connMaps = mapsByConnId[c.id] || []
          if (connMaps.length > 0) {
            // Find if any port map has to_port matching inputNum
            return connMaps.some(m => Number(m.to_port) === Number(inputNum))
          }
          // No port map - check if input_number matches
          return typeof c.input_number === 'number' && Number(c.input_number) === Number(inputNum)
        })
        
        if (nextConn) {
          const connMaps = mapsByConnId[nextConn.id] || []
          if (connMaps.length > 0) {
            // Has port map - find which from_port maps to inputNum
            const mapRow = connMaps.find(m => Number(m.to_port) === Number(inputNum))
            if (mapRow) {
              // from_port tells us which source/upstream output feeds this transformer input
              currentNodeId = nextConn.from_node_id
              currentInput = mapRow.from_port
              continue
            }
          }
          
          // No port map or didn't find matching map - check if parent is a source
          const nextNode = nodeMap[nextConn.from_node_id]
          if (nextNode && (nextNode.gear_type === 'source' || nextNode.type === 'source')) {
            // Parent is a source - for direct connections, we need to determine which source output
            // Check if there are multiple connections from this source to help determine L/R
            const sourceConnections = transformerParents.filter(c => 
              c.from_node_id === nextConn.from_node_id
            )
            
            if ((nextNode.num_outputs === 2 || nextNode.outputs === 2) && sourceConnections.length >= 2) {
              // Multiple connections from stereo source - use position to determine L/R
              const sortedInputs = sourceConnections
                .map(c => c.input_number)
                .filter(Boolean)
                .map(Number)
                .sort((a, b) => a - b)
              
              const index = sortedInputs.indexOf(Number(inputNum))
              currentInput = index === 0 ? 1 : 2 // First connection = L (output 1), second = R (output 2)
            } else {
              // Single connection or mono source - use parity heuristic
              currentInput = Number(inputNum) % 2 === 1 ? 1 : 2
            }
          } else {
            // Parent is another transformer - assume 1:1 mapping (output = input)
            currentInput = nextConn.input_number || inputNum
          }
          
          currentNodeId = nextConn.from_node_id
          continue
        }
        
        // Try fallback: find any connection to continue tracing
        const fallbackConn = transformerParents.find(c => typeof c.input_number === 'number')
        if (fallbackConn) {
          currentNodeId = fallbackConn.from_node_id
          const fallbackMaps = mapsByConnId[fallbackConn.id] || []
          if (fallbackMaps.length > 0 && fallbackMaps[0]) {
            currentInput = fallbackMaps[0].from_port
          } else {
            currentInput = fallbackConn.input_number
          }
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
        (node.gear_type === 'transformer' || node.type === 'transformer' ||
         (node.gear_type !== 'source' && node.type !== 'source' && node.gear_type !== 'recorder' && node.type !== 'recorder'))
      
      if (isTransformer && parents.length > 0) {
        // Try to find connection with port maps first
        const portMappedParent = parents.find(p => {
          const maps = mapsByConnId[p.id] || []
          return maps.length > 0 && maps.some(m => Number(m.to_port) === Number(currentInput))
        })
        
        if (portMappedParent) {
          const maps = mapsByConnId[portMappedParent.id] || []
          const mapRow = maps.find(m => Number(m.to_port) === Number(currentInput))
          if (mapRow) {
            currentNodeId = portMappedParent.from_node_id
            const parentNode = nodeMap[currentNodeId]
            if (parentNode && (parentNode.gear_type === 'source' || parentNode.type === 'source')) {
              currentInput = mapRow.from_port // Source output port (1 or 2)
            } else {
              currentInput = mapRow.from_port // Transformer output port
            }
            continue
          }
        }
        
        // Fallback: try to use a connection that matches our input
        const fallbackConn = parents.find(c => 
          typeof c.input_number === 'number' && Number(c.input_number) === Number(currentInput)
        ) || parents.find(c => typeof c.input_number === 'number')
        
        if (fallbackConn) {
          const fallbackMaps = mapsByConnId[fallbackConn.id] || []
          currentNodeId = fallbackConn.from_node_id
          const fallbackNode = nodeMap[currentNodeId]
          
          if (fallbackMaps.length > 0) {
            // Has port maps - use from_port of first map
            const firstMap = fallbackMaps[0]
            if (fallbackNode && (fallbackNode.gear_type === 'source' || fallbackNode.type === 'source')) {
              currentInput = firstMap.from_port // Source output port
            } else {
              currentInput = firstMap.from_port // Upstream output port
            }
          } else {
            // No port maps - check if it's a source
            if (fallbackNode && (fallbackNode.gear_type === 'source' || fallbackNode.type === 'source')) {
              // Determine source output from connection context
              if ((fallbackNode.num_outputs === 2 || fallbackNode.outputs === 2)) {
                const siblings = parents
                  .filter(c => c.from_node_id === fallbackConn.from_node_id)
                  .map(c => Number(c.input_number))
                  .filter(Boolean)
                  .sort((a, b) => a - b)
                
                const inputNum = Number(fallbackConn.input_number)
                const index = siblings.indexOf(inputNum)
                currentInput = index === 0 ? 1 : 2 // L or R based on position
              } else {
                currentInput = 1 // Mono source
              }
            } else {
              // Transformer - assume 1:1 mapping
              currentInput = fallbackConn.input_number || currentInput
            }
          }
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
    if (lastNode && (lastNode.gear_type === 'source' || lastNode.type === 'source')) {
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
        if (sourceNode && (sourceNode.gear_type === 'source' || sourceNode.type === 'source')) {
          finalSourceNode = sourceNode
          
          // Check for stored output port labels first (most reliable for stereo sources)
          let sourceName = null
          if (sourceNode.output_port_labels && typeof sourceNode.output_port_labels === 'object') {
            // Determine which source output port we're using (1 or 2)
            let sourceOutputPort = null
            
            // First check if there's a port map that tells us which source output (1=L, 2=R)
            const sourcePortMaps = mapsByConnId[sourceConn.id] || []
            if (sourcePortMaps.length > 0) {
              // Port map exists - find which source output port (from_port) maps to currentInput
              const portMapRow = sourcePortMaps.find(m => Number(m.to_port) === Number(currentInput))
              if (portMapRow) {
                sourceOutputPort = Number(portMapRow.from_port)
              } else {
                // No exact match, try first port map
                const firstMap = sourcePortMaps[0]
                if (firstMap) {
                  sourceOutputPort = Number(firstMap.from_port)
                }
              }
            } else {
              // No port map - try to infer from currentInput or connection context
              // For stereo sources connected directly, currentInput might be the source output
              if ((sourceNode.num_outputs === 2 || sourceNode.outputs === 2) && typeof currentInput === 'number') {
                if (currentInput === 1 || currentInput === 2) {
                  sourceOutputPort = currentInput
                }
              }
            }
            
            // If we found a source output port, try to get stored label
            if (sourceOutputPort) {
              const storedLabel = sourceNode.output_port_labels[String(sourceOutputPort)] || sourceNode.output_port_labels[sourceOutputPort]
              if (storedLabel) {
                sourceName = storedLabel
              }
            }
            
            // If stereo source but no specific port found, try both ports (shouldn't happen, but fallback)
            if (!sourceName && (sourceNode.num_outputs === 2 || sourceNode.outputs === 2)) {
              const storedLabel1 = sourceNode.output_port_labels['1'] || sourceNode.output_port_labels[1]
              const storedLabel2 = sourceNode.output_port_labels['2'] || sourceNode.output_port_labels[2]
              // Prefer port 1 if only one exists, otherwise we can't determine
              if (storedLabel1 && !storedLabel2) {
                sourceName = storedLabel1
              } else if (storedLabel2 && !storedLabel1) {
                sourceName = storedLabel2
              }
            }
          }
          
          // Fallback to computed labels if not stored
          if (!sourceName) {
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
            
            sourceName = base + numSuffix
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
          }
          finalSourceLabel = sourceName
          // Also add source name to labels array so it appears in the path
          labels.push(sourceName)
          // Capture source output port from the label or port map
          if (sourceNode && (sourceNode.num_outputs === 2 || sourceNode.outputs === 2)) {
            // Check if there's a port map that tells us which source output (1=L, 2=R)
            const sourcePortMaps = mapsByConnId[sourceConn.id] || []
            if (sourcePortMaps.length > 0) {
              const portMapRow = sourcePortMaps.find(m => Number(m.to_port) === Number(currentInput))
              if (portMapRow) {
                sourceOutputPort = Number(portMapRow.from_port)
              } else if (sourcePortMaps[0]) {
                sourceOutputPort = Number(sourcePortMaps[0].from_port)
              }
            } else {
              // Infer from label (L = 1, R = 2) or from connection position
              if (sourceName.includes(' L')) {
                sourceOutputPort = 1
              } else if (sourceName.includes(' R')) {
                sourceOutputPort = 2
              } else {
                // Infer from transformer input position
                const siblings = transformerParents.filter(c => 
                  c.from_node_id === sourceConn.from_node_id &&
                  typeof c.input_number === 'number'
                ).map(c => Number(c.input_number)).sort((a,b) => a - b)
                if (siblings.length >= 2) {
                  const sourceConnInput = Number(sourceConn.input_number)
                  const index = siblings.indexOf(sourceConnInput)
                  sourceOutputPort = index === 0 ? 1 : 2
                } else {
                  const sourceConnInput = Number(sourceConn.input_number)
                  sourceOutputPort = sourceConnInput % 2 === 1 ? 1 : 2
                }
              }
            }
          } else if (sourceNode && (sourceNode.num_outputs === 1 || sourceNode.outputs === 1)) {
            sourceOutputPort = 1 // Mono sources always use port 1
          }
        }
        }
      }
    }
  }
  
  return { labels, finalSourceNode, finalSourceLabel, sourceOutputPort }
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