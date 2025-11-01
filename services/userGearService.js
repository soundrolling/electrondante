import { supabase } from '../supabase';

/**
 * User Gear Service
 * Handles integration between user personal gear and project gear management
 */
export class UserGearService {
  
  /**
   * Search for available user gear that can be added to projects
   * @param {string} searchTerm - Search term for gear name, type, or notes
   * @param {string} gearType - Filter by specific gear type
   * @param {string} condition - Filter by gear condition
   * @returns {Promise<Array>} Array of available user gear
   */
  static async searchAvailableGear(searchTerm = '', gearType = '', condition = '') {
    try {
      // Try to use the view first
      let query = supabase
        .from('user_gear_view')
        .select('*')
        .eq('availability', 'available');

      // Apply search filter
      if (searchTerm) {
        query = query.or(`gear_name.ilike.%${searchTerm}%,gear_type.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
      }

      // Apply gear type filter
      if (gearType) {
        query = query.eq('gear_type', gearType);
      }

      // Apply condition filter
      if (condition) {
        query = query.eq('condition', condition);
      }

      const { data, error } = await query.order('gear_name');

      if (error) {
        // Fallback to direct user_gear table query
        console.warn('user_gear_view not available, falling back to direct query:', error);
        
        let fallbackQuery = supabase
          .from('user_gear')
          .select('id, gear_name, quantity, gear_type, notes, condition, availability, user_id')
          .eq('availability', 'available');

        if (searchTerm) {
          fallbackQuery = fallbackQuery.or(`gear_name.ilike.%${searchTerm}%,gear_type.ilike.%${searchTerm}%,notes.ilike.%${searchTerm}%`);
        }
        if (gearType) {
          fallbackQuery = fallbackQuery.eq('gear_type', gearType);
        }
        if (condition) {
          fallbackQuery = fallbackQuery.eq('condition', condition);
        }

        const { data: fallbackData, error: fallbackError } = await fallbackQuery.order('gear_name');
        
        if (fallbackError) throw fallbackError;
        
        // Add placeholder owner information
        return (fallbackData || []).map(item => ({
          ...item,
          owner_name: 'Unknown',
          owner_company: null
        }));
      }
      
      return data || [];
    } catch (error) {
      console.error('Error searching available gear:', error);
      throw error;
    }
  }

  /**
   * Get gear types available across all users
   * @returns {Promise<Array>} Array of unique gear types
   */
  static async getAvailableGearTypes() {
    try {
      const { data, error } = await supabase
        .from('user_gear_view')
        .select('gear_type')
        .not('gear_type', 'is', null);

      if (error) {
        // Fallback to direct user_gear table query
        console.warn('user_gear_view not available, falling back to direct query:', error);
        
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('user_gear')
          .select('gear_type')
          .eq('availability', 'available')
          .not('gear_type', 'is', null);

        if (fallbackError) throw fallbackError;
        
        const types = [...new Set(fallbackData.map(item => item.gear_type).filter(Boolean))];
        return types.sort();
      }
      
      const types = [...new Set(data.map(item => item.gear_type).filter(Boolean))];
      return types.sort();
    } catch (error) {
      console.error('Error getting gear types:', error);
      throw error;
    }
  }

  /**
   * Get gear by specific user
   * @param {string} userId - User ID
   * @param {string} availability - Filter by availability (optional)
   * @returns {Promise<Array>} Array of user's gear
   */
  static async getUserGear(userId, availability = '') {
    try {
      let query = supabase
        .from('user_gear')
        .select('*')
        .eq('user_id', userId);

      if (availability) {
        query = query.eq('availability', availability);
      }

      const { data, error } = await query.order('gear_name');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting user gear:', error);
      throw error;
    }
  }

  /**
   * Get gear owner information
   * @param {string} gearId - Gear ID
   * @returns {Promise<Object>} Gear owner information
   */
  static async getGearOwner(gearId) {
    try {
      const { data, error } = await supabase
        .from('user_gear_view')
        .select('user_id, owner_name, owner_company')
        .eq('id', gearId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting gear owner:', error);
      throw error;
    }
  }

  /**
   * Check if gear is available for project use
   * @param {string} gearId - Gear ID
   * @returns {Promise<boolean>} Whether gear is available
   */
  static async isGearAvailable(gearId) {
    try {
      const { data, error } = await supabase
        .from('user_gear')
        .select('availability')
        .eq('id', gearId)
        .single();

      if (error) throw error;
      return data?.availability === 'available';
    } catch (error) {
      console.error('Error checking gear availability:', error);
      return false;
    }
  }

  /**
   * Update gear availability status
   * @param {string} gearId - Gear ID
   * @param {string} availability - New availability status
   * @returns {Promise<Object>} Updated gear data
   */
  static async updateGearAvailability(gearId, availability) {
    try {
      const { data, error } = await supabase
        .from('user_gear')
        .update({ availability })
        .eq('id', gearId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating gear availability:', error);
      throw error;
    }
  }

  /**
   * Get gear statistics for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Gear statistics
   */
  static async getUserGearStats(userId) {
    try {
      const { data, error } = await supabase
        .from('user_gear')
        .select('gear_type, quantity, condition, availability')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        total: data.length,
        totalQuantity: data.reduce((sum, item) => sum + (item.quantity || 1), 0),
        byType: {},
        byCondition: {},
        byAvailability: {}
      };

      data.forEach(item => {
        // Count by type
        const type = item.gear_type || 'Unknown';
        stats.byType[type] = (stats.byType[type] || 0) + 1;

        // Count by condition
        const condition = item.condition || 'excellent';
        stats.byCondition[condition] = (stats.byCondition[condition] || 0) + 1;

        // Count by availability
        const availability = item.availability || 'available';
        stats.byAvailability[availability] = (stats.byAvailability[availability] || 0) + 1;
      });

      return stats;
    } catch (error) {
      console.error('Error getting user gear stats:', error);
      throw error;
    }
  }

  /**
   * Export user gear to CSV format
   * @param {string} userId - User ID
   * @returns {Promise<string>} CSV formatted string
   */
  static async exportUserGearToCSV(userId) {
    try {
      const gear = await this.getUserGear(userId);
      
      const headers = ['Name', 'Type', 'Quantity', 'Condition', 'Availability', 'Purchased Date', 'Notes'];
      const csvRows = [headers.join(',')];

      gear.forEach(item => {
        const row = [
          `"${item.gear_name}"`,
          `"${item.gear_type || ''}"`,
          item.quantity || 1,
          item.condition || 'excellent',
          item.availability || 'available',
          `"${item.purchased_date || ''}"`,
          `"${item.notes || ''}"`
        ];
        csvRows.push(row.join(','));
      });

      return csvRows.join('\n');
    } catch (error) {
      console.error('Error exporting user gear:', error);
      throw error;
    }
  }

  /**
   * Bulk update gear availability
   * @param {Array} gearIds - Array of gear IDs
   * @param {string} availability - New availability status
   * @returns {Promise<Array>} Updated gear data
   */
  static async bulkUpdateAvailability(gearIds, availability) {
    try {
      const { data, error } = await supabase
        .from('user_gear')
        .update({ availability })
        .in('id', gearIds)
        .select();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error bulk updating gear availability:', error);
      throw error;
    }
  }
}

export default UserGearService; 