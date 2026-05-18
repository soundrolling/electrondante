import { supabase } from '../supabase';

/**
 * User Personal Contacts Service
 *
 * Per-user address book. Currently powers the "Holding for" picker on
 * personal gear items so users don't have to re-type the same names every
 * time they carry someone else's kit. Backed by public.user_personal_contacts
 * (RLS-locked to user_id = auth.uid()).
 *
 * Every method tolerates the table not existing yet (Postgres 42P01) and
 * returns an empty list / silent no-op in that case, so older deployments
 * keep working until the create_user_personal_contacts migration is applied.
 */

const TABLE_MISSING_CODE = '42P01';

function isTableMissing(error) {
  if (!error) return false;
  if (error.code === TABLE_MISSING_CODE) return true;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('user_personal_contacts') && msg.includes('does not exist');
}

function sanitize(input) {
  const out = {};
  if (input.name !== undefined) out.name = String(input.name || '').trim();
  if (input.email !== undefined) out.email = (input.email || '').trim() || null;
  if (input.phone !== undefined) out.phone = (input.phone || '').trim() || null;
  if (input.role !== undefined) out.role = (input.role || '').trim() || null;
  if (input.notes !== undefined) out.notes = (input.notes || '').trim() || null;
  if (input.source !== undefined) out.source = input.source || null;
  if (input.source_project_id !== undefined) out.source_project_id = input.source_project_id || null;
  return out;
}

