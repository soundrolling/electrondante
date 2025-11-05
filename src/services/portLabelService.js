// src/services/portLabelService.js
import { supabase } from '../supabase'
import { getNodeType } from './signalGraph'

// Get the human label for a node's OUTPUT port.
// graph is the object from buildGraph() in signalGraph.js
export async function getOutputLabel(node, portNum, graph) {
  const type = getNodeType(node)

  // Prefer stored output labels if available (works for venue_sources and custom sources)
  if (node?.output_port_labels && typeof node.output_port_labels === 'object') {
    const stored = node.output_port_labels[String(portNum)] || node.output_port_labels[portNum]
    if (stored) return stored
  }

  if (type === 'venue_sources') {
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
    return `Output ${portNum}`
  }

  if (type === 'source') {
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
    return `Track ${portNum}`
  }

  if (type === 'transformer') {
    return await resolveTransformerInputLabel(node, portNum, graph)
  }

  return `Output ${portNum}`
}

// Resolve the label that appears on a transformer's INPUT N by looking upstream
export async function resolveTransformerInputLabel(transformerNode, inputNum, graph, visited = new Set()) {
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
      return await getOutputLabel(upstreamNode, row.from_port, graph)
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
      return await getOutputLabel(upstreamNode, anyParent.input_number || 1, graph)
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
        return index === 0 ? 1 : 2
      }
      // fallback by parity
      return Number(transformerInput) % 2 === 1 ? 1 : 2
    }
    return 1
  }
  if (type === 'recorder') return transformerInput
  if (type === 'venue_sources') return transformerInput
  return transformerInput
}


