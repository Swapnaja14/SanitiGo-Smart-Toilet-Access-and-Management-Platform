import apiClient from './client';

export const notificationsApi = {
  /**
   * Fetch unread notification count for the authenticated user
   * @returns {Promise<number>}
   */
  getUnreadCount: async () => {
    const response = await apiClient.get('/notifications/unread-count');
    return response.data?.data?.unreadCount ?? 0;
  },

  /**
   * Fetch paginated notifications with optional unreadOnly filter
   * @param {Object} params
   * @param {number} [params.page=1]
   * @param {number} [params.limit=20]
   * @param {boolean} [params.unreadOnly=false]
   * @returns {Promise<{ notifications: Array, pagination: Object, unreadCount: number }>}
   */
  getNotifications: async ({ page = 1, limit = 20, unreadOnly = false } = {}) => {
    const params = {
      page,
      limit,
    };
    if (unreadOnly) {
      params.unreadOnly = 'true';
    }
    const response = await apiClient.get('/notifications', { params });
    return response.data?.data ?? { notifications: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 1 }, unreadCount: 0 };
  },

  /**
   * Mark a single notification as read by ID
   * @param {string} notificationId
   * @returns {Promise<Object>}
   */
  markAsRead: async (notificationId) => {
    const response = await apiClient.patch(`/notifications/${notificationId}/read`);
    return response.data?.data?.notification;
  },

  /**
   * Mark all unread notifications as read for current user
   * @returns {Promise<{ updatedCount: number }>}
   */
  markAllAsRead: async () => {
    const response = await apiClient.patch('/notifications/read-all');
    return response.data?.data ?? { updatedCount: 0 };
  },
};

export default notificationsApi;
