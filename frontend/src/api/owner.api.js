import apiClient from './client';

export const ownerApi = {
  /**
   * Fetch all toilets owned by the authenticated owner
   */
  getOwnerToilets: async () => {
    const response = await apiClient.get('/toilets/owner');
    return response.data;
  },

  /**
   * Fetch all bookings for the owner's toilets
   */
  getOwnerBookings: async () => {
    const response = await apiClient.get('/toilets/owner/bookings');
    return response.data;
  },

  /**
   * Create a new toilet facility
   * @param {Object} payload - { name, description, address, city, state, country, postalCode, latitude, longitude, price, capacity }
   */
  createToilet: async (payload) => {
    const response = await apiClient.post('/toilets/create', payload);
    return response.data;
  },

  /**
   * Get single toilet facility details
   * @param {string} toiletId
   */
  getToiletById: async (toiletId) => {
    const response = await apiClient.get(`/toilets/${toiletId}`);
    return response.data;
  },

  /**
   * Update toilet facility details
   * @param {string} toiletId
   * @param {Object} payload
   */
  updateToilet: async (toiletId, payload) => {
    const response = await apiClient.patch(`/toilets/${toiletId}`, payload);
    return response.data;
  },

  /**
   * Delete a toilet facility
   * @param {string} toiletId
   */
  deleteToilet: async (toiletId) => {
    const response = await apiClient.delete(`/toilets/${toiletId}`);
    return response.data;
  },

  /**
   * Upload up to 5 photos for a toilet facility
   * @param {string} toiletId
   * @param {FormData} formData
   */
  uploadToiletImages: async (toiletId, formData) => {
    const response = await apiClient.post(`/toilets/${toiletId}/images`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  /**
   * Update 7-day operating hours for a toilet facility
   * @param {string} toiletId
   * @param {Array} operatingHours - [{ day: 'MONDAY', openingTime: '06:00', closingTime: '22:00', isClosed: false }, ...]
   */
  updateOperatingHours: async (toiletId, operatingHours) => {
    const response = await apiClient.put(`/toilets/${toiletId}/operating-hours`, {
      operatingHours,
    });
    return response.data;
  },

  /**
   * Update amenities assigned to a toilet facility
   * @param {string} toiletId
   * @param {Array<string>} amenityIds
   */
  updateAmenities: async (toiletId, amenityIds) => {
    const response = await apiClient.put(`/toilets/${toiletId}/amenities`, {
      amenityIds,
    });
    return response.data;
  },

  /**
   * Fetch all registered amenities
   */
  getAllAmenities: async () => {
    const response = await apiClient.get('/toilets/amenities');
    return response.data;
  },

  /**
   * Verify customer booking token at turnstile gate
   * @param {string} token - Format SG-123456
   */
  verifyBookingToken: async (token) => {
    const response = await apiClient.post('/owner/verify-token', {
      token: token.trim().toUpperCase(),
    });
    return response.data;
  },

  /**
   * Start usage session upon customer entry
   * @param {string} token
   */
  startSession: async (token) => {
    const response = await apiClient.post('/owner/sessions/start', {
      token: token.trim().toUpperCase(),
    });
    return response.data;
  },

  /**
   * End usage session upon customer exit
   * @param {string} sessionId
   */
  endSession: async (sessionId) => {
    const response = await apiClient.patch(`/owner/sessions/${sessionId}/end`);
    return response.data;
  },

  /**
   * Get session details
   * @param {string} sessionId
   */
  getSessionById: async (sessionId) => {
    const response = await apiClient.get(`/owner/sessions/${sessionId}`);
    return response.data;
  },
};

export default ownerApi;
