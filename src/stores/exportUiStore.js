// src/stores/exportUiStore.js
//
// UI state for the "Export Saved" success modal, formerly driven via
// window.dispatchEvent('show-export-success-modal'). Centralising it in
// a Pinia store removes the global event surface and lets components
// (and ExportSuccessModal in App.vue) react reactively.

import { defineStore } from 'pinia';

export const useExportUiStore = defineStore('exportUi', {
  state: () => ({
    successModal: {
      open: false,
      // payload holds everything the modal needs to render and act:
      // { filename, result, mimeType, projectId, venueId, stageId,
      //   onDownload (() => void), onNavigate (() => void) }
      payload: null,
    },
  }),
  actions: {
    /**
     * Show the export success modal with a payload describing what was saved
     * and the callbacks for the action buttons.
     */
    showSuccess(payload) {
      this.successModal = { open: true, payload };
    },
    /**
     * Close the modal and drop the payload reference.
     */
    closeSuccess() {
      this.successModal = { open: false, payload: null };
    },
  },
});
