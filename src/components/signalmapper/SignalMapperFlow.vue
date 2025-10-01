<template>
<div class="signal-flow-container">
  <!-- Loading and Error States -->
  <div v-if="loadingNodes || loadingConnections" class="loading-state">
    <div class="loading-indicator">
      <p>Loading signal flow data...</p>
      <div class="loading-spinner"></div>
    </div>
  </div>
  
  <div v-else-if="error" class="error-state">
    <div class="error-indicator">
      <p>Error loading signal flow data: {{ error }}</p>
      <button @click="loadFlowData" class="retry-btn">Retry</button>
    </div>
  </div>
  
  <div v-else>
    <!-- Signal Flow Controls -->
    <div class="flow-controls">
      <div class="control-group">
        <h4>Signal Flow Tools</h4>
        <div class="tool-buttons">
          <button 
            @click="setLinkMode(!linkMode)" 
            :class="{ active: linkMode }"
            class="tool-btn"
          >
            🔗 Link Mode
          </button>
          <button @click="openMatrixMapper" class="tool-btn">🔀 Matrix</button>
          <button @click="assignTracks" class="tool-btn">🎚️ Tracks</button>
          <button @click="highlightSignalPath" class="tool-btn">🔍 Trace</button>
          <button @click="clearHighlights" class="tool-btn">❌ Clear</button>
          <button @click="exportSignalFlow" class="tool-btn">📄 Export</button>
        </div>
      </div>

      <!-- Link Mode Status -->
      <div v-if="linkMode" class="link-mode-status">
        <div class="status-indicator">
          <span class="status-icon">🔗</span>
          <span class="status-text">
            {{ linkSourceNodeId ? 'Click another node to connect' : 'Click a node to start connection' }}
          </span>
          <button @click="setLinkMode(false)" class="cancel-link-btn">Cancel</button>
        </div>
      </div>
    </div>

    <!-- Signal Flow Visualization -->
    <div class="flow-visualization">
      <div class="flow-header">
        <h4>Signal Flow Overview</h4>
        <div class="flow-stats">
          <span>Sources: {{ sourceCount }}</span>
          <span>Transformers: {{ transformerCount }}</span>
          <span>Recorders: {{ recorderCount }}</span>
          <span>Connections: {{ connectionCount }}</span>
        </div>
      </div>

      <!-- Enhanced Signal Flow Display -->
      <div class="enhanced-flows">
        <div v-if="enhancedFlows.length === 0" class="no-flows">
          <p>No signal flows found. Add sources, transformers, and recorders to see signal flow tracking.</p>
        </div>
        
        <div v-else class="flow-list">
          <div v-for="(flow, idx) in enhancedFlows" :key="idx" class="flow-item">
            <div class="flow-source">
              <span class="source-icon">🎤</span>
              <span class="source-label">{{ flow.sourceLabel }}</span>
            </div>
            
            <div class="flow-targets">
              <div v-for="(target, j) in flow.targets" :key="j" class="target-item">
                <div class="target-header">
                  <span class="target-icon">📼</span>
                  <span class="target-label">{{ target.recorderLabel }}</span>
                  <span class="track-info">(Track {{ target.track }})</span>
                </div>
                
                <div v-if="target.transformers.length > 0" class="transformers-path">
                  <div class="path-label">Transformers:</div>
                  <div v-for="(transformer, k) in target.transformers" :key="k" class="transformer-item">
                    <span class="transformer-icon">⚡</span>
                    <span class="transformer-label">{{ transformer.label }}</span>
                    <span v-if="transformer.inputOutput" class="io-info">
                      ({{ transformer.inputOutput }})
                    </span>
                  </div>
                </div>
                
                <div v-if="target.path" class="full-path">
                  <span class="path-label">Path:</span>
                  <span class="path-text">{{ target.path }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Connection Management -->
    <div class="connection-management">
      <h4>Connection Management</h4>
      
      <div class="connection-list">
        <div v-if="connections.length === 0" class="no-connections">
          <p>No connections yet. Use Link Mode to connect gear.</p>
        </div>
        
        <div v-else class="connections">
          <div v-for="conn in connections" :key="conn.id" class="connection-item">
            <div class="connection-info">
              <div class="connection-nodes">
                <span class="from-node">{{ getNodeLabel(conn.from) }}</span>
                <span class="connection-arrow">→</span>
                <span class="to-node">{{ getNodeLabel(conn.to) }}</span>
              </div>
              <div class="connection-details">
                <span v-if="conn.input_number">In: {{ conn.input_number }}</span>
                <span v-if="conn.track_number">Track: {{ conn.track_number }}</span>
              </div>
            </div>
            <div class="connection-actions">
              <button @click="editConnection(conn)" class="edit-btn">✏️</button>
              <button @click="removeConnection(conn.id)" class="delete-btn">🗑️</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Track Assignment Modal -->
    <transition name="fade">
      <div v-if="showTrackAssignModal" class="modal-backdrop">
        <div class="modal-content track-assign-modal">
          <h3>Assign Tracks ({{ trackAssignNode?.label }})</h3>
          <div class="track-assignments">
            <div v-for="track in (trackAssignNode?.num_tracks || 1)" :key="track" class="track-item">
              <label>Track {{ track }}:</label>
              <select v-model="trackAssignmentsDraft[track]">
                <option value="">-- Unassigned --</option>
                <option v-for="input in getAvailableInputs(trackAssignNode)" :key="input" :value="input">
                  Input {{ input }} ({{ getInputSourceLabel(input) }})
                </option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="confirmTrackAssignments" class="btn btn-success">Save</button>
            <button @click="closeTrackAssignModal" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </transition>

    <!-- Signal Path Highlight Modal -->
    <transition name="fade">
      <div v-if="showPathHighlightModal" class="modal-backdrop">
        <div class="modal-content path-highlight-modal">
          <h3>Trace Signal Path</h3>
          <div class="path-options">
            <div class="option-group">
              <label>From Source:</label>
              <select v-model="selectedSourceId">
                <option value="">-- Select Source --</option>
                <option v-for="source in sourceNodes" :key="source.id" :value="source.id">
                  {{ source.label }}
                </option>
              </select>
            </div>
            <div class="option-group">
              <label>To Recorder:</label>
              <select v-model="selectedRecorderId">
                <option value="">-- Select Recorder --</option>
                <option v-for="recorder in recorderNodes" :key="recorder.id" :value="recorder.id">
                  {{ recorder.label }}
                </option>
              </select>
            </div>
          </div>
          <div class="modal-actions">
            <button @click="tracePath" class="btn btn-primary">Trace Path</button>
            <button @click="closePathHighlightModal" class="btn btn-secondary">Cancel</button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue';
import { useGraphStore } from '@/stores/graphStore'
import { getNodes, getConnections, deleteConnection } from '@/services/signalMapperService'

export default {
name: 'SignalMapperFlow',
props: {
  gearList: Array,
  currentLocation: Object,
  canvas: Object,
  ctx: Object,
  mapImage: Object,
  canvasWidth: Number,
  canvasHeight: Number,
  imageOffsetX: Number,
  imageOffsetY: Number,
  scaleFactor: Number,
  projectId: {
    type: [String, Number],
    required: true
  }
},
emits: [
  'add-connection',
  'remove-connection',
  'update-connection',
  'assign-tracks',
  'highlight-path',
  'clear-highlight',
  'export-signal-flow'
],
setup(props, { emit }) {
  const linkMode = ref(false);
  const linkSourceNodeId = ref(null);
  const enhancedFlows = ref([]);
  const showTrackAssignModal = ref(false);
  const trackAssignNode = ref(null);
  const trackAssignmentsDraft = ref({});
  const showPathHighlightModal = ref(false);
  const selectedSourceId = ref('');
  const selectedRecorderId = ref('');

  // Loading states
  const loadingNodes = ref(false);
  const loadingConnections = ref(false);
  const error = ref(null);

  // Data from Supabase
  const nodesData = ref([]);
  const connectionsData = ref([]);

  // Use the graphStore for Signal Mapper only (no longer shared with PatchBay)
  const graphStore = useGraphStore()

  // Load data from Supabase
  async function loadFlowData() {
    if (!props.projectId) return
    
    loadingNodes.value = true;
    loadingConnections.value = true;
    error.value = null;
    
    try {
      // Load nodes and connections from Supabase
      const [nodes, connections] = await Promise.all([
        getNodes(props.projectId),
        getConnections(props.projectId)
      ]);
      
      nodesData.value = nodes;
      connectionsData.value = connections;
    } catch (err) {
      console.error('Error loading flow data:', err);
      error.value = err.message || 'Failed to load flow data';
    } finally {
      loadingNodes.value = false;
      loadingConnections.value = false;
    }
  }

  // Defensive computed properties with fallback to graph store
  const nodes = computed(() => {
    const supabaseNodes = nodesData.value || [];
    const storeNodes = (graphStore && Array.isArray(graphStore.nodes)) ? graphStore.nodes : [];
    
    if (Array.isArray(supabaseNodes) && supabaseNodes.length > 0) {
      return supabaseNodes;
    }
    return storeNodes;
  });

  const connections = computed(() => {
    const supabaseConnections = connectionsData.value || [];
    const storeConnections = (graphStore && Array.isArray(graphStore.connections)) ? graphStore.connections : [];
    
    if (Array.isArray(supabaseConnections) && supabaseConnections.length > 0) {
      return supabaseConnections;
    }
    return storeConnections;
  });

  // Computed properties
  const sourceNodes = computed(() => 
    nodes.value.filter(n => (n.node_type || n.gearType) === 'source')
  );

  const transformerNodes = computed(() => 
    nodes.value.filter(n => (n.node_type || n.gearType) === 'transformer')
  );

  const recorderNodes = computed(() => 
    nodes.value.filter(n => (n.node_type || n.gearType) === 'recorder')
  );

  const sourceCount = computed(() => sourceNodes.value.length);
  const transformerCount = computed(() => transformerNodes.value.length);
  const recorderCount = computed(() => recorderNodes.value.length);
  const connectionCount = computed(() => connections.value.length);

  // Methods
  function setLinkMode(enabled) {
    linkMode.value = enabled;
    linkSourceNodeId.value = null;
    // Clear selections
    nodes.value.forEach(node => {
      node.selected = false;
    });
  }

  function openMatrixMapper() {
    // This would open the matrix port mapper modal
    // Implementation would be in parent component
  }

  function assignTracks() {
    // Find a recorder node to assign tracks to
    const recorder = recorderNodes.value[0];
    if (recorder) {
      trackAssignNode.value = recorder;
      trackAssignmentsDraft.value = {};
      showTrackAssignModal.value = true;
    } else {
      alert('No recorder nodes found. Add a recorder first.');
    }
  }

  function getAvailableInputs(node) {
    if (!node) return [];
    return Array.from({ length: node.num_inputs || node.numinputs || 1 }, (_, i) => i + 1);
  }

  function getInputSourceLabel(inputNumber) {
    // Find the connection that goes to this input
    const connection = connections.value.find(c => 
      (c.to_node_id === trackAssignNode.value?.id || c.to === trackAssignNode.value?.id) && c.input_number === inputNumber
    );
    
    if (connection) {
      const sourceNode = nodes.value.find(n => n.id === (connection.from_node_id || connection.from));
      return sourceNode ? sourceNode.label : 'Unknown';
    }
    
    return 'Unassigned';
  }

  function confirmTrackAssignments() {
    emit('assign-tracks', trackAssignNode.value.id, trackAssignmentsDraft.value);
    closeTrackAssignModal();
  }

  function closeTrackAssignModal() {
    showTrackAssignModal.value = false;
    trackAssignNode.value = null;
    trackAssignmentsDraft.value = {};
  }

  function highlightSignalPath() {
    if (sourceNodes.value.length === 0 || recorderNodes.value.length === 0) {
      alert('Need at least one source and one recorder to trace signal path.');
      return;
    }
    
    showPathHighlightModal.value = true;
  }

  function tracePath() {
    if (!selectedSourceId.value || !selectedRecorderId.value) {
      alert('Please select both source and recorder.');
      return;
    }
    
    const path = findSignalPath(selectedSourceId.value, selectedRecorderId.value);
    if (path) {
      emit('highlight-path', path);
    } else {
      alert('No signal path found between selected nodes.');
    }
    
    closePathHighlightModal();
  }

  function closePathHighlightModal() {
    showPathHighlightModal.value = false;
    selectedSourceId.value = '';
    selectedRecorderId.value = '';
  }

  function clearHighlights() {
    emit('clear-highlight');
  }

  function exportSignalFlow() {
    emit('export-signal-flow');
  }

  function getNodeLabel(nodeId) {
    const node = nodes.value.find(n => n.id === nodeId);
    return node ? node.label : 'Unknown';
  }

  function editConnection(connection) {
    // This would open the connection details modal
    // Implementation would be in parent component
  }

  async function removeConnection(connectionId) {
    if (confirm('Delete this connection?')) {
      try {
        await deleteConnection(connectionId);
        // Remove from local state
        const index = connectionsData.value.findIndex(c => c.id === connectionId);
        if (index !== -1) {
          connectionsData.value.splice(index, 1);
        }
        emit('remove-connection', connectionId);
      } catch (err) {
        console.error('Error deleting connection:', err);
        alert('Failed to delete connection: ' + err.message);
      }
    }
  }

  function findSignalPath(sourceId, recorderId) {
    // Simple path finding algorithm
    const visited = new Set();
    const queue = [{ node: sourceId, path: [sourceId], connections: [] }];
    
    while (queue.length > 0) {
      const { node, path, connections } = queue.shift();
      
      if (node === recorderId) {
        return { nodes: path, connections };
      }
      
      if (visited.has(node)) continue;
      visited.add(node);
      
      // Find all connections from this node
      const outgoingConnections = connections.value.filter(c => 
        (c.from_node_id || c.from) === node
      );
      
      for (const conn of outgoingConnections) {
        const nextNode = conn.to_node_id || conn.to;
        if (!visited.has(nextNode)) {
          queue.push({
            node: nextNode,
            path: [...path, nextNode],
            connections: [...connections, conn.id]
          });
        }
      }
    }
    
    return null;
  }

  function updateEnhancedFlows() {
    // This would implement the enhanced signal flow logic
    // For now, we'll create a basic structure
    enhancedFlows.value = [];
    
    sourceNodes.value.forEach(source => {
      const targets = [];
      
      // Find all recorders that can be reached from this source
      recorderNodes.value.forEach(recorder => {
        const path = findSignalPath(source.id, recorder.id);
        if (path) {
          // Find transformers in the path
          const transformers = path.nodes
            .map(nodeId => nodes.value.find(n => n.id === nodeId))
            .filter(node => node && (node.node_type || node.gearType) === 'transformer');
          
          // Find the connection to this recorder
          const connection = connections.value.find(c => 
            (c.to_node_id === recorder.id || c.to === recorder.id) && path.connections.includes(c.id)
          );
          
          targets.push({
            recorderId: recorder.id,
            recorderLabel: recorder.label,
            track: connection?.track_number || 1,
            transformers: transformers.map(t => ({
              id: t.id,
              label: t.label,
              inputOutput: `${t.num_inputs || t.numinputs || 0}→${t.num_outputs || 0}`
            })),
            path: path.nodes.map(nodeId => {
              const node = nodes.value.find(n => n.id === nodeId);
              return node ? node.label : 'Unknown';
            }).join(' → ')
          });
        }
      });
      
      if (targets.length > 0) {
        enhancedFlows.value.push({
          sourceId: source.id,
          sourceLabel: source.label,
          targets
        });
      }
    });
  }

  // Load data on mount
  onMounted(async () => {
    await loadFlowData();
  });

  // Watch for changes in the data
  watch(() => nodes.value, () => {
    updateEnhancedFlows();
  }, { deep: true });

  watch(() => connections.value, () => {
    updateEnhancedFlows();
  }, { deep: true });

  return {
    linkMode,
    linkSourceNodeId,
    enhancedFlows,
    showTrackAssignModal,
    trackAssignNode,
    trackAssignmentsDraft,
    showPathHighlightModal,
    selectedSourceId,
    selectedRecorderId,
    sourceNodes,
    transformerNodes,
    recorderNodes,
    sourceCount,
    transformerCount,
    recorderCount,
    connectionCount,
    loadingNodes,
    loadingConnections,
    error,
    setLinkMode,
    openMatrixMapper,
    assignTracks,
    getAvailableInputs,
    getInputSourceLabel,
    confirmTrackAssignments,
    closeTrackAssignModal,
    highlightSignalPath,
    tracePath,
    closePathHighlightModal,
    clearHighlights,
    exportSignalFlow,
    getNodeLabel,
    editConnection,
    removeConnection,
    findSignalPath,
    updateEnhancedFlows,
    connections,
    loadFlowData
  };
}
}
</script>

<style scoped>
.signal-flow-container {
  padding: 16px;
}

/* Loading and Error States */
.loading-state,
.error-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  padding: 40px;
}

