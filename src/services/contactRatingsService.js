import { supabase } from '../supabase';
import { createLogger } from '@/utils/log'

const log = createLogger('contactRatingsService')

/**
 * Contact Helpfulness Ratings Service
 *
 * Per-PERSON "helpfulness" rating (1=Useless .. 5=Amazing) for project contacts.
 * Ratings follow the person across projects, keyed by a normalized match_key
 * (email if present, else name) rather than a specific project_contacts row.
 *
 * Two scopes live in public.contact_ratings:
 *   - 'shared'   : one row per person (user_id NULL), readable/writable only by
 *                  project owners/admins via RLS. Last write wins.
 *   - 'personal' : one row per (person, user), private to that user.
 *
 * The current user's project role decides which scope they read/write: admins
 * use 'shared', everyone else uses 'personal'.
 *
 * Every method tolerates the table not existing yet (Postgres 42P01) and
 * degrades to an empty map / silent no-op, so the app keeps working until the
 * create_contact_ratings migration is applied.
 */

const TABLE_MISSING_CODE = '42P01';

function isTableMissing(error) {
  if (!error) return false;
  if (error.code === TABLE_MISSING_CODE) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('contact_ratings') && msg.includes('does not exist');
}

export const RATING_LEVELS = [
  { value: 1, label: 'Useless' },
  { value: 2, label: 'Poor' },
  { value: 3, label: 'OK' },
  { value: 4, label: 'Great' },
  { value: 5, label: 'Amazing' },
];

/**
 * The person-level key a rating hangs off. Email wins (stable across re-typed
 * names); fall back to name. Returns null when there's nothing to key on, in
 * which case the contact can't be rated.
 */
export function ratingMatchKey(contact) {
  const email = (contact?.email || '').trim().toLowerCase();
  if (email) return `email:${email}`;
  const name = (contact?.name || '').trim().toLowerCase();
  if (name) return `name:${name}`;
  return null;
}

export const ContactRatingsService = {
  /**
   * Load every rating the current user is allowed to see for the given scope,
   * as a Map(match_key -> rating). RLS guarantees a non-admin only ever gets
   * their own 'personal' rows and never sees 'shared' rows.
   */
  async loadMap(scope) {
    try {
      const { data, error } = await supabase
        .from('contact_ratings')
        .select('match_key, rating')
        .eq('scope', scope);
      if (error) {
        if (isTableMissing(error)) return new Map();
        throw error;
      }
      const map = new Map();
      for (const row of data || []) map.set(row.match_key, row.rating);
      return map;
    } catch (e) {
      if (isTableMissing(e)) return new Map();
      log.error('ContactRatingsService.loadMap failed:', e);
      return new Map();
    }
  },

  /**
   * Insert or update the rating for a person. 'personal' scope requires the
   * current user id; 'shared' keeps user_id NULL. Manual lookup-then-write
   * (rather than upsert) avoids onConflict quirks with the partial unique
   * indexes. No-ops silently if the table doesn't exist yet.
   */
  async setRating({ matchKey, scope, rating, userId }) {
    if (!matchKey) throw new Error('matchKey is required');
    if (!(rating >= 1 && rating <= 5)) throw new Error('rating out of range');
    const ownerId = scope === 'personal' ? userId : null;
    if (scope === 'personal' && !ownerId) throw new Error('Not authenticated');

    try {
      let lookup = supabase
        .from('contact_ratings')
        .select('id')
        .eq('match_key', matchKey)
        .eq('scope', scope);
      lookup = ownerId ? lookup.eq('user_id', ownerId) : lookup.is('user_id', null);
      const { data: existing, error: lookupErr } = await lookup.maybeSingle();
      if (lookupErr) {
        if (isTableMissing(lookupErr)) return;
        throw lookupErr;
      }

      if (existing?.id) {
        const { error } = await supabase
          .from('contact_ratings')
          .update({ rating, updated_at: new Date().toISOString() })
          .eq('id', existing.id);
        if (error) throw error;
        return;
      }
      const { error } = await supabase
        .from('contact_ratings')
        .insert({ match_key: matchKey, scope, rating, user_id: ownerId });
      if (error) throw error;
    } catch (e) {
      if (isTableMissing(e)) return;
      throw e;
    }
  },

  /**
   * Remove the rating for a person in the given scope. No-ops if absent or if
   * the table doesn't exist yet.
   */
  async clearRating({ matchKey, scope, userId }) {
    if (!matchKey) return;
    const ownerId = scope === 'personal' ? userId : null;
    if (scope === 'personal' && !ownerId) return;
    try {
      let del = supabase
        .from('contact_ratings')
        .delete()
        .eq('match_key', matchKey)
        .eq('scope', scope);
      del = ownerId ? del.eq('user_id', ownerId) : del.is('user_id', null);
      const { error } = await del;
      if (error && !isTableMissing(error)) throw error;
    } catch (e) {
      if (isTableMissing(e)) return;
      throw e;
    }
  },
};

export default ContactRatingsService;
