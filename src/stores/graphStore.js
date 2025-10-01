import { defineStore } from 'pinia';

export const useGraphStore = defineStore('graph', {
  state: () => ({
    nodes: [], // { id, type, gearId, label, x, y, ... }
    connections: [], // { id, from, to, ... }
  }),
  actions: {
    addNode(node) {
      this.nodes.push(node);
    },
    updateNode(node) {
      const idx = this.nodes.findIndex(n => n.id === node.id);
      if (idx !== -1) this.nodes[idx] = { ...this.nodes[idx], ...node };
    },
    deleteNode(nodeId) {
      this.nodes = this.nodes.filter(n => n.id !== nodeId);
      this.connections = this.connections.filter(c => c.from !== nodeId && c.to !== nodeId);
    },
    addConnection(conn) {
      if (!this.connections.some(c => c.from === conn.from && c.to === conn.to)) {
        this.connections.push(conn);
      }
    },
    deleteConnection(connId) {
      this.connections = this.connections.filter(c => c.id !== connId);
    },
    addLine(line) {
      this.nodes.push(line);
    },
    addPath(path) {
      this.nodes.push(path);
    },
    addSquare(square) {
      this.nodes.push(square);
    },
    addText(text) {
      this.nodes.push(text);
    },
    clear() {
      this.nodes = [];
      this.connections = [];
    }
  }
}); 