.loading-indicator,
.error-indicator {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  text-align: center;
}

.loading-indicator p,
.error-indicator p {
  margin: 0;
  font-size: 16px;
  color: #6c757d;
}

.error-indicator p {
  color: #dc3545;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #e9ecef;
  border-top: 4px solid #007bff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.retry-btn {
  padding: 10px 20px;
  background: #007bff;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background-color 0.2s;
}

.retry-btn:hover {
  background: #0056b3;
}

.flow-controls {
  margin-bottom: 20px;
}

.control-group {
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.control-group h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #495057;
}

.tool-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tool-btn {
  padding: 8px 12px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: #fff;
  color: #333;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s ease;
}

.tool-btn:hover {
  background: #f8f9fa;
  border-color: #007bff;
  transform: translateY(-1px);
}

.tool-btn.active {
  border-color: #007bff;
  background: #007bff;
  color: #fff;
}

.link-mode-status {
  position: fixed;
  top: 10px;
  right: 10px;
  background: rgba(255, 255, 255, 0.95);
  padding: 12px 16px;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border: 2px solid #007bff;
  z-index: 1000;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 10px;
}

.status-icon {
  font-size: 20px;
  color: #007bff;
}

.status-text {
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.cancel-link-btn {
  background: #dc3545;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  margin-left: 8px;
}

.cancel-link-btn:hover {
  background: #c82333;
}

.flow-visualization {
  margin-bottom: 20px;
}

.flow-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.flow-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #495057;
}

