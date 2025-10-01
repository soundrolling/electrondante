// src/services/bugReportService.js

import { supabase } from '../supabase'
import { useToast } from 'vue-toastification'

const toast = useToast()

export class BugReportService {
  /**
   * Submit a new bug report or suggestion
   * @param {Object} reportData - The bug report data
   * @returns {Promise<Object>} - The created report
   */
  static async submitReport(reportData) {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .insert({
          type: reportData.type,
          title: reportData.title,
          description: reportData.description,
          priority: reportData.priority,
          browser: reportData.browser || null,
          device: reportData.device || null,
          steps: reportData.steps || null,
          expected_behavior: reportData.expectedBehavior || null,
          actual_behavior: reportData.actualBehavior || null,
          additional_info: reportData.additionalInfo || null,
          // System information
          user_agent: reportData.userAgent || null,
          platform: reportData.platform || null,
          language: reportData.language || null,
          cookie_enabled: reportData.cookieEnabled || null,
          online_status: reportData.onLine || null,
          screen_resolution: reportData.screenResolution || null,
          viewport_size: reportData.viewportSize || null,
          color_depth: reportData.colorDepth || null,
          pixel_ratio: reportData.pixelRatio || null,
          timezone: reportData.timezone || null,
          url: reportData.url || null,
          referrer: reportData.referrer || null,
          page_title: reportData.pageTitle || null,
          console_errors: reportData.consoleErrors || null,
          status: 'open',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Bug report submitted successfully!')
      return data
    } catch (error) {
      console.error('Error submitting bug report:', error)
      toast.error('Failed to submit bug report. Please try again.')
      throw error
    }
  }

  /**
   * Fetch all bug reports for the current user
   * @returns {Promise<Array>} - Array of bug reports
   */
  static async fetchReports() {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching bug reports:', error)
      toast.error('Failed to load bug reports')
      throw error
    }
  }

  /**
   * Update a bug report status
   * @param {string} reportId - The report ID
   * @param {string} status - The new status
   * @returns {Promise<Object>} - The updated report
   */
  static async updateReportStatus(reportId, status) {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', reportId)
        .select()
        .single()

      if (error) throw error

      toast.success('Report status updated successfully!')
      return data
    } catch (error) {
      console.error('Error updating report status:', error)
      toast.error('Failed to update report status')
      throw error
    }
  }

  /**
   * Add a comment to a bug report
   * @param {string} reportId - The report ID
   * @param {string} comment - The comment text
   * @returns {Promise<Object>} - The created comment
   */
  static async addComment(reportId, comment) {
    try {
      const { data, error } = await supabase
        .from('bug_report_comments')
        .insert({
          report_id: reportId,
          comment,
          created_at: new Date().toISOString()
        })
        .select()
        .single()

      if (error) throw error

      toast.success('Comment added successfully!')
      return data
    } catch (error) {
      console.error('Error adding comment:', error)
      toast.error('Failed to add comment')
      throw error
    }
  }

  /**
   * Fetch comments for a specific bug report
   * @param {string} reportId - The report ID
   * @returns {Promise<Array>} - Array of comments
   */
  static async fetchComments(reportId) {
    try {
      const { data, error } = await supabase
        .from('bug_report_comments')
        .select('*')
        .eq('report_id', reportId)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching comments:', error)
      toast.error('Failed to load comments')
      throw error
    }
  }

  /**
   * Delete a bug report
   * @param {string} reportId - The report ID
   * @returns {Promise<void>}
   */
  static async deleteReport(reportId) {
    try {
      // First delete all comments
      await supabase
        .from('bug_report_comments')
        .delete()
        .eq('report_id', reportId)

      // Then delete the report
      const { error } = await supabase
        .from('bug_reports')
        .delete()
        .eq('id', reportId)

      if (error) throw error

      toast.success('Report deleted successfully!')
    } catch (error) {
      console.error('Error deleting report:', error)
      toast.error('Failed to delete report')
      throw error
    }
  }

  /**
   * Get report statistics
   * @returns {Promise<Object>} - Statistics object
   */
  static async getReportStatistics() {
    try {
      const { data, error } = await supabase
        .from('bug_reports')
        .select('status, type, priority')

      if (error) throw error

      const stats = {
        total: data.length,
        byStatus: {},
        byType: {},
        byPriority: {}
      }

      data.forEach(report => {
        // Count by status
        stats.byStatus[report.status] = (stats.byStatus[report.status] || 0) + 1
        
        // Count by type
        stats.byType[report.type] = (stats.byType[report.type] || 0) + 1
        
        // Count by priority
        stats.byPriority[report.priority] = (stats.byPriority[report.priority] || 0) + 1
      })

      return stats
    } catch (error) {
      console.error('Error fetching report statistics:', error)
      throw error
    }
  }
}

export default BugReportService
