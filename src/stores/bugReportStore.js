// src/stores/bugReportStore.js

import { defineStore } from 'pinia'
import { BugReportService } from '../services/bugReportService'

export const useBugReportStore = defineStore('bugReportStore', {
  state: () => ({
    reports: [],
    comments: {},
    statistics: null,
    isLoading: false,
    isSubmitting: false,
    error: null
  }),

  getters: {
    /**
     * Get reports filtered by status
     */
    getReportsByStatus: (state) => (status) => {
      return state.reports.filter(report => report.status === status)
    },

    /**
     * Get reports filtered by type
     */
    getReportsByType: (state) => (type) => {
      return state.reports.filter(report => report.type === type)
    },

    /**
     * Get reports filtered by priority
     */
    getReportsByPriority: (state) => (priority) => {
      return state.reports.filter(report => report.priority === priority)
    },

    /**
     * Get open reports count
     */
    openReportsCount: (state) => {
      return state.reports.filter(report => report.status === 'open').length
    },

    /**
     * Get closed reports count
     */
    closedReportsCount: (state) => {
      return state.reports.filter(report => report.status === 'closed').length
    },

    /**
     * Get in progress reports count
     */
    inProgressReportsCount: (state) => {
      return state.reports.filter(report => report.status === 'in_progress').length
    },

    /**
     * Get bug reports count
     */
    bugReportsCount: (state) => {
      return state.reports.filter(report => report.type === 'bug').length
    },

    /**
     * Get suggestion reports count
     */
    suggestionReportsCount: (state) => {
      return state.reports.filter(report => report.type === 'suggestion').length
    },

    /**
     * Get improvement reports count
     */
    improvementReportsCount: (state) => {
      return state.reports.filter(report => report.type === 'improvement').length
    }
  },

  actions: {
    /**
     * Submit a new bug report
     */
    async submitReport(reportData) {
      this.isSubmitting = true
      this.error = null
      
      try {
        const newReport = await BugReportService.submitReport(reportData)
        this.reports.unshift(newReport)
        return newReport
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isSubmitting = false
      }
    },

    /**
     * Fetch all bug reports
     */
    async fetchReports() {
      this.isLoading = true
      this.error = null
      
      try {
        const reports = await BugReportService.fetchReports()
        this.reports = reports
        return reports
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Update report status
     */
    async updateReportStatus(reportId, status) {
      this.error = null
      
      try {
        const updatedReport = await BugReportService.updateReportStatus(reportId, status)
        
        // Update the report in the store
        const index = this.reports.findIndex(report => report.id === reportId)
        if (index !== -1) {
          this.reports[index] = updatedReport
        }
        
        return updatedReport
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Add comment to a report
     */
    async addComment(reportId, comment) {
      this.error = null
      
      try {
        const newComment = await BugReportService.addComment(reportId, comment)
        
        // Add comment to the store
        if (!this.comments[reportId]) {
          this.comments[reportId] = []
        }
        this.comments[reportId].push(newComment)
        
        return newComment
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Fetch comments for a report
     */
    async fetchComments(reportId) {
      this.error = null
      
      try {
        const comments = await BugReportService.fetchComments(reportId)
        this.comments[reportId] = comments
        return comments
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Delete a report
     */
    async deleteReport(reportId) {
      this.error = null
      
      try {
        await BugReportService.deleteReport(reportId)
        
        // Remove from store
        this.reports = this.reports.filter(report => report.id !== reportId)
        delete this.comments[reportId]
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Fetch report statistics
     */
    async fetchStatistics() {
      this.error = null
      
      try {
        const statistics = await BugReportService.getReportStatistics()
        this.statistics = statistics
        return statistics
      } catch (error) {
        this.error = error.message
        throw error
      }
    },

    /**
     * Clear all data
     */
    clearData() {
      this.reports = []
      this.comments = {}
      this.statistics = null
      this.error = null
    },

    /**
     * Get comments for a specific report (from store or fetch if not available)
     */
    async getComments(reportId) {
      if (this.comments[reportId]) {
        return this.comments[reportId]
      }
      
      return await this.fetchComments(reportId)
    }
  }
})