.flow-stats {
  display: flex;
  gap: 16px;
  font-size: 14px;
  color: #6c757d;
}

.flow-stats span {
  padding: 4px 8px;
  background: #fff;
  border-radius: 4px;
  border: 1px solid #dee2e6;
}

.enhanced-flows {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.no-flows {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.flow-list {
  padding: 16px;
}

.flow-item {
  margin-bottom: 20px;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 8px;
  border: 1px solid #e9ecef;
}

.flow-source {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  padding: 8px;
  background: #d4edda;
  border-radius: 4px;
  border: 1px solid #c3e6cb;
}

.source-icon {
  font-size: 18px;
}

.source-label {
  font-weight: 600;
  color: #155724;
}

.flow-targets {
  margin-left: 20px;
}

.target-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #fff;
  border-radius: 6px;
  border: 1px solid #dee2e6;
}

.target-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.target-icon {
  font-size: 16px;
}

.target-label {
  font-weight: 600;
  color: #495057;
}

.track-info {
  font-size: 12px;
  color: #6c757d;
  background: #e9ecef;
  padding: 2px 6px;
  border-radius: 4px;
}

.transformers-path {
  margin: 8px 0;
  padding-left: 16px;
}

.path-label {
  font-size: 12px;
  color: #6c757d;
  margin-bottom: 4px;
  display: block;
}

.transformer-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
  font-size: 12px;
}

