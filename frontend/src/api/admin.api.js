import apiClient from './client';

export const adminApi = {
  /**
   * Fetch platform analytics and KPI stats
   * @returns {Promise<{ users: Object, toilets: Object, bookings: Object, financials: Object, sessions: Object }>}
   */
  getStats: async () => {
    const response = await apiClient.get('/admin/stats');
    return response.data?.data?.stats;
  },

  /**
   * List users directory with filtering and pagination
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {string} [params.role]
   * @param {boolean|string} [params.isActive]
   * @param {string} [params.search]
   * @returns {Promise<{ users: Array, pagination: Object }>}
   */
  getUsers: async (params = {}) => {
    const cleanParams = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.role && params.role !== 'ALL') cleanParams.role = params.role;
    if (params.isActive !== undefined && params.isActive !== 'ALL') {
      cleanParams.isActive = params.isActive;
    }
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

    const response = await apiClient.get('/admin/users', { params: cleanParams });
    return response.data?.data ?? { users: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
  },

  /**
   * Toggle user account activation status
   * @param {string} userId
   * @param {boolean} isActive
   * @returns {Promise<Object>}
   */
  setUserStatus: async (userId, isActive) => {
    const response = await apiClient.patch(`/admin/users/${userId}/status`, { isActive });
    return response.data?.data?.user;
  },

  /**
   * List all toilets with filtering and pagination
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {boolean|string} [params.isVerified]
   * @param {boolean|string} [params.isAvailable]
   * @param {string} [params.search]
   * @returns {Promise<{ toilets: Array, pagination: Object }>}
   */
  getToilets: async (params = {}) => {
    const cleanParams = {};
    if (params.page) cleanParams.page = params.page;
    if (params.limit) cleanParams.limit = params.limit;
    if (params.isVerified !== undefined && params.isVerified !== 'ALL') {
      cleanParams.isVerified = params.isVerified;
    }
    if (params.isAvailable !== undefined && params.isAvailable !== 'ALL') {
      cleanParams.isAvailable = params.isAvailable;
    }
    if (params.search && params.search.trim()) cleanParams.search = params.search.trim();

    const response = await apiClient.get('/admin/toilets', { params: cleanParams });
    return response.data?.data ?? { toilets: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 } };
  },

  /**
   * Update verification status for a toilet facility
   * @param {string} toiletId
   * @param {boolean} isVerified
   * @returns {Promise<Object>}
   */
  setToiletVerification: async (toiletId, isVerified) => {
    const response = await apiClient.patch(`/admin/toilets/${toiletId}/verify`, { isVerified });
    return response.data?.data?.toilet;
  },
};

export default adminApi;
