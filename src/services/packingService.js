import { supabase } from '../supabase';

/**
 * Packing Service
 * Handles CRUD operations for user gear bags and bag items
 */
export class PackingService {
  
  /**
   * Get all bags for a user
   * @param {string} userId - User ID
   * @returns {Promise<Array>} Array of bags with image URLs
   */
  static async getUserBags(userId) {
    try {
      const { data, error } = await supabase
        .from('gear_bags')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Load image URLs for each bag
      const bagsWithImages = await Promise.all(
        (data || []).map(async (bag) => {
          let imageUrl = null;
          if (bag.image_path) {
            try {
              const { data: signed } = await supabase.storage
                .from('gear-bag-images')
                .createSignedUrl(bag.image_path, 3600);
              imageUrl = signed?.signedUrl || null;
            } catch (err) {
              console.warn('Could not get signed URL for bag image:', err);
            }
          }
          return { ...bag, imageUrl };
        })
      );
      
      return bagsWithImages;
    } catch (error) {
      console.error('Error fetching user bags:', error);
      throw error;
    }
  }

  /**
   * Create a new bag
   * @param {string} userId - User ID
   * @param {Object} bagData - Bag data { name, description, imageFile? }
   * @returns {Promise<Object>} Created bag
   */
  static async createBag(userId, bagData) {
    try {
      let imagePath = null;
      
      // Upload image if provided
      if (bagData.imageFile) {
        const fileExt = bagData.imageFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('gear-bag-images')
          .upload(fileName, bagData.imageFile, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) throw uploadError;
        imagePath = uploadData.path;
      }
      
      const { data, error } = await supabase
        .from('gear_bags')
        .insert({
          user_id: userId,
          name: bagData.name,
          description: bagData.description || null,
          weight_kg: bagData.weight_kg || null,
          empty_bag_weight_kg: bagData.empty_bag_weight_kg || null,
          image_path: imagePath
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Get image URL if image was uploaded
      let imageUrl = null;
      if (imagePath) {
        try {
          const { data: signed } = await supabase.storage
            .from('gear-bag-images')
            .createSignedUrl(imagePath, 3600);
          imageUrl = signed?.signedUrl || null;
        } catch (err) {
          console.warn('Could not get signed URL for bag image:', err);
        }
      }
      
      return { ...data, imageUrl };
    } catch (error) {
      console.error('Error creating bag:', error);
      throw error;
    }
  }

  /**
   * Update an existing bag
   * @param {string} bagId - Bag ID
   * @param {Object} bagData - Updated bag data { name?, description?, imageFile? }
   * @returns {Promise<Object>} Updated bag
   */
  static async updateBag(bagId, bagData) {
    try {
      const updateData = {
        updated_at: new Date().toISOString()
      };
      
      if (bagData.name !== undefined) updateData.name = bagData.name;
      if (bagData.description !== undefined) updateData.description = bagData.description || null;
      if (bagData.weight_kg !== undefined) updateData.weight_kg = bagData.weight_kg || null;
      if (bagData.empty_bag_weight_kg !== undefined) updateData.empty_bag_weight_kg = bagData.empty_bag_weight_kg || null;
      
      // Handle image update
      if (bagData.imageFile) {
        // Get existing bag to delete old image
        const { data: existingBag } = await supabase
          .from('gear_bags')
          .select('image_path')
          .eq('id', bagId)
          .single();
        
        // Delete old image if exists
        if (existingBag?.image_path) {
          await supabase.storage
            .from('gear-bag-images')
            .remove([existingBag.image_path]);
        }
        
        // Upload new image
        const userId = (await supabase.auth.getUser()).data.user?.id;
        if (!userId) throw new Error('User not authenticated');
        
        const fileExt = bagData.imageFile.name.split('.').pop();
        const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('gear-bag-images')
          .upload(fileName, bagData.imageFile, {
            cacheControl: '3600',
            upsert: false
          });
        
        if (uploadError) throw uploadError;
        updateData.image_path = uploadData.path;
      }
      
      const { data, error } = await supabase
        .from('gear_bags')
        .update(updateData)
        .eq('id', bagId)
        .select()
        .single();
      
      if (error) throw error;
      
      // Get image URL if image exists
      let imageUrl = null;
      if (data.image_path) {
        try {
          const { data: signed } = await supabase.storage
            .from('gear-bag-images')
            .createSignedUrl(data.image_path, 3600);
          imageUrl = signed?.signedUrl || null;
        } catch (err) {
          console.warn('Could not get signed URL for bag image:', err);
        }
      }
      
      return { ...data, imageUrl };
    } catch (error) {
      console.error('Error updating bag:', error);
      throw error;
    }
  }

  /**
   * Delete a bag and its image
   * @param {string} bagId - Bag ID
   * @returns {Promise<void>}
   */
  static async deleteBag(bagId) {
    try {
      // Get bag to delete image
      const { data: bag } = await supabase
        .from('gear_bags')
        .select('image_path')
        .eq('id', bagId)
        .single();
      
      // Delete image from storage if exists
      if (bag?.image_path) {
        await supabase.storage
          .from('gear-bag-images')
          .remove([bag.image_path]);
      }
      
      // Delete bag (items will be cascade deleted)
      const { error } = await supabase
        .from('gear_bags')
        .delete()
        .eq('id', bagId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error deleting bag:', error);
      throw error;
    }
  }

  /**
   * Get all items in a bag
   * @param {string} bagId - Bag ID
   * @returns {Promise<Array>} Array of bag items
   */
  static async getBagItems(bagId) {
    try {
      const { data, error } = await supabase
        .from('gear_bag_items')
        .select('*')
        .eq('bag_id', bagId)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching bag items:', error);
      throw error;
    }
  }

  /**
   * Add an item to a bag
   * @param {string} bagId - Bag ID
   * @param {Object} itemData - Item data { gear_id?, user_gear_id?, gear_name, quantity?, notes? }
   * @returns {Promise<Object>} Created item
   */
  static async addItemToBag(bagId, itemData) {
    try {
      const { data, error } = await supabase
        .from('gear_bag_items')
        .insert({
          bag_id: bagId,
          gear_id: itemData.gear_id || null,
          user_gear_id: itemData.user_gear_id || null,
          gear_name: itemData.gear_name,
          quantity: itemData.quantity || 1,
          notes: itemData.notes || null
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding item to bag:', error);
      throw error;
    }
  }

  /**
   * Update a bag item
   * @param {string} itemId - Item ID
   * @param {Object} itemData - Updated item data { gear_name?, quantity?, notes?, bag_id? }
   * @returns {Promise<Object>} Updated item
   */
  static async updateBagItem(itemId, itemData) {
    try {
      const updateData = {};
      if (itemData.gear_name !== undefined) updateData.gear_name = itemData.gear_name;
      if (itemData.quantity !== undefined) updateData.quantity = itemData.quantity;
      if (itemData.notes !== undefined) updateData.notes = itemData.notes || null;
      if (itemData.bag_id !== undefined) updateData.bag_id = itemData.bag_id;
      
      const { data, error } = await supabase
        .from('gear_bag_items')
        .update(updateData)
        .eq('id', itemId)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating bag item:', error);
      throw error;
    }
  }

  /**
   * Remove an item from a bag
   * @param {string} itemId - Item ID
   * @returns {Promise<void>}
   */
  static async removeItemFromBag(itemId) {
    try {
      const { error } = await supabase
        .from('gear_bag_items')
        .delete()
        .eq('id', itemId);
      
      if (error) throw error;
    } catch (error) {
      console.error('Error removing item from bag:', error);
      throw error;
    }
  }

  /**
   * Generate printable inventory list for a bag
   * @param {string} bagId - Bag ID
   * @returns {Promise<Object>} Bag with items for printing
   */
  static async getBagInventoryForPrint(bagId) {
    try {
      const { data: bag, error: bagError } = await supabase
        .from('gear_bags')
        .select('*')
        .eq('id', bagId)
        .single();
      
      if (bagError) throw bagError;
      
      const items = await this.getBagItems(bagId);
      
      return {
        ...bag,
        items: items || []
      };
    } catch (error) {
      console.error('Error getting bag inventory for print:', error);
      throw error;
    }
  }
}

export default PackingService;

