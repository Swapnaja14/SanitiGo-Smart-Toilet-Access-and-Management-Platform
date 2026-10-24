/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing, mock simulation, and status verification
 */

/**
 * @swagger
 * /api/bookings/{bookingId}/payment:
 *   post:
 *     summary: Initiate payment for a booking
 *     description: Creates or reuses a PENDING payment record using the saved booking amount.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentMethod
 *             properties:
 *               paymentMethod:
 *                 type: string
 *                 enum: [CARD, UPI, NET_BANKING, WALLET, CASH]
 *                 example: CARD
 *     responses:
 *       201:
 *         description: Payment initiated successfully
 *       400:
 *         description: Booking not eligible
 *       404:
 *         description: Booking not found
 *       409:
 *         description: Booking already paid or confirmed
 *   get:
 *     summary: View payment status for customer's own booking
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status retrieved successfully
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking or payment not found
 */

/**
 * @swagger
 * /api/bookings/{bookingId}/payment/mock-result:
 *   post:
 *     summary: Simulate mock payment result (Development only)
 *     description: Simulates SUCCESS or FAILED outcome for development and testing. Disabled in production.
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - outcome
 *             properties:
 *               outcome:
 *                 type: string
 *                 enum: [SUCCESS, FAILED]
 *                 example: SUCCESS
 *     responses:
 *       200:
 *         description: Mock payment result processed
 *       400:
 *         description: Invalid outcome
 *       404:
 *         description: No payment exists or endpoint disabled
 *       409:
 *         description: Cannot change status or no pending payment available
 */
