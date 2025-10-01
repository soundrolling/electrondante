// src/stores/patchBayStore.js
import { defineStore } from 'pinia'
import { supabase }    from '@/supabase'

export const usePatchBayStore = defineStore('patchBay', {
  state: () => ({
    layouts:       [],
    currentLayout: null,
    nodes:         [],
    connections:   [],
    realtime:      null,
    gearList:      [],
  }),

  getters: {
    getNodeById:     state => id   => state.nodes.find(n => n.id === id),
    currentLayoutId: state =>     state.currentLayout ? state.currentLayout.id : null,
    getGearById:     state => id   => state.gearList.find(g => g.id === id),
  },

  actions: {
    updateNodePositionInStore(nodeId, x, y) {
      const node = this.nodes.find(n => n.id === nodeId)
      if (node) { node.x = x; node.y = y }
    },

    // --- Gear list ---
    async fetchGearList(projectId) {
      if (!projectId) { this.gearList = []; return }
      const { data, error } = await supabase
        .from('gear_table')
        .select('id, gear_name, num_inputs, num_outputs, gear_type')
        .eq('project_id', projectId)
        .order('gear_name')
      if (error) {
        console.error("Error fetching gear list:", error.message)
        this.gearList = []
      } else {
        this.gearList = (data||[]).map(g=>({
          id:           g.id,
          name:         g.gear_name,
          numinputs:    Number(g.num_inputs)||0,
          num_outputs:  Number(g.num_outputs)||0,
          gear_type:    g.gear_type
        }))
      }
    },

    // --- Layouts & realtime subscriptions ---
    async loadLayouts(projectId, venueId) {
      if (!projectId||!venueId) { this.layouts = []; return }
      const { data, error } = await supabase
        .from('locations')
        .select('id, stage_name')
        .eq('project_id', projectId)
        .eq('venue_id', venueId)
        .order('stage_name')
      if (error) {
        console.error("Error loading layouts:", error.message)
        this.layouts = []
      } else {
        this.layouts = data
      }
    },

    clearLayout() {
      if (this.realtime) {
        supabase.removeChannel(this.realtime).then()
        this.realtime = null
      }
      this.currentLayout = null
      this.nodes        = []
      this.connections  = []
    },

    async selectLayout(layout) {
      if (!layout?.id) { this.clearLayout(); return }
      if (this.realtime) {
        await supabase.removeChannel(this.realtime)
        this.realtime = null
      }
      this.currentLayout = layout
      await Promise.all([
        this.fetchNodes(layout.id),
        this.fetchConnections(layout.id)
      ])
      this.realtime = supabase
        .channel(`patchbay-${layout.id}`)
        .on('postgres_changes',
          { event:'*', schema:'public', table:'patch_nodes',  filter:`location_id=eq.${layout.id}` },
          payload => {
            const { eventType, new: n, old: o } = payload
            if (eventType==='INSERT') {
              this.nodes.push(this.coerceNode(n))
            }
            if (eventType==='UPDATE') {
              this.nodes = this.nodes.map(x => x.id===n.id ? this.coerceNode(n) : x)
            }
            if (eventType==='DELETE') {
              this.nodes = this.nodes.filter(x => x.id!==o.id)
            }
          })
        .on('postgres_changes',
          { event:'*', schema:'public', table:'patch_routes', filter:`location_id=eq.${layout.id}` },
          payload => {
            const { eventType, new: nr, old: or } = payload
            if (eventType==='INSERT') {
              this.connections.push(nr)
            }
            if (eventType==='UPDATE') {
              this.connections = this.connections.map(x => x.id===nr.id ? nr : x)
            }
            if (eventType==='DELETE') {
              this.connections = this.connections.filter(x => x.id!==or.id)
            }
          })
        .subscribe()
    },

    async fetchNodes(locationId) {
      const { data, error } = await supabase
        .from('patch_nodes')
        .select('*')
        .eq('location_id', locationId)
        .order('id')
      if (error) {
        console.error("Error fetching nodes:", error.message)
        this.nodes = []
      } else {
        this.nodes = data.map(this.coerceNode)
      }
    },

    async fetchConnections(locationId) {
      const { data, error } = await supabase
        .from('patch_routes')
        .select('*')
        .eq('location_id', locationId)
        .order('id')
      if (error) {
        console.error("Error fetching connections:", error.message)
        this.connections = []
      } else {
        this.connections = data
      }
    },

    coerceNode(raw) {
      let portMap = null
      if (raw.port_map) {
        try { portMap = typeof raw.port_map==='string' ? JSON.parse(raw.port_map) : raw.port_map }
        catch { console.warn(`Bad port_map on node ${raw.id}`) }
      }
      return {
        ...raw,
        numinputs:   Number(raw.numinputs)||0,
        num_outputs: Number(raw.num_outputs)||0,
        num_tracks:  Number(raw.num_tracks)||0,
        port_map:    portMap,
        x:           Number(raw.x)||0,
        y:           Number(raw.y)||0
      }
    },

    // trace ultimate source of any chain
    getSourceForNodeOutput(nodeId, visited=new Set()) {
      if (visited.has(nodeId)) return null
      visited.add(nodeId)
      const node = this.getNodeById(nodeId)
      if (!node) return null
      if (node.node_type==='source') return node.id
      const ups = this.connections.filter(c=>c.to_node===nodeId)
      for (const c of ups) {
        const src = c.source_node ?? this.getSourceForNodeOutput(c.from_node, visited)
        if (src) return src
      }
      return null
    },

    // NEW: Get all available upstream sources for a node (including through transformers)
    getAvailableUpstreamSources(nodeId, visited=new Set()) {
      if (visited.has(nodeId)) return []
      visited.add(nodeId)
      
      const node = this.getNodeById(nodeId)
      if (!node) return []
      
      // If this is a source node, return it
      if (node.node_type === 'source') {
        return [{
          key: `${node.id}-1`,
          label: node.label,
          sourceId: node.id,
          outputNumber: 1,
          nodeType: 'source'
        }]
      }
      
      // For transformers and recorders, get all upstream sources
      const upstreamSources = []
      const incomingConnections = this.connections.filter(c => c.to_node === nodeId)
      
      for (const conn of incomingConnections) {
        const upstreamNode = this.getNodeById(conn.from_node)
        if (!upstreamNode) continue
        
        if (upstreamNode.node_type === 'source') {
          // Direct source connection
          upstreamSources.push({
            key: `${upstreamNode.id}-${conn.output_number || 1}`,
            label: upstreamNode.label,
            sourceId: upstreamNode.id,
            outputNumber: conn.output_number || 1,
            nodeType: 'source',
            connectionId: conn.id
          })
        } else {
          // Recursive call to get sources through this upstream node
          const upstreamSourcesFromNode = this.getAvailableUpstreamSources(upstreamNode.id, new Set(visited))
          upstreamSources.push(...upstreamSourcesFromNode.map(source => ({
            ...source,
            connectionId: conn.id
          })))
        }
      }
      
      return upstreamSources
    },

    // NEW: Get all upstream sources for a specific output of a node
    getUpstreamSourcesForOutput(nodeId, outputNumber, visited=new Set()) {
      if (visited.has(nodeId)) return []
      visited.add(nodeId)
      
      const node = this.getNodeById(nodeId)
      if (!node) return []
      
      // Find connections from this output
      const outgoingConnections = this.connections.filter(c => 
        c.from_node === nodeId && c.output_number === outputNumber
      )
      
      const upstreamSources = []
      for (const conn of outgoingConnections) {
        const downstreamNode = this.getNodeById(conn.to_node)
        if (!downstreamNode) continue
        
        if (downstreamNode.node_type === 'source') {
          // This shouldn't happen in normal flow, but handle it
          upstreamSources.push({
            key: `${downstreamNode.id}-1`,
            label: downstreamNode.label,
            sourceId: downstreamNode.id,
            outputNumber: 1,
            nodeType: 'source'
          })
        } else {
          // Recursive call to get sources through this downstream node
          const sourcesFromDownstream = this.getAvailableUpstreamSources(downstreamNode.id, new Set(visited))
          upstreamSources.push(...sourcesFromDownstream)
        }
      }
      
      return upstreamSources
    },

    // NEW: Get signal flow path from source to destination
    getSignalFlowPath(sourceNodeId, destinationNodeId, visited=new Set()) {
      if (visited.has(destinationNodeId)) return null
      visited.add(destinationNodeId)
      
      const destination = this.getNodeById(destinationNodeId)
      if (!destination) return null
      
      // If we've reached the source, return the path
      if (destinationNodeId === sourceNodeId) {
        return [destination]
      }
      
      // Check incoming connections
      const incomingConnections = this.connections.filter(c => c.to_node === destinationNodeId)
      
      for (const conn of incomingConnections) {
        const upstreamNode = this.getNodeById(conn.from_node)
        if (!upstreamNode) continue
        
        const upstreamPath = this.getSignalFlowPath(sourceNodeId, upstreamNode.id, new Set(visited))
        if (upstreamPath) {
          return [...upstreamPath, destination]
        }
      }
      
      return null
    },

    // NEW: Get all signal flow paths for a recorder
    getSignalFlowPathsForRecorder(recorderNodeId) {
      const recorder = this.getNodeById(recorderNodeId)
      if (!recorder || recorder.node_type !== 'recorder') return []
      
      const paths = []
      const incomingConnections = this.connections.filter(c => c.to_node === recorderNodeId)
      
      for (const conn of incomingConnections) {
        const upstreamNode = this.getNodeById(conn.from_node)
        if (!upstreamNode) continue
        
        // Get all sources that flow through this upstream node
        const upstreamSources = this.getAvailableUpstreamSources(upstreamNode.id)
        
        for (const source of upstreamSources) {
          const path = this.getSignalFlowPath(source.sourceId, recorderNodeId)
          if (path) {
            paths.push({
              source: source,
              path: path,
              inputNumber: conn.input_number,
              outputNumber: conn.output_number,
              trackNumber: conn.track_number
            })
          }
        }
      }
      
      return paths
    },

    // NEW: Get available tracks for a recorder
    getAvailableTracksForRecorder(recorderNodeId) {
      const recorder = this.getNodeById(recorderNodeId)
      if (!recorder || recorder.node_type !== 'recorder') return []
      
      const usedTracks = this.connections
        .filter(c => c.to_node === recorderNodeId && c.track_number)
        .map(c => c.track_number)
      
      const availableTracks = []
      for (let i = 1; i <= recorder.num_tracks; i++) {
        if (!usedTracks.includes(i)) {
          availableTracks.push(i)
        }
      }
      
      return availableTracks
    },

    // NEW: Assign track to a recorder connection
    async assignTrackToConnection(connectionId, trackNumber) {
      const connection = this.connections.find(c => c.id === connectionId)
      if (!connection) throw new Error('Connection not found')
      
      await this.updateConnection({
        id: connection.id,
        from_node: connection.from_node,
        to_node: connection.to_node,
        source_node: connection.source_node,
        input_number: connection.input_number,
        output_number: connection.output_number
      })
    },

    // --- Node CRUD ---
    async addNode(n) {
      const { id, ...rest } = n
      const row = {
        ...rest,
        numinputs:   Number(rest.numinputs)||0,
        num_outputs: Number(rest.num_outputs)||0,
        num_tracks:  rest.node_type==='recorder'? Number(rest.num_tracks)||0 : 0,
        x:           Number(rest.x)||0,
        y:           Number(rest.y)||0,
        port_map:    rest.port_map? JSON.stringify(rest.port_map) : null
      }
      const { data, error } = await supabase
        .from('patch_nodes')
        .insert([row])
        .select().single()
      if (error) throw error
      const newNode = this.coerceNode(data)
      this.nodes.push(newNode)
      return newNode
    },

    async updateNode(n) {
      const { id, ...upd } = n
      const row = {}
      if (upd.numinputs   !== undefined) row.numinputs   = Number(upd.numinputs)
      if (upd.num_outputs !== undefined) row.num_outputs = Number(upd.num_outputs)
      if (upd.num_tracks  !== undefined) row.num_tracks  = upd.node_type==='recorder'
                                                       ? Number(upd.num_tracks)
                                                       : 0
      if (upd.x !== undefined) row.x = Number(upd.x)
      if (upd.y !== undefined) row.y = Number(upd.y)
      if (upd.node_type==='source') row.gear_id = null
      else if (upd.gear_id !== undefined) row.gear_id = upd.gear_id
      if (upd.port_map !== undefined) row.port_map = JSON.stringify(upd.port_map)
      const others = { ...upd }
      delete others.numinputs
      delete others.num_outputs
      delete others.num_tracks
      delete others.x
      delete others.y
      delete others.gear_id
      delete others.node_type
      delete others.port_map
      Object.assign(row, others)

      const { data, error } = await supabase
        .from('patch_nodes')
        .update(row)
        .eq('id', id)
        .select().single()
      if (error) throw error
      const updated = this.coerceNode(data)
      this.nodes = this.nodes.map(x => x.id===updated.id ? updated : x)
      return updated
    },

    async removeNode(id) {
      this.nodes = this.nodes.filter(n => n.id!==id)
      this.connections = this.connections.filter(c => c.from_node!==id && c.to_node!==id)
      await supabase.from('patch_routes').delete().or(`from_node.eq.${id},to_node.eq.${id}`)
      await supabase.from('patch_nodes').delete().eq('id', id)
    },

    // --- Connection CRUD ---
    async addConnection(link) {
      const payload = {
        project_id:     link.project_id,
        location_id:    link.location_id,
        from_node:      link.from_node,
        to_node:        link.to_node,
        source_node:    link.source_node_id,
        input_number:   link.input_number  ?? null,
        output_number:  link.output_number ?? null
      }
      const { data, error } = await supabase
        .from('patch_routes')
        .insert([payload])
        .select().single()
      if (error) throw error
      this.connections.push(data)
      return data
    },

    // <-- UPDATED: always re-send from_node, to_node, source_node -->
    async updateConnection({ id, from_node, to_node, source_node, input_number, output_number }) {
      const payload = {
        from_node,
        to_node,
        source_node,
        input_number:  input_number  ?? null,
        output_number: output_number ?? null
      }
      const { data, error } = await supabase
        .from('patch_routes')
        .update(payload)
        .eq('id', id)
        .select().single()
      if (error) throw error
      this.connections = this.connections.map(x => x.id===data.id ? data : x)
      return data
    },

    async removeConnection(id) {
      this.connections = this.connections.filter(c => c.id!==id)
      await supabase.from('patch_routes').delete().eq('id',id)
    },

    async setConnectionsForNode(fromNodeId, mappings, projectId) {
      await supabase
        .from('patch_routes')
        .delete()
        .eq('from_node', fromNodeId)
        .eq('location_id', this.currentLayout.id)

      for (const m of mappings) {
        const src = this.getSourceForNodeOutput(fromNodeId) || fromNodeId
        await this.addConnection({
          project_id:     projectId,
          location_id:    this.currentLayout.id,
          from_node:      fromNodeId,
          to_node:        m.toNodeId,
          source_node_id: src,
          input_number:   m.input_number,
          output_number:  m.output_number
        })
      }
      await this.fetchConnections(this.currentLayout.id)
    },

    async replaceIncomingConnectionsForNode(toNodeId, mappings, projectId) {
      await supabase
        .from('patch_routes')
        .delete()
        .eq('to_node', toNodeId)
        .eq('location_id', this.currentLayout.id)

      for (const m of mappings) {
        const payload = {
          project_id:    projectId,
          location_id:   this.currentLayout.id,
          from_node:     m.source_node_id,
          to_node:       toNodeId,
          source_node:   m.source_node_id,
          input_number:  m.input_number,
          output_number: m.output_number
        }
        const { error } = await supabase
          .from('patch_routes')
          .insert([payload])
        if (error) throw error
      }
      await this.fetchConnections(this.currentLayout.id)
    },

    // NEW: Simple link between nodes (without detailed port mappings)
    async createSimpleLink(fromNodeId, toNodeId, projectId, locationId) {
      // Check if a link already exists between these nodes
      const existingLink = this.connections.find(
        c => c.from_node === fromNodeId && c.to_node === toNodeId
      )
      
      if (existingLink) {
        console.log('Link already exists between these nodes')
        return existingLink
      }
      
      // Create a simple link with default values
      const payload = {
        project_id:     projectId,
        location_id:    locationId,
        from_node:      fromNodeId,
        to_node:        toNodeId,
        source_node:    this.getSourceForNodeOutput(fromNodeId) || fromNodeId,
        input_number:   null, // Will be configured later
        output_number:  null  // Will be configured later
      }
      
      const { data, error } = await supabase
        .from('patch_routes')
        .insert([payload])
        .select().single()
      
      if (error) throw error
      this.connections.push(data)
      return data
    },

    // NEW: Remove simple link between nodes
    async removeSimpleLink(fromNodeId, toNodeId) {
      const link = this.connections.find(
        c => c.from_node === fromNodeId && c.to_node === toNodeId
      )
      
      if (link) {
        await this.removeConnection(link.id)
      }
    },

    // NEW: Get all simple links for a node
    getSimpleLinksForNode(nodeId) {
      return this.connections.filter(
        c => c.from_node === nodeId || c.to_node === nodeId
      )
    },

    // NEW: Get all upstream sources for a node (including through transformers)
    getUpstreamSourcesForNode(nodeId, visited = new Set()) {
      if (visited.has(nodeId)) return []
      visited.add(nodeId)
      
      const node = this.getNodeById(nodeId)
      if (!node) return []
      
      // If this is a source node, return it
      if (node.node_type === 'source') {
        return [{
          sourceId: node.id,
          sourceLabel: node.label,
          nodeType: 'source',
          path: [node]
        }]
      }
      
      // For transformers and recorders, get all upstream sources
      const upstreamSources = []
      const incomingConnections = this.connections.filter(c => c.to_node === nodeId)
      
      for (const conn of incomingConnections) {
        const upstreamNode = this.getNodeById(conn.from_node)
        if (!upstreamNode) continue
        
        if (upstreamNode.node_type === 'source') {
          // Direct source connection
          upstreamSources.push({
            sourceId: upstreamNode.id,
            sourceLabel: upstreamNode.label,
            nodeType: 'source',
            path: [upstreamNode, node],
            connectionId: conn.id,
            inputNumber: conn.input_number,
            outputNumber: conn.output_number
          })
        } else {
          // Recursive call to get sources through this upstream node
          const upstreamSourcesFromNode = this.getUpstreamSourcesForNode(upstreamNode.id, new Set(visited))
          upstreamSources.push(...upstreamSourcesFromNode.map(source => ({
            ...source,
            path: [...source.path, node],
            connectionId: conn.id,
            inputNumber: conn.input_number,
            outputNumber: conn.output_number
          })))
        }
      }
      
      return upstreamSources
    },

    // NEW: Get signal flow summary for a node
    getSignalFlowSummaryForNode(nodeId) {
      const node = this.getNodeById(nodeId)
      if (!node) return null
      
      const upstreamSources = this.getUpstreamSourcesForNode(nodeId)
      
      return {
        nodeId: node.id,
        nodeLabel: node.label,
        nodeType: node.node_type,
        upstreamSources: upstreamSources,
        totalSources: upstreamSources.length
      }
    },

    // NEW: Get all signal flow paths from sources to a specific node
    getSignalFlowPathsToNode(nodeId) {
      const node = this.getNodeById(nodeId)
      if (!node) return []
      
      const paths = []
      const upstreamSources = this.getUpstreamSourcesForNode(nodeId)
      
      for (const source of upstreamSources) {
        paths.push({
          source: source,
          destination: node,
          path: source.path,
          connectionId: source.connectionId,
          inputNumber: source.inputNumber,
          outputNumber: source.outputNumber
        })
      }
      
      return paths
    },

    // NEW: Get upstream sources for a specific connection
    getUpstreamSourcesForConnection(fromNodeId, toNodeId) {
      const fromNode = this.getNodeById(fromNodeId)
      const toNode = this.getNodeById(toNodeId)
      
      if (!fromNode || !toNode) return []
      
      // Get all upstream sources for the from node
      const fromNodeSources = this.getUpstreamSourcesForNode(fromNodeId)
      
      // Include all sources whose path passes through both fromNodeId and toNodeId in order
      return fromNodeSources.filter(source => {
        if (!source.path) return false
        const fromIdx = source.path.findIndex(n => n.id === fromNodeId)
        const toIdx = source.path.findIndex(n => n.id === toNodeId)
        return fromIdx !== -1 && toIdx !== -1 && fromIdx < toIdx
      })
    },

    // NEW: Save detailed port mapping for a connection
    async savePortMapping(connectionId, sourceMappings) {
      try {
        // Update the connection with the port mappings
        const connection = this.connections.find(c => c.id === connectionId)
        if (!connection) {
          throw new Error('Connection not found')
        }
        
        // Update connection with port mapping data
        connection.source_mappings = sourceMappings
        
        // Save to database
        const { error } = await supabase
          .from('patch_connections')
          .update({ 
            source_mappings: sourceMappings,
            updated_at: new Date().toISOString()
          })
          .eq('id', connectionId)
        
        if (error) throw error
        
        // Update local state
        this.updateConnection(connectionId, { source_mappings: sourceMappings })
        
        return true
      } catch (error) {
        console.error('Failed to save port mapping:', error)
        throw error
      }
    },

    // NEW: Get source mappings for a connection
    getSourceMappings(connectionId) {
      const connection = this.connections.find(c => c.id === connectionId)
      return connection?.source_mappings || []
    },

    // NEW: Update source mapping for a specific source
    updateSourceMapping(connectionId, sourceId, mapping) {
      const connection = this.connections.find(c => c.id === connectionId)
      if (!connection) return false
      
      if (!connection.source_mappings) {
        connection.source_mappings = []
      }
      
      const existingIndex = connection.source_mappings.findIndex(m => m.sourceId === sourceId)
      if (existingIndex >= 0) {
        connection.source_mappings[existingIndex] = { ...connection.source_mappings[existingIndex], ...mapping }
      } else {
        connection.source_mappings.push({ sourceId, ...mapping })
      }
      
      return true
    },

    // NEW: Get enhanced signal flow with transformer details
    getEnhancedSignalFlow() {
      const flows = []
      
      // Get all sources
      const sources = this.nodes.filter(n => n.node_type === 'source')
      
      sources.forEach(source => {
        const sourceFlow = {
          sourceId: source.id,
          sourceLabel: source.label,
          targets: []
        }
        
        // Get all recorders
        const recorders = this.nodes.filter(n => n.node_type === 'recorder')
        
        recorders.forEach(recorder => {
          const signalPaths = this.getSignalFlowPathsForRecorder(recorder.id)
          const sourcePaths = signalPaths.filter(path => path.source.sourceId === source.id)
          
          sourcePaths.forEach(path => {
            // Extract transformers from the path
            const transformers = path.path
              .filter(node => node.node_type === 'transformer')
              .map(transformer => {
                // Find connections involving this transformer
                const transformerConnections = this.connections.filter(c => 
                  c.from_node === transformer.id || c.to_node === transformer.id
                )
                
                return {
                  id: transformer.id,
                  label: transformer.label,
                  connections: transformerConnections.map(conn => ({
                    inputNumber: conn.input_number,
                    outputNumber: conn.output_number,
                    isInput: conn.to_node === transformer.id,
                    isOutput: conn.from_node === transformer.id
                  }))
                }
              })
            
            sourceFlow.targets.push({
              recorderId: recorder.id,
              recorderLabel: recorder.label,
              track: path.trackNumber || '—',
              path: path.path.map(n => n.label).join(' → '),
              transformers: transformers,
              inputNumber: path.inputNumber,
              outputNumber: path.outputNumber,
              connectionId: path.connectionId
            })
          })
        })
        
        if (sourceFlow.targets.length > 0) {
          flows.push(sourceFlow)
        }
      })
      
      return flows
    },

    // NEW: Get detailed transformer information for a signal path
    getTransformerDetailsForPath(path) {
      const transformers = path.filter(node => node.node_type === 'transformer')
      
      return transformers.map(transformer => {
        const incomingConnections = this.connections.filter(c => c.to_node === transformer.id)
        const outgoingConnections = this.connections.filter(c => c.from_node === transformer.id)
        
        return {
          id: transformer.id,
          label: transformer.label,
          inputs: incomingConnections.map(conn => ({
            inputNumber: conn.input_number,
            fromNode: this.getNodeById(conn.from_node)?.label || 'Unknown'
          })),
          outputs: outgoingConnections.map(conn => ({
            outputNumber: conn.output_number,
            toNode: this.getNodeById(conn.to_node)?.label || 'Unknown'
          }))
        }
      })
    },

    // NEW: Get all output connections from a transformer
    getTransformerOutputConnections(transformerId) {
      return this.connections.filter(c => c.from_node === transformerId)
    },

    // NEW: Get all input connections to a transformer
    getTransformerInputConnections(transformerId) {
      return this.connections.filter(c => c.to_node === transformerId)
    },

    // NEW: Get complete signal flow through a transformer
    getSignalFlowThroughTransformer(transformerId) {
      const transformer = this.getNodeById(transformerId)
      if (!transformer || transformer.node_type !== 'transformer') return []
      
      const inputConnections = this.getTransformerInputConnections(transformerId)
      const outputConnections = this.getTransformerOutputConnections(transformerId)
      
      const flows = []
      
      // For each input, find all sources that feed into it
      inputConnections.forEach(inputConn => {
        const inputSources = this.getAvailableUpstreamSources(inputConn.from_node)
        
        // For each output, create a flow
        outputConnections.forEach(outputConn => {
          inputSources.forEach(source => {
            flows.push({
              source: source,
              inputNumber: inputConn.input_number,
              outputNumber: outputConn.output_number,
              toNode: this.getNodeById(outputConn.to_node),
              path: [source, transformer, this.getNodeById(outputConn.to_node)]
            })
          })
        })
      })
      
      return flows
    },
  }
})