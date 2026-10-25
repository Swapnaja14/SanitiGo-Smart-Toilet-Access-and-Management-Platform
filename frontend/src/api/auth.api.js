import apiClient from './client';

export const authApi = {
  login: async (credentials) => {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  register: async (userData) => {
    const response = await apiClient.post('/auth/register', userData);
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put('/auth/profile', profileData);
    return response.data;
  },

  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    } finally {
      localStorage.removeItem('sanitigo_access_token');
      localStorage.removeItem('sanitigo_user');
    }
  },

  refreshToken: async () => {
    const response = await apiClient.post('/auth/refresh-token');
    return response.data;
  },
};

export default authApi;
