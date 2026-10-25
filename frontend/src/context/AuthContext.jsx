import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authApi from '../api/auth.api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('sanitigo_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('sanitigo_access_token') || null;
  });

  const [isLoading, setIsLoading] = useState(true);

  // Sync state and storage
  const handleAuthSuccess = useCallback((userData, accessToken) => {
    setUser(userData);
    setToken(accessToken);
    if (accessToken) {
      localStorage.setItem('sanitigo_access_token', accessToken);
    }
    if (userData) {
      localStorage.setItem('sanitigo_user', JSON.stringify(userData));
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      if (token) {
        await authApi.logout();
      }
    } catch (err) {
      console.warn('Logout error (clearing local session regardless):', err);
    } finally {
      setUser(null);
      setToken(null);
      localStorage.removeItem('sanitigo_access_token');
      localStorage.removeItem('sanitigo_user');
    }
  }, [token]);

  // Handle token expiration event from axios interceptor
  useEffect(() => {
    const handleExpired = () => {
      setUser(null);
      setToken(null);
    };

    window.addEventListener('sanitigo:auth_expired', handleExpired);
    return () => window.removeEventListener('sanitigo:auth_expired', handleExpired);
  }, []);

  // Validate session on initial boot if token exists
  useEffect(() => {
    let isMounted = true;

    async function initAuth() {
      if (!token) {
        if (isMounted) setIsLoading(false);
        return;
      }

      try {
        const response = await authApi.getCurrentUser();
        if (isMounted && response?.data) {
          setUser(response.data);
          localStorage.setItem('sanitigo_user', JSON.stringify(response.data));
        }
      } catch (error) {
        console.warn('Failed to verify existing session token:', error);
        if (isMounted) {
          setUser(null);
          setToken(null);
          localStorage.removeItem('sanitigo_access_token');
          localStorage.removeItem('sanitigo_user');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    initAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (credentials) => {
    const response = await authApi.login(credentials);
    const { user: userData, accessToken } = response.data;
    handleAuthSuccess(userData, accessToken);
    return userData;
  };

  const register = async (userDataInput) => {
    const response = await authApi.register(userDataInput);
    const { user: userData, accessToken } = response.data;
    handleAuthSuccess(userData, accessToken);
    return userData;
  };

  const updateProfile = async (profileData) => {
    const response = await authApi.updateProfile(profileData);
    const updatedUser = response?.data;
    if (updatedUser) {
      setUser(updatedUser);
      localStorage.setItem('sanitigo_user', JSON.stringify(updatedUser));
    }
    return updatedUser;
  };

  const refreshUser = async () => {
    try {
      const response = await authApi.getCurrentUser();
      if (response?.data) {
        setUser(response.data);
        localStorage.setItem('sanitigo_user', JSON.stringify(response.data));
      }
    } catch (err) {
      console.error('Error refreshing user profile:', err);
    }
  };

  const role = user?.role || null;
  const isCustomer = role === 'USER';
  const isOwner = role === 'OWNER';
  const isAdmin = role === 'ADMIN';
  const isAuthenticated = !!token && !!user;

  const value = {
    user,
    token,
    role,
    isAuthenticated,
    isCustomer,
    isOwner,
    isAdmin,
    isLoading,
    login,
    register,
    logout,
    updateProfile,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
