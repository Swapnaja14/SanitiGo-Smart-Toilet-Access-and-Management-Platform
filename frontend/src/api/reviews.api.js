import apiClient from './client';

export const reviewsApi = {
  /**
   * Fetch reviews for a toilet facility with summary and pagination
   * @param {string} toiletId
   * @param {Object} params - { page, limit }
   */
  getToiletReviews: async (toiletId, params = {}) => {
    const response = await apiClient.get(`/reviews/toilet/${toiletId}`, { params });
    return response.data;
  },

  /**
   * Fetch reviews submitted by the current authenticated user
   * @param {Object} params
   */
  getMyReviews: async (params = {}) => {
    const response = await apiClient.get('/reviews/my', { params });
    return response.data;
  },

  /**
   * Submit or update a review for a toilet facility
   * @param {string} toiletId
   * @param {Object} payload - { rating (1-5), comment, sessionId?, bookingId? }
   */
  submitReview: async (toiletId, payload) => {
    const response = await apiClient.post(`/reviews/toilet/${toiletId}`, payload);
    return response.data;
  },

  /**
   * Delete a review by ID
   * @param {string} reviewId
   */
  deleteReview: async (reviewId) => {
    const response = await apiClient.delete(`/reviews/${reviewId}`);
    return response.data;
  },
};

export default reviewsApi;
