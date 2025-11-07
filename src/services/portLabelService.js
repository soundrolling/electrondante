// src/services/portLabelService.js
import { supabase } from '../supabase'
import { getNodeType } from './signalGraph'

// Get the human label for a node's OUTPUT port.
// graph is the object from buildGraph() in signalGraph.js
export async function getOutputLabel(node, portNum, graph) {
  // Debug trace
  // console.log('[SignalMapper][Labels] getOutputLabel', { node_id: node?.id, type: getNodeType(node), portNum })
  const type = getNodeType(node)

  // Prefer stored output labels if available (works for venue_sources and custom sources)
  if (node?.output_port_labels && typeof node.output_port_labels === 'object') {
    const stored = node.output_port_labels[String(portNum)] || node.output_port_labels[portNum]
    if (stored) return stored
  }

  if (type === 'venue_sources') {
    // If we don't know which port, don't query (avoids eq.null errors)
    if (portNum === null || portNum === undefined) return ''
    // Fallback to venue_source_feeds
    try {
      const { data } = await supabase
        .from('venue_source_feeds')
        .select('output_port_label, source_type, feed_identifier, channel')
        .eq('node_id', node.id)
        .eq('port_number', portNum)
        .maybeSingle()
      if (data) {
        if (data.output_port_label) return data.output_port_label
        const baseType = (data.source_type || '').replace(/_/g, ' ')
        const typeName = baseType ? (baseType.charAt(0).toUpperCase() + baseType.slice(1)) : 'Source'
        let label = typeName
        if (data.feed_identifier) label += ` ${data.feed_identifier}`
        if (Number(data.channel) === 1) label += ' L'
        if (Number(data.channel) === 2) label += ' R'
        return label.trim()
      }
    } catch {}
    return ''
  }

  if (type === 'source') {
    if (portNum === null || portNum === undefined) return ''
    const outCount = node?.num_outputs || node?.outputs || 0
    const base = getBaseName(node)
    if (outCount === 2) {
      if (portNum === 1) return `${base} L`
      if (portNum === 2) return `${base} R`
      return `${base} ${portNum}`
    }
    return base
  }

  if (type === 'recorder') {
    // For recorders, trace back to find what's feeding this track (output port)
    // This allows us to show the original source name instead of just "Track X"
    return await resolveRecorderTrackLabel(node, portNum, graph)
  }

  if (type === 'transformer') {
    return await resolveTransformerInputLabel(node, portNum, graph)
  }

  return `Output ${portNum}`
}

// Resolve the label that appears on a transformer's INPUT N by looking upstream
export async function resolveTransformerInputLabel(transformerNode, inputNum, graph, visited = new Set()) {
  // console.log('[SignalMapper][Labels] resolveTransformerInputLabel:start', { transformer_id: transformerNode?.id, inputNum })
  if (!transformerNode || visited.has(transformerNode.id)) return `Input ${inputNum}`
  visited.add(transformerNode.id)

  // Check parents of this transformer
  const parents = graph.parentsByToNode[transformerNode.id] || []
  if (!parents.length) return `Input ${inputNum}`

  // Prefer parent connections that have port maps for this input
  const mappedParent = parents.find(p => (graph.mapsByConnId[p.id] || []).some(m => Number(m.to_port) === Number(inputNum)))
  if (mappedParent) {
    const row = (graph.mapsByConnId[mappedParent.id] || []).find(m => Number(m.to_port) === Number(inputNum))
    if (row) {
      const upstreamNode = graph.nodeMap[mappedParent.from_node_id]
      if (!upstreamNode) return `Input ${inputNum}`
      // If upstream is transformer, recurse with from_port; otherwise ask for upstream node's output label
      const upstreamType = getNodeType(upstreamNode)
      if (upstreamType === 'transformer') {
        return await resolveTransformerInputLabel(upstreamNode, row.from_port, graph, visited)
      }
      const lbl = await getOutputLabel(upstreamNode, row.from_port, graph)
      // console.log('[SignalMapper][Labels] resolveTransformerInputLabel:map-hit', { transformer_id: transformerNode?.id, inputNum, upstream_id: upstreamNode?.id, from_port: row.from_port, label: lbl })
      return lbl
    }
  }

  // No port map: find a parent with input_number === inputNum
  const directParent = parents.find(p => Number(p.input_number) === Number(inputNum))
  if (directParent) {
    const upstreamNode = graph.nodeMap[directParent.from_node_id]
    if (!upstreamNode) return `Input ${inputNum}`
    const upstreamType = getNodeType(upstreamNode)
    if (upstreamType === 'transformer') {
      // For 1:1 transformers, output N corresponds to input N
      return await resolveTransformerInputLabel(upstreamNode, inputNum, graph, visited)
    }
    // For sources/venue_sources/recorders
    return await getOutputLabel(upstreamNode, inferSourcePort(upstreamNode, inputNum, parents, directParent), graph)
  }

  // Fallback: trace from any parent (best-effort)
  const anyParent = parents[0]
  if (anyParent) {
    const upstreamNode = graph.nodeMap[anyParent.from_node_id]
    if (upstreamNode) {
      const upstreamType = getNodeType(upstreamNode)
      if (upstreamType === 'transformer') {
        return await resolveTransformerInputLabel(upstreamNode, anyParent.input_number || 1, graph, visited)
      }
      const lbl = await getOutputLabel(upstreamNode, anyParent.input_number || 1, graph)
      return lbl
    }
  }

  return `Input ${inputNum}`
}