export const UserContactsService = {
  /**
   * List the signed-in user's personal contacts, ordered by name.
   */
  async list(userId) {
    if (!userId) return [];
    try {
      const { data, error } = await supabase
        .from('user_personal_contacts')
        .select('*')
        .eq('user_id', userId)
        .order('name', { ascending: true });
      if (error) {
        if (isTableMissing(error)) return [];
        throw error;
      }
      return data || [];
    } catch (e) {
      if (isTableMissing(e)) return [];
      console.error('UserContactsService.list failed:', e);
      throw e;
    }
  },

  /**
   * Insert one contact. Name is required and is unique per user
   * (case-insensitive) — duplicates throw 23505.
   */
  async create(userId, contact) {
    if (!userId) throw new Error('Not authenticated');
    const payload = { user_id: userId, ...sanitize(contact) };
    if (!payload.name) throw new Error('Contact name is required');
    const { data, error } = await supabase
      .from('user_personal_contacts')
      .insert(payload)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const payload = { ...sanitize(updates), updated_at: new Date().toISOString() };
    const { data, error } = await supabase
      .from('user_personal_contacts')
      .update(payload)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data;
  },

  async remove(id) {
    const { error } = await supabase
      .from('user_personal_contacts')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  },

  /**
   * Idempotently upsert by (user_id, lower(name)). Used by bulk-import flows
   * so re-running the same import refreshes details instead of erroring on
   * the unique index.
   */
  async upsertByName(userId, contact) {
    if (!userId) throw new Error('Not authenticated');
    const clean = sanitize(contact);
    if (!clean.name) throw new Error('Contact name is required');
    const lower = clean.name.toLowerCase();
    // Look up any existing match for this user by lower(name)
    const { data: existing, error: lookupErr } = await supabase
      .from('user_personal_contacts')
      .select('id, name, email, phone, role, notes, source, source_project_id')
      .eq('user_id', userId)
      .ilike('name', clean.name);
    if (lookupErr && !isTableMissing(lookupErr)) throw lookupErr;
    const match = (existing || []).find(c => (c.name || '').trim().toLowerCase() === lower);
    if (match) {
      // Merge: only fill blanks on the existing record so manual edits win.
      const merged = {};
      for (const key of ['email', 'phone', 'role', 'notes']) {
        if (!match[key] && clean[key]) merged[key] = clean[key];
      }
      if (Object.keys(merged).length === 0) return match;
      return await this.update(match.id, merged);
    }
    return await this.create(userId, clean);
  },

  /**
   * Gather all importable contacts from a project (members via user_profiles
   * plus external project_contacts) WITHOUT writing anything. Used to power
   * the selective import picker in the UI. Self is excluded.
   *
   * Returns an array of { key, name, email, phone, role, notes, source,
   * source_project_id, alreadySaved } objects. `key` is the lowercased name
   * — stable identifier for the picker. `alreadySaved` is true if this name
   * already exists in the user's personal contacts.
   */
  async listProjectCandidates(userId, projectId) {
    if (!userId) throw new Error('Not authenticated');
    if (!projectId) throw new Error('projectId is required');

    const skipNames = new Set();
    const { data: meRow } = await supabase
      .from('user_profiles')
      .select('full_name')
      .eq('user_id', userId)
      .maybeSingle();
    const selfName = (meRow?.full_name || '').trim().toLowerCase();
    if (selfName) skipNames.add(selfName);

    const { data: members } = await supabase
      .from('project_members')
      .select('user_id, user_email, role')
      .eq('project_id', projectId);
    const memberIds = (members || []).map(m => m.user_id).filter(Boolean);
    let profilesById = new Map();
    if (memberIds.length) {
      const { data: profileRows } = await supabase
        .from('user_profiles')
        .select('user_id, full_name, phone')
        .in('user_id', memberIds);
      profilesById = new Map((profileRows || []).map(p => [p.user_id, p]));
    }

    const raw = [];
    for (const m of members || []) {
      if (m.user_id === userId) continue;
      const profile = profilesById.get(m.user_id) || {};
      const name = (profile.full_name || m.user_email || '').trim();
      if (!name) continue;
      raw.push({
        name,
        email: m.user_email || null,
        phone: profile.phone || null,
        role: m.role || null,
        notes: null,
        source: 'project_member',
        source_project_id: projectId,
      });
    }

    const { data: contacts } = await supabase
      .from('project_contacts')
      .select('name, email, phone, role, comments')
      .eq('project_id', projectId);
    for (const c of contacts || []) {
      const name = (c.name || '').trim();
      if (!name) continue;
      raw.push({
        name,
        email: c.email || null,
        phone: c.phone || null,
        role: c.role || null,
        notes: c.comments || null,
        source: 'project_contact',
        source_project_id: projectId,
      });
    }

    // Dedupe candidates by lower(name) — merge non-blank fields so a member
    // who's also listed as a project_contact gets the union of both.
    const merged = new Map();
    for (const cand of raw) {
      const key = cand.name.toLowerCase();
      if (skipNames.has(key)) continue;
      if (!merged.has(key)) {
        merged.set(key, { key, ...cand });
      } else {
        const existing = merged.get(key);
        for (const field of ['email', 'phone', 'role', 'notes']) {
          if (!existing[field] && cand[field]) existing[field] = cand[field];
        }
      }
    }

    const candidates = [...merged.values()];
    if (candidates.length === 0) return [];

    // Mark candidates that are already in the user's personal contacts.
    const { data: existing } = await supabase
      .from('user_personal_contacts')
      .select('name')
      .eq('user_id', userId);
    const existingLower = new Set(
      (existing || []).map(r => (r.name || '').trim().toLowerCase())
    );
    for (const c of candidates) {
      c.alreadySaved = existingLower.has(c.key);
    }

    candidates.sort((a, b) => a.name.localeCompare(b.name));
    return candidates;
  },

  /**
   * Upsert the given candidates into the personal address book. Each entry
   * is merged by lower(name) — only blank fields on the existing record get
   * filled, so prior manual edits are preserved. Returns { added, updated,
   * skipped } counts.
   */
  async importContacts(userId, candidates) {
    if (!userId) throw new Error('Not authenticated');
    const list = Array.isArray(candidates) ? candidates : [];
    const counts = { added: 0, updated: 0, skipped: 0 };
    for (const cand of list) {
      const name = (cand?.name || '').trim();
      if (!name) {
        counts.skipped += 1;
        continue;
      }
      try {
        const { data: existing } = await supabase
          .from('user_personal_contacts')
          .select('id')
          .eq('user_id', userId)
          .ilike('name', name);
        const exists = (existing || []).some(
          row => (row.name || '').trim().toLowerCase() === name.toLowerCase()
        );
        await this.upsertByName(userId, {
          name,
          email: cand.email,
          phone: cand.phone,
          role: cand.role,
          notes: cand.notes,
          source: cand.source || 'project_member',
          source_project_id: cand.source_project_id || null,
        });
        if (exists) counts.updated += 1;
        else counts.added += 1;
      } catch (e) {
        console.warn('Skipping contact import for', name, e);
        counts.skipped += 1;
      }
    }
    return counts;
  },

  /**
   * Idempotent helper used from the gear modal: ensures a contact with the
   * given name exists, optionally with extra fields. Resolves with the
   * stored contact (existing or newly created). Used by "Save as contact"
   * action next to the Holding-for input.
   */
  async saveAsContact(userId, name, extra = {}) {
    return await this.upsertByName(userId, { name, ...extra });
  },
};

export default UserContactsService;
