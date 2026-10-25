import apiClient from './client';

export const toiletsApi = {
  /**
   * Search toilets with keyword, filters, and pagination
   */
  search: async (params = {}) => {
    const response = await apiClient.get('/toilets/search', { params });
    return response.data;
  },

  /**
   * Discover nearby toilets based on geospatial coordinates
   * @param {Object} coords - { latitude, longitude, radius }
   */
  getNearby: async ({ latitude, longitude, radius = 5 }) => {
    const response = await apiClient.get('/toilets/nearby', {
      params: { latitude, longitude, radius },
    });
    return response.data;
  },

  /**
   * Get single toilet details with operating hours, amenities, and images
   */
  getById: async (toiletId) => {
    const response = await apiClient.get(`/toilets/${toiletId}`);
    return response.data;
  },

  /**
   * Get public reviews for a specific toilet
   */
  getReviews: async (toiletId, params = {}) => {
    const response = await apiClient.get(`/reviews/toilet/${toiletId}`, { params });
    return response.data;
  },
};

export default toiletsApi;
