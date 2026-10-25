import apiClient from './client';

export const bookingsApi = {
  /**
   * Create a new booking
   * @param {Object} payload - { toiletId, scheduledDate, startTime, endTime, paymentMethod }
   */
  createBooking: async (payload) => {
    const response = await apiClient.post('/bookings', payload);
    return response.data;
  },

  /**
   * Fetch customer's bookings with pagination and status filter
   * @param {Object} params - { page, limit, status }
   */
  getMyBookings: async (params = {}) => {
    const response = await apiClient.get('/bookings', { params });
    return response.data;
  },

  /**
   * Fetch single booking details by ID
   * @param {string} bookingId
   */
  getMyBookingById: async (bookingId) => {
    const response = await apiClient.get(`/bookings/${bookingId}`);
    return response.data;
  },

  /**
   * Cancel a booking
   * @param {string} bookingId
   */
  cancelBooking: async (bookingId) => {
    const response = await apiClient.patch(`/bookings/${bookingId}/cancel`);
    return response.data;
  },

  /**
   * Complete payment for booking (supports mock payment simulation in dev)
   * @param {string} bookingId
   * @param {Object} payload - { paymentMethod, outcome: "SUCCESS" | "FAILED" }
   */
  processPayment: async (bookingId, payload = { outcome: 'SUCCESS' }) => {
    const outcome = payload.outcome || payload.result || 'SUCCESS';
    const response = await apiClient.post(`/payments/${bookingId}/payment/mock-result`, {
      outcome,
    });
    return response.data;
  },
};

export default bookingsApi;