function getBaseName(node) {
  const label = node?.label || ''
  const trackName = node?.track_name || ''
  const m = label.match(/^(.*) \(([A-Z0-9]+)\)$/)
  if (trackName) return trackName.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
  if (m) return m[1].replace(/\s*LR$/i, '').trim()
  return label.replace(/ \([\dA-Z]+\)\s*$/g, '').replace(/\s*LR$/i, '').trim()
}

// Infer which source output port corresponds to a transformer's input when no maps are present
function inferSourcePort(sourceNode, transformerInput, transformerParents, directParent) {
  const type = getNodeType(sourceNode)
  if (type === 'source') {
    const outCount = sourceNode?.num_outputs || sourceNode?.outputs || 0
    if (outCount === 2) {
      // multiple connections from same source to this transformer? Use order to derive L/R
      const siblings = transformerParents
        .filter(c => c.from_node_id === directParent.from_node_id && typeof c.input_number === 'number')
        .map(c => Number(c.input_number)).sort((a,b) => a - b)
      if (siblings.length >= 2) {
        const index = siblings.indexOf(Number(transformerInput))
        if (index >= 0) {
          return index === 0 ? 1 : 2
        }
        // If this input isn't among the connected siblings, fall back by parity
        return Number(transformerInput) % 2 === 1 ? 1 : 2
      }
      // fallback by parity
      return Number(transformerInput) % 2 === 1 ? 1 : 2
    }
    return 1
  }
  // For recorders, transformers, and venue_sources: output port N corresponds to input N (1:1 pass-through)
  if (type === 'recorder') return transformerInput
  if (type === 'transformer') return transformerInput
  if (type === 'venue_sources') return transformerInput
  return transformerInput
}

// Hydrate a venue_sources node's output_port_labels from venue_source_feeds
export async function hydrateVenueLabels(node, ports = null) {
  const type = getNodeType(node)
  if (type !== 'venue_sources') return
  const total = node?.num_outputs || node?.outputs || 0
  const needed = ports && ports.length ? ports : (total ? Array.from({ length: total }, (_, i) => i + 1) : [])
  const existing = node.output_port_labels || {}
  const missing = needed.filter(p => !existing[String(p)] && !existing[p])
  if (!missing.length) return
  try {
    const { data } = await supabase
      .from('venue_source_feeds')
      .select('port_number, output_port_label, source_type, feed_identifier, channel')
      .eq('node_id', node.id)
      .in('port_number', missing)
    if (!data || !data.length) return
    const merged = { ...existing }
    data.forEach(f => {
      if (f.output_port_label && f.output_port_label.trim()) {
        merged[String(f.port_number)] = f.output_port_label.trim()
      } else {
        const baseType = (f.source_type || '').replace(/_/g, ' ')
        const typeName = baseType ? (baseType.charAt(0).toUpperCase() + baseType.slice(1)) : 'Source'
        let name = typeName
        if (f.feed_identifier) name += ` ${f.feed_identifier}`
        if (Number(f.channel) === 1) name += ' L'
        if (Number(f.channel) === 2) name += ' R'
        merged[String(f.port_number)] = name
      }
    })
    await supabase.from('nodes').update({ output_port_labels: merged }).eq('id', node.id)
    node.output_port_labels = merged
  } catch {}
}

// Resolve the label for a recorder's track (output port) by tracing back to the original source
async function resolveRecorderTrackLabel(recorderNode, trackNum, graph, visited = new Set()) {
  if (!recorderNode || visited.has(recorderNode.id)) return `Track ${trackNum}`
  visited.add(recorderNode.id)

  // Find connections TO this recorder that use this track number
  const parents = graph.parentsByToNode[recorderNode.id] || []
  
  // Check for port-mapped connections first
  let trackConn = null
  for (const parent of parents) {
    const portMaps = graph.mapsByConnId[parent.id] || []
    const matchingMap = portMaps.find(m => Number(m.to_port) === Number(trackNum))
    if (matchingMap) {
      trackConn = { ...parent, _mappedFromPort: matchingMap.from_port }
      break
    }
  }
  
  // If no port-mapped connection, check direct connections
  if (!trackConn) {
    trackConn = parents.find(p => Number(p.input_number) === Number(trackNum) || Number(p.track_number) === Number(trackNum))
  }
  
  if (!trackConn) return `Track ${trackNum}`
  
  // Get the source node
  const sourceNodeId = trackConn.from_node_id
  const sourceNode = graph.nodeMap[sourceNodeId]
  if (!sourceNode) return `Track ${trackNum}`
  
  // Determine which port on the source to trace from
  let sourcePort = trackConn._mappedFromPort
  if (sourcePort === undefined) {
    // For direct connections, try to infer the source port
    sourcePort = trackConn.output_number || trackConn.input_number || trackNum
  }
  
  const sourceType = getNodeType(sourceNode)
  
  // If source is another recorder, recursively trace
  if (sourceType === 'recorder') {
    return await resolveRecorderTrackLabel(sourceNode, sourcePort, graph, visited)
  }
  
  // For other source types, get their output label
  return await getOutputLabel(sourceNode, sourcePort, graph)
}


