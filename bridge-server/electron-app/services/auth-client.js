// Authentication API client for Electron app
// Handles login, token refresh, and room management using Supabase

const { createClient } = require('@supabase/supabase-js');
const constants = require('../config/constants');

class AuthClient {
  constructor(railwayUrl = '') {
    // Railway URL for WebSocket connections
    this.railwayUrl = railwayUrl.replace(/\/$/, '');
    this.railwayApiUrl = this.railwayUrl.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    
    // Supabase client initialization
    // Note: These should be set via environment variables or user config
    const supabaseUrl = constants.SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseAnonKey = constants.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase credentials not configured. Set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.');
    }
    
    this.supabase = supabaseUrl && supabaseAnonKey 
      ? createClient(supabaseUrl, supabaseAnonKey, {
          auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: false,
          }
        })
      : null;
    
    // Current user and session
    this.user = null;
    this.session = null;
    
    // Load existing session
    this.loadSession();
  }
  
  // Load session from Supabase
  async loadSession() {
    if (!this.supabase) return;
    
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      if (error) {
        console.error('Error loading session:', error);
        return;
      }
      
      if (session) {
        this.session = session;
        this.user = session.user;
        console.log('Session loaded for user:', this.user.email);
      }
    } catch (error) {
      console.error('Error loading session:', error);
    }
  }
  
  // Login with email and password using Supabase
  async login(email, password) {
    if (!this.supabase) {
      throw new Error('Supabase not configured. Please set SUPABASE_URL and SUPABASE_ANON_KEY.');
    }
    
    try {
      console.log('Attempting Supabase login for:', email);
      
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        console.error('Supabase login error:', error);
        throw new Error(error.message || 'Login failed');
      }
      
      if (!data.session || !data.user) {
        throw new Error('Login failed: No session returned');
      }
      
      this.session = data.session;
      this.user = data.user;
      
      console.log('Login successful for user:', this.user.email);
      
      return {
        user: this.user,
        session: this.session,
        accessToken: this.session.access_token,
        refreshToken: this.session.refresh_token,
      };
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  // Refresh access token using Supabase
  async refreshAccessToken() {
    if (!this.supabase) {
      throw new Error('Supabase not configured');
    }
    
    if (!this.session?.refresh_token) {
      throw new Error('No refresh token available');
    }
    
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: this.session.refresh_token
      });
      
      if (error) {
        console.error('Token refresh error:', error);
        this.clearSession();
        throw new Error('Refresh token expired');
      }
      
      if (!data.session) {
        throw new Error('Failed to refresh session');
      }
      
      this.session = data.session;
      this.user = data.user;
      
      console.log('Token refreshed successfully');
      
      return this.session.access_token;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
  
  // Get valid access token (refresh if needed)
  async getValidAccessToken() {
    if (!this.session) {
      throw new Error('Not authenticated');
    }
    
    // Check if token is expired or about to expire (within 5 minutes)
    const expiresAt = this.session.expires_at;
    const now = Math.floor(Date.now() / 1000);
    const timeUntilExpiry = expiresAt - now;
    
    if (timeUntilExpiry < 300) { // Less than 5 minutes
      console.log('Token expiring soon, refreshing...');
      await this.refreshAccessToken();
    }
    
    return this.session.access_token;
  }
  
  // Create a room using Railway API with Supabase JWT
  async createRoom(password, name = null, metadata = {}) {
    const token = await this.getValidAccessToken();
    
    if (!this.railwayApiUrl) {
      throw new Error('Railway URL not configured');
    }
    
    try {
      console.log('Creating room via Railway API...');
      
      const response = await fetch(`${this.railwayApiUrl}/auth/room/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          password,
          name: name || undefined,
          metadata,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Room creation failed' }));
        
        // If token expired, try refreshing once
        if (response.status === 401 || response.status === 403) {
          console.log('Token invalid, attempting refresh...');
          await this.refreshAccessToken();
          // Retry with new token
          return this.createRoom(password, name, metadata);
        }
        
        throw new Error(error.error || `Room creation failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Room created successfully:', result.roomCode);
      
      return result;
    } catch (error) {
      console.error('Error creating room:', error);
      throw error;
    }
  }
  
  // Join a room (no authentication required for listeners)
  async joinRoom(roomCode, password) {
    if (!this.railwayApiUrl) {
      throw new Error('Railway URL not configured');
    }
    
    try {
      console.log('Joining room:', roomCode);
      
      const response = await fetch(`${this.railwayApiUrl}/auth/room/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          password,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Join failed' }));
        throw new Error(error.error || `Join failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('Joined room successfully:', roomCode);
      
      return result;
    } catch (error) {
      console.error('Join room error:', error);
      throw error;
    }
  }
  
  // Logout
  async logout() {
    if (this.supabase && this.session) {
      try {
        await this.supabase.auth.signOut();
      } catch (error) {
        console.error('Error signing out:', error);
      }
    }
    this.clearSession();
  }
  
  // Clear session
  clearSession() {
    this.session = null;
    this.user = null;
    console.log('Session cleared');
  }
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!this.session && !!this.user;
  }
  
  // Get current user
  getCurrentUser() {
    return this.user;
  }
  
  // Get tokens (for admin panel)
  getTokens() {
    if (!this.session) {
      return null;
    }
    
    return {
      accessToken: this.session.access_token,
      refreshToken: this.session.refresh_token,
      user: this.user,
    };
  }
  
  // Set Railway URL (can be updated after initialization)
  setRailwayUrl(url) {
    this.railwayUrl = url.replace(/\/$/, '');
    this.railwayApiUrl = this.railwayUrl.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
  }
}

module.exports = AuthClient;
