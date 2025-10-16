/**
 * Auth service for handling authentication-related API calls
 */

export const authService = {
  /**
   * Initiate Google OAuth login flow
   */
  initiateGoogleLogin: () => {
    window.location.href = '/api/auth/google/login';
  },

  /**
   * Logout the current user
   */
  logout: async () => {
    try {
      const token = localStorage.getItem('mtg_auth_token');
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error('Error during logout:', error);
    }
  },

  /**
   * Get the stored auth token
   */
  getToken: (): string | null => {
    return localStorage.getItem('mtg_auth_token');
  },

  /**
   * Store auth token
   */
  setToken: (token: string): void => {
    localStorage.setItem('mtg_auth_token', token);
  },

  /**
   * Remove auth token
   */
  removeToken: (): void => {
    localStorage.removeItem('mtg_auth_token');
  },
};
