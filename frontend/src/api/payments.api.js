import apiClient from './client';

export const paymentsApi = {
  /**
   * Initiate a payment for a booking
   * @param {string} bookingId
   * @param {string} paymentMethod - 'UPI' | 'CARD' | 'NET_BANKING' | 'WALLET' | 'CASH'
   */
  initiatePayment: async (bookingId, paymentMethod = 'UPI') => {
    const response = await apiClient.post(`/payments/${bookingId}/payment`, {
      paymentMethod,
    });
    return response.data;
  },

  /**
   * Fetch verified payment status from server
   * @param {string} bookingId
   */
  getPaymentStatus: async (bookingId) => {
    const response = await apiClient.get(`/payments/${bookingId}/payment`);
    return response.data;
  },

  /**
   * Simulate mock payment outcome in permitted dev/test environment
   * The server validates NODE_ENV !== 'production' and PAYMENT_MODE === 'mock'
   * @param {string} bookingId
   * @param {'SUCCESS' | 'FAILED'} outcome
   */
  simulateMockPayment: async (bookingId, outcome = 'SUCCESS') => {
    const response = await apiClient.post(
      `/payments/${bookingId}/payment/mock-result`,
      { outcome }
    );
    return response.data;
  },

  /**
   * Create Razorpay standard order for real provider checkout
   * @param {string} bookingId
   */
  createRazorpayOrder: async (bookingId) => {
    const response = await apiClient.post(
      `/payments/${bookingId}/payment/razorpay-order`
    );
    return response.data;
  },

  /**
   * Verify Razorpay cryptographic HMAC signature on server
   * @param {string} bookingId
   * @param {Object} verificationData - { razorpayOrderId, razorpayPaymentId, razorpaySignature }
   */
  verifyRazorpayPayment: async (bookingId, verificationData) => {
    const response = await apiClient.post(
      `/payments/${bookingId}/payment/razorpay-verify`,
      verificationData
    );
    return response.data;
  },
};

export default paymentsApi;
