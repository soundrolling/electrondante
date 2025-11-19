// Authentication API client for Electron app
// Handles login, token refresh, and room management

class AuthClient {
  constructor(baseUrl) {
    // Remove trailing slash and convert http/https to ws/wss for WebSocket
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiUrl = this.baseUrl.replace(/^wss?:\/\//, 'https://').replace(/^ws:\/\//, 'http://');
    
    // Token storage
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    
    // Load tokens from localStorage if available
    this.loadTokens();
  }
  
  // Load tokens from localStorage
  loadTokens() {
    try {
      const stored = localStorage.getItem('auth_tokens');
      if (stored) {
        const tokens = JSON.parse(stored);
        this.accessToken = tokens.accessToken;
        this.refreshToken = tokens.refreshToken;
        this.user = tokens.user;
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  }
  
  // Save tokens to localStorage
  saveTokens() {
    try {
      localStorage.setItem('auth_tokens', JSON.stringify({
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
        user: this.user,
      }));
    } catch (error) {
      console.error('Error saving tokens:', error);
    }
  }
  
  // Clear tokens
  clearTokens() {
    this.accessToken = null;
    this.refreshToken = null;
    this.user = null;
    try {
      localStorage.removeItem('auth_tokens');
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
  
  // Login with email and password
  async login(email, password) {
    try {
      const response = await fetch(`${this.apiUrl}/auth/broadcaster`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });
      
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Login failed' }));
        throw new Error(error.error || `Login failed: ${response.statusText}`);
      }
      
      const data = await response.json();
      this.accessToken = data.accessToken;
      this.refreshToken = data.refreshToken;
      this.user = data.user;
      this.saveTokens();
      
      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }
  
  // Refresh access token
  async refreshAccessToken() {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }
    
    try {
      const response = await fetch(`${this.apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.refreshToken}`,
        },
        body: JSON.stringify({ refreshToken: this.refreshToken }),
      });
      
      if (!response.ok) {
        // Refresh token expired - clear tokens
        this.clearTokens();
        throw new Error('Refresh token expired');
      }
      
      const data = await response.json();
      this.accessToken = data.accessToken;
      this.saveTokens();
      
      return data.accessToken;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  }
  
  // Get valid access token (refresh if needed)
  async getValidAccessToken() {
    if (!this.accessToken) {
      if (this.refreshToken) {
        await this.refreshAccessToken();
      } else {
        throw new Error('Not authenticated');
      }
    }
    
    // Token is valid (we'll let the server validate expiry)
    return this.accessToken;
  }
  
  // Create a room
  async createRoom(password, name = null, metadata = {}) {
    const token = await this.getValidAccessToken();
    
    try {
      const response = await fetch(`${this.apiUrl}/auth/room/create`, {
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
        throw new Error(error.error || `Room creation failed: ${response.statusText}`);
      }
      
      return await response.json();
    } catch (error) {
      // If token expired, try refreshing once
      if (error.message.includes('expired') || error.message.includes('Invalid token')) {
        await this.refreshAccessToken();
        return this.createRoom(password, name, metadata);
      }
      throw error;
    }
  }
  
  // Join a room
  async joinRoom(roomCode, password) {
    try {
      const response = await fetch(`${this.apiUrl}/auth/room/join`, {
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
      
      return await response.json();
    } catch (error) {
      console.error('Join room error:', error);
      throw error;
    }
  }
  
  // Logout
  logout() {
    this.clearTokens();
  }
  
  // Check if user is authenticated
  isAuthenticated() {
    return !!this.accessToken && !!this.user;
  }
  
  // Get current user
  getCurrentUser() {
    return this.user;
  }
  
  // Get tokens (for admin panel)
  getTokens() {
    return {
      accessToken: this.accessToken,
      refreshToken: this.refreshToken,
      user: this.user,
    };
  }
}

module.exports = AuthClient;