.transformer-icon {
  font-size: 14px;
  color: #ffc107;
}

.transformer-label {
  color: #495057;
}

.io-info {
  color: #6c757d;
  font-style: italic;
}

.full-path {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #dee2e6;
}

.path-text {
  font-size: 12px;
  color: #6c757d;
  font-style: italic;
}

.connection-management {
  margin-bottom: 20px;
}

.connection-management h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
  font-weight: 600;
  color: #495057;
}

.connection-list {
  background: #fff;
  border-radius: 8px;
  border: 1px solid #e9ecef;
  overflow: hidden;
}

.no-connections {
  padding: 20px;
  text-align: center;
  color: #6c757d;
}

.connections {
  padding: 16px;
}

.connection-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: #f8f9fa;
  border-radius: 6px;
  border: 1px solid #e9ecef;
}

.connection-info {
  flex: 1;
}

.connection-nodes {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.from-node {
  font-weight: 600;
  color: #495057;
}

.connection-arrow {
  color: #007bff;
  font-weight: bold;
}

.to-node {
  font-weight: 600;
  color: #495057;
}

.connection-details {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #6c757d;
}

.connection-actions {
  display: flex;
  gap: 4px;
}

.edit-btn,
.delete-btn {
  padding: 4px 8px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.edit-btn {
  background: #007bff;
  color: #fff;
}

.edit-btn:hover {
  background: #0056b3;
}

.delete-btn {
  background: #dc3545;
  color: #fff;
}

.delete-btn:hover {
  background: #c82333;
}

/* Modal styles */
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 1001;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.18);
  padding: 24px;
  width: 100%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
}

