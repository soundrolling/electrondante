import { supabase } from '../supabase';

/**
 * User Gear Owners Service
 *
 * A piece of personal gear (e.g. a row of "KSM mics, qty 10") can be split
 * across multiple owners with per-owner quantities. This service manages the
 * allocation rows (public.user_gear_owners) for a given gear row.
 *
 * Each allocation is one of:
 *   - { is_self: true,  quantity }           — the gear-list owner
 *   - { owner_contact_id: <uuid>, quantity } — a saved personal contact
 *   - { owner_name: <text>, quantity }       — a free-text name (not saved
 *                                              as a contact yet)
 *
 * The sum of allocation.quantity is allowed to be less than the gear's total
 * quantity — the remainder is treated as "unassigned" and flagged in the UI.
 * Sum may not exceed the gear quantity (validated client-side before save).
 */

const TABLE_MISSING_CODE = '42P01';

function isTableMissing(error) {
  if (!error) return false;
  if (error.code === TABLE_MISSING_CODE) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('user_gear_owners') && msg.includes('does not exist');
}

function sanitizeAllocation(input, position = 0) {
  const row = {
    is_self: !!input.is_self,
    owner_contact_id: input.owner_contact_id || null,
    owner_name: (input.owner_name || '').trim() || null,
    quantity: Math.max(1, parseInt(input.quantity, 10) || 1),
    position,
  };
  // Exactly one owner kind. If multiple are set, is_self wins, then contact.
  if (row.is_self) {
    row.owner_contact_id = null;
    row.owner_name = null;
  } else if (row.owner_contact_id) {
    row.owner_name = null;
  }
  return row;
}

export const UserGearOwnersService = {
  /**
   * Fetch all allocations for a list of gear ids. Returns Map<gearId, allocations[]>.
   * Tolerates the table not existing (returns an empty Map).
   */
  async listForGearIds(gearIds) {
    const out = new Map();
    const ids = Array.isArray(gearIds) ? gearIds.filter(Boolean) : [];
    if (!ids.length) return out;
    try {
      const { data, error } = await supabase
        .from('user_gear_owners')
        .select('id, gear_id, is_self, owner_contact_id, owner_name, quantity, position')
        .in('gear_id', ids)
        .order('position', { ascending: true });
      if (error) {
        if (isTableMissing(error)) return out;
        throw error;
      }
      for (const row of data || []) {
        if (!out.has(row.gear_id)) out.set(row.gear_id, []);
        out.get(row.gear_id).push(row);
      }
      return out;
    } catch (e) {
      if (isTableMissing(e)) return out;
      console.error('UserGearOwnersService.listForGearIds failed:', e);
      return out;
    }
  },

  async listForGear(gearId) {
    if (!gearId) return [];
    const map = await this.listForGearIds([gearId]);
    return map.get(gearId) || [];
  },

  /**
   * Replace every allocation for a gear atomically: delete existing rows
   * then insert the provided list. We do this in two steps because Supabase
   * has no native transaction over multiple PostgREST calls — RLS already
   * scopes both delete and insert to gear we own, so a partial failure
   * leaves the table in a clean state (no extra rows than we inserted).
   *
   * Pass an empty array to leave the gear fully unassigned.
   */
  async replaceForGear(gearId, allocations) {
    if (!gearId) throw new Error('gearId is required');
    const rows = (Array.isArray(allocations) ? allocations : [])
      .map((a, i) => sanitizeAllocation(a, i))
      .filter(a => a.quantity > 0);

    const { error: delErr } = await supabase
      .from('user_gear_owners')
      .delete()
      .eq('gear_id', gearId);
    if (delErr && !isTableMissing(delErr)) throw delErr;

    if (!rows.length) return [];

    const payload = rows.map(r => ({ gear_id: gearId, ...r }));
    const { data, error } = await supabase
      .from('user_gear_owners')
      .insert(payload)
      .select('id, gear_id, is_self, owner_contact_id, owner_name, quantity, position');
    if (error) throw error;
    return data || [];
  },
};

export default UserGearOwnersService;
