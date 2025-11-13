// src/stores/userStore.js

import { defineStore } from 'pinia';
import { supabase } from '../supabase';
import CryptoJS from 'crypto-js';
import { openDB } from 'idb';
import { useToast } from 'vue-toastification';
import { saveSetting, getSetting, clearAllData } from '@/utils/indexedDB';

const toast = useToast();

const ENCRYPTION_KEY = process.env.VUE_APP_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
  throw new Error(
    'Encryption key not set in env vars (VUE_APP_ENCRYPTION_KEY).'
  );
}
const SESSION_EXPIRATION_TIME = 3_600_000; // 1 hour in ms

export const useUserStore = defineStore('userStore', {
  state: () => ({
    user: null,
    userEmail: null,
    currentProject: null,
    authError: null,
    userProfile: null,
    liveTimecode: localStorage.getItem('liveTimecode') || '00:00:00',
    contacts: [],
    isLoading: false,
    isSubmitting: false,
    currentTimeSource:
      localStorage.getItem('currentTimeSource') || 'device',
    onlineStatus: navigator.onLine,
    _intervalId: null,
    isInitialized: false,
    db: null,
    worldOffset:
      Number(localStorage.getItem('worldOffset')) || 0
  }),

  actions: {
    async initializeStore() {
      if (this.isInitialized) return;
      try {
        const { data: { session }, error: sessionError } =
          await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!session) {
          await this.clearSession();
          return;
        }

        await this.fetchUserSession();
        await this.initDB();
        await this.loadProjectFromLocalStorage();
        if (this.currentProject?.id) {
          await saveSetting('current-project-id', this.currentProject.id);
        }
        this.initializeOnlineStatus();
        this.initializeTimeSource();
        this.isInitialized = true;
      } catch (e) {
        console.error('Failed to initialize store:', e);
        toast.error(`Init failed: ${e.message}`);
        this.authError = e.message;
        if (/(Invalid Refresh Token|expired)/i.test(e.message)) {
          await this.clearSession();
          window.location.href = '/login';
        }
      }
    },

    async initDB() {
      if (this.db) return this.db;
      try {
        this.db = await openDB('UserStore', 2, {
          upgrade(db) {
            if (!db.objectStoreNames.contains('session'))
              db.createObjectStore('session');
            if (!db.objectStoreNames.contains('project'))
              db.createObjectStore('project');
            if (!db.objectStoreNames.contains('contacts'))
              db.createObjectStore('contacts', { keyPath: 'id' });
          }
        });
        return this.db;
      } catch (e) {
        console.error('Failed to init IndexedDB (userStore):', e);
        toast.error(`IDB init failed: ${e.message}`);
        return null;
      }
    },

    initializeOnlineStatus() {
      window.addEventListener('online', this.updateOnlineStatus);
      window.addEventListener('offline', this.updateOnlineStatus);
    },
    updateOnlineStatus() {
      this.onlineStatus = navigator.onLine;
    },
    cleanupOnlineStatus() {
      window.removeEventListener('online', this.updateOnlineStatus);
      window.removeEventListener('offline', this.updateOnlineStatus);
    },

    cleanupTimecode() {
      if (this._intervalId) {
        clearInterval(this._intervalId);
        this._intervalId = null;
      }
    },

    encryptData(data) {
      return CryptoJS.AES.encrypt(
        JSON.stringify(data),
        ENCRYPTION_KEY
      ).toString();
    },
    decryptData(cipher) {
      try {
        const bytes = CryptoJS.AES.decrypt(cipher, ENCRYPTION_KEY);
        return JSON.parse(bytes.toString(CryptoJS.enc.Utf8));
      } catch (e) {
        console.error('Decryption failed:', e);
        return null;
      }
    },

    async saveSessionToLocalStorage(user, accessToken) {
      const payload = {
        user: this.encryptData(user),
        timestamp: Date.now()
      };
      localStorage.setItem('userSession', JSON.stringify(payload));
      if (this.db) {
        try {
          await this.db.put('session', payload, 'userSession');
        } catch (e) {
          console.error('IDB save session failed:', e);
        }
      }
      await saveSetting('supabase-token', accessToken);
    },
    async loadSessionFromLocalStorage() {
      let payload = JSON.parse(localStorage.getItem('userSession'));
      if (!payload && this.db) {
        try {
          payload = await this.db.get('session', 'userSession');
        } catch (e) {
          console.error('IDB load session failed:', e);
        }
      }
      if (!payload) return null;
      if (Date.now() - payload.timestamp > SESSION_EXPIRATION_TIME) {
        await this.clearSession();
        return null;
      }
      this.user = this.decryptData(payload.user);
      return this.user;
    },

    async saveProjectToLocalStorage(project) {
      const enc = this.encryptData(project);
      localStorage.setItem('currentProject', enc);
      await saveSetting('current-project-id', project?.id || null);
      if (this.db) {
        try {
          await this.db.put('project', enc, 'currentProject');
        } catch (e) {
          console.error('IDB save project failed:', e);
        }
      }
    },
    async loadProjectFromLocalStorage() {
      let enc = localStorage.getItem('currentProject');
      if (!enc && this.db) {
        try {
          enc = await this.db.get('project', 'currentProject');
        } catch (e) {
          console.error('IDB load project failed:', e);
        }
      }
      if (enc) {
        this.currentProject = this.decryptData(enc);
      }
    },

    async fetchUserSession() {
      try {
        const {
          data: { session },
          error
        } = await supabase.auth.getSession();
        if (error) throw error;
        if (session) {
          this.user = session.user;
          this.userEmail = session.user.email;
          const accessToken = session.access_token;
          await this.saveSessionToLocalStorage(session.user, accessToken);
          await this.fetchUserProfile();
          return this.user;
        } else {
          await this.clearSession();
          return null;
        }
      } catch (e) {
        console.error('fetchUserSession failed:', e);
        toast.error(`Session fetch error: ${e.message}`);
        throw e;
      }
    },

    async fetchUserProfile() {
      if (!this.user) return null;
      try {
        const { data, error, status } = await supabase
          .from('user_profiles')
          .select('id, user_id, full_name, phone, bio, company, role, location, website, social_links, avatar_url, equipment, calendar_event_toggles')
          .eq('id', this.user.id)
          .single();
        if (error && status !== 406) throw error;
        if (data) {
          this.userProfile = data;
          return data;
        }
        this.userProfile = {
          id: this.user.id,
          user_id: this.user.id,
          full_name: this.user.user_metadata?.full_name ?? '',
          phone: '',
          bio: '',
          company: '',
          role: '',
          location: '',
          website: '',
          social_links: {
            linkedin: '',
            twitter: '',
            github: ''
          },
          avatar_url: '',
          equipment: [],
          calendar_event_toggles: {}
        };
        return this.userProfile;
      } catch (e) {
        console.error('fetchUserProfile failed:', e);
        toast.error(`Profile fetch error: ${e.message}`);
        throw e;
      }
    },

    async upsertUserProfile(profile) {
      if (!this.user) throw new Error('Not authenticated');
      try {
        const updates = {
          ...profile,
          id: this.user.id,
          user_id: this.user.id,
          updated_at: new Date().toISOString()
        };
        const { data, error } = await supabase
          .from('user_profiles')
          .upsert(updates)
          .select('id, user_id, full_name, phone, bio, company, role, location, website, social_links, avatar_url, equipment, calendar_event_toggles')
          .single();
        if (error) throw error;
        this.userProfile = data;
        return data;
      } catch (e) {
        console.error('upsertUserProfile failed:', e);
        toast.error(`Profile save error: ${e.message}`);
        throw e;
      }
    },

    async checkProjectMember(email, projectId) {
      try {
        const userId = this.user?.id;
        const { data, error } = await supabase
          .from('project_members')
          .select('*')
          .eq('project_id', projectId)
          .or(`user_id.eq.${userId},user_email.eq.${email}`)
          .single();
        if (error || !data) return null;
        this.$patch({
          user: this.user,
          userEmail: email,
          currentProject: { id: projectId, role: data.role }
        });
        return data;
      } catch (e) {
        console.error('checkProjectMember failed:', e);
        toast.error(`Project membership check failed: ${e.message}`);
        return null;
      }
    },

    async fetchProjectById(projectId) {
      try {
        const { data, error } = await supabase
          .from('projects')
          .select('*')
          .eq('id', projectId)
          .single();
        if (error) throw error;
        this.setCurrentProject(data);
        return data;
      } catch (e) {
        console.error('fetchProjectById failed:', e);
        toast.error(`Project fetch error: ${e.message}`);
        throw e;
      }
    },

    setCurrentProject(project) {
      this.currentProject = project;
      this.saveProjectToLocalStorage(project);
      if (project?.id) {
        this.fetchContacts(project.id).catch((err) => {
          console.error('fetchContacts failed:', err);
          toast.error(`Contacts fetch error: ${err.message}`);
        });
      }
    },

    clearCurrentProject() {
      this.currentProject = null;
      this.contacts = [];
    },

    async fetchContacts(projectId) {
      if (!projectId) return;
      try {
        const { data, error } = await supabase
          .from('project_contacts')
          .select('*')
          .eq('project_id', projectId);
        if (error) throw error;
        this.contacts = data ?? [];
      } catch (e) {
        console.error('fetchContacts failed:', e);
        toast.error(`Contacts fetch error: ${e.message}`);
      }
    },

    async addContact(contact) {
      if (!this.currentProject?.id)
        throw new Error('No project selected');
      try {
        const payload = {
          ...contact,
          project_id: this.currentProject.id
        };
        const { data, error } = await supabase
          .from('project_contacts')
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        this.contacts.push(data);
        return data;
      } catch (e) {
        console.error('addContact failed:', e);
        toast.error(`Add contact failed: ${e.message}`);
        throw e;
      }
    },

    async updateContact(contactId, updated) {
      try {
        const { data, error } = await supabase
          .from('project_contacts')
          .update(updated)
          .eq('id', contactId)
          .select()
          .single();
        if (error) throw error;
        const idx = this.contacts.findIndex(
          (c) => c.id === contactId
        );
        if (idx !== -1) this.contacts[idx] = data;
        return data;
      } catch (e) {
        console.error('updateContact failed:', e);
        toast.error(`Update contact failed: ${e.message}`);
        throw e;
      }
    },

    async deleteContact(contactId) {
      try {
        const { error } = await supabase
          .from('project_contacts')
          .delete()
          .eq('id', contactId);
        if (error) throw error;
        this.contacts = this.contacts.filter(
          (c) => c.id !== contactId
        );
      } catch (e) {
        console.error('deleteContact failed:', e);
        toast.error(`Delete contact failed: ${e.message}`);
        throw e;
      }
    },

    setLiveTimecode(tc) {
      this.liveTimecode = tc;
      localStorage.setItem('liveTimecode', tc);
    },
    incrementLiveTimecode() {
      let [h, m, s] = this.liveTimecode.split(':').map(Number);
      s += 1;
      if (s >= 60) {
        s = 0;
        m += 1;
      }
      if (m >= 60) {
        m = 0;
        h += 1;
      }
      this.setLiveTimecode(
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      );
    },
    startDeviceTime() {
      this.cleanupTimecode();
      this._intervalId = setInterval(() => this.incrementLiveTimecode(), 1000);
    },
    startCustomTimecode(start = '00:00:00') {
      this.setLiveTimecode(start);
      this.cleanupTimecode();
      this._intervalId = setInterval(() => this.incrementLiveTimecode(), 1000);
    },
    startWorldTime() {
      this.cleanupTimecode();
      this._intervalId = setInterval(() => {
        const now = new Date(Date.now() + this.worldOffset * 1000);
        this.setLiveTimecode(
          `${String(now.getUTCHours()).padStart(2, '0')}:${String(now.getUTCMinutes()).padStart(2, '0')}:${String(now.getUTCSeconds()).padStart(2, '0')}`
        );
      }, 1000);
    },
    setWorldOffset(offset) {
      this.worldOffset = offset;
      localStorage.setItem('worldOffset', String(offset));
    },
    setTimeSource(src, custom = '00:00:00') {
      this.currentTimeSource = src;
      localStorage.setItem('currentTimeSource', src);
      if (src === 'device') this.startDeviceTime();
      else if (src === 'custom') this.startCustomTimecode(custom);
      else if (src === 'world') this.startWorldTime();
    },
    setCurrentTimeSource(src, custom = '00:00:00') {
      this.setTimeSource(src, custom);
    },
    initializeTimeSource() {
      this.setTimeSource(this.currentTimeSource);
    },

    async clearSession() {
      this.$patch({
        user: null,
        userEmail: null,
        currentProject: null,
        userProfile: null,
        liveTimecode: '00:00:00',
        contacts: [],
        currentTimeSource: 'device',
        _intervalId: null,
        onlineStatus: navigator.onLine
      });
      
      // Clear all localStorage items
      ['liveTimecode', 'currentTimeSource', 'userSession', 'currentProject'].forEach((k) =>
        localStorage.removeItem(k)
      );
      
      // Clear all user-specific project caches (security measure)
      this.clearUserProjectCaches();
      
      this.cleanupOnlineStatus();
      this.cleanupTimecode();
      if (this.db) {
        try {
          await this.db.clear('session');
          await this.db.clear('project');
          await this.db.clear('contacts');
        } catch (e) {
          console.error('IDB clear error:', e);
        }
      }
      await clearAllData();
    },

    // Clear all user-specific project caches for security
    clearUserProjectCaches() {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('userProjects_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    },

    async signOut() {
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        await this.clearSession();
      } catch (e) {
        console.error('signOut failed:', e);
        toast.error(`Sign-out failed: ${e.message}`);
        throw e;
      }
    }
  },

  getters: {
    isAuthenticated: (s) => !!s.user,
    getUserEmail: (s) => s.userEmail,
    getCurrentProject: (s) => s.currentProject,
    getLiveTimecode: (s) => s.liveTimecode,
    getOnlineStatus: (s) => s.onlineStatus,
    getCurrentTimeSourceLabel: (s) => {
      switch (s.currentTimeSource) {
        case 'device':
          return 'Device Time';
        case 'custom':
          return 'Custom Timecode';
        case 'world':
          return 'World Time (GMT)';
        default:
          return 'Unknown';
      }
    },
    getWorldOffset: (s) => s.worldOffset,
    getContacts: (s) => s.contacts,
    getIsLoading: (s) => s.isLoading,
    getIsSubmitting: (s) => s.isSubmitting,
    getAuthError: (s) => s.authError,
    getUserId: (s) => s.user?.id || null,
    getUserProfile: (s) => s.userProfile
  }
});