.track-assign-modal h3,
.path-highlight-modal h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
  font-weight: 600;
  color: #495057;
}

.track-assignments {
  margin-bottom: 16px;
}

.track-item {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.track-item label {
  font-weight: 500;
  color: #495057;
  min-width: 80px;
}

.track-item select {
  flex: 1;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.path-options {
  margin-bottom: 16px;
}

.option-group {
  margin-bottom: 12px;
}

.option-group label {
  display: block;
  margin-bottom: 4px;
  font-weight: 500;
  color: #495057;
}

.option-group select {
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary {
  background: #007bff;
  color: #fff;
}

.btn-primary:hover {
  background: #0056b3;
}

.btn-success {
  background: #28a745;
  color: #fff;
}

.btn-success:hover {
  background: #218838;
}

.btn-secondary {
  background: #6c757d;
  color: #fff;
}

.btn-secondary:hover {
  background: #545b62;
}

/* Transition animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@media (max-width: 768px) {
  .link-mode-status {
    position: relative;
    top: auto;
    right: auto;
    margin: 10px 0;
  }
  
  .flow-header {
    flex-direction: column;
    gap: 8px;
    align-items: flex-start;
  }
  
  .flow-stats {
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .tool-buttons {
    gap: 6px;
  }
  
  .tool-btn {
    padding: 6px 8px;
    font-size: 12px;
  }
}
</style> 