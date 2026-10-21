/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Smart toilet booking and access token management
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create a new booking
 *     description: Creates a new toilet booking for an authenticated customer with role USER. Checks toilet availability, operating hours, capacity, and generates an access token.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toiletId
 *               - scheduledDate
 *               - startTime
 *               - endTime
 *               - paymentMethod
 *             properties:
 *               toiletId:
 *                 type: string
 *                 example: clxyz1234567890
 *                 description: Unique CUID identifier of the toilet
 *               scheduledDate:
 *                 type: string
 *                 example: "2026-10-25"
 *                 description: Booking date in YYYY-MM-DD format
 *               startTime:
 *                 type: string
 *                 example: "10:00"
 *                 description: Intended start time in HH:mm format
 *               endTime:
 *                 type: string
 *                 example: "10:30"
 *                 description: Intended end time in HH:mm format
 *               paymentMethod:
 *                 type: string
 *                 enum: [CARD, UPI, NET_BANKING, WALLET, CASH]
 *                 example: UPI
 *                 description: Chosen payment method
 *     responses:
 *       201:
 *         description: Booking created successfully with generated access token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Booking created successfully.
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: clbk987654321
 *                     token:
 *                       type: string
 *                       example: SG-493928
 *                     status:
 *                       type: string
 *                       example: PENDING
 *                     scheduledDate:
 *                       type: string
 *                       example: "2026-10-25T00:00:00.000Z"
 *                     startTime:
 *                       type: string
 *                       example: "2026-10-25T10:00:00.000Z"
 *                     endTime:
 *                       type: string
 *                       example: "2026-10-25T10:30:00.000Z"
 *                     payment:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         amount:
 *                           type: string
 *                           example: "25.00"
 *                         currency:
 *                           type: string
 *                           example: INR
 *                         paymentMethod:
 *                           type: string
 *                           example: UPI
 *                         paymentStatus:
 *                           type: string
 *                           example: PENDING
 *       400:
 *         description: Validation failed or outside operating hours
 *       401:
 *         description: Authentication required or invalid token
 *       403:
 *         description: Forbidden - Customer USER role required
 *       404:
 *         description: Toilet not found
 *       409:
 *         description: Toilet fully booked for selected time
 */

/**
 * @swagger
 * /api/bookings:
 *   post:
 *     summary: Create a new booking (convenience route)
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - toiletId
 *               - scheduledDate
 *               - startTime
 *               - endTime
 *               - paymentMethod
 *             properties:
 *               toiletId:
 *                 type: string
 *                 example: clxyz1234567890
 *               scheduledDate:
 *                 type: string
 *                 example: "2026-10-25"
 *               startTime:
 *                 type: string
 *                 example: "10:00"
 *               endTime:
 *                 type: string
 *                 example: "10:30"
 *               paymentMethod:
 *                 type: string
 *                 enum: [CARD, UPI, NET_BANKING, WALLET, CASH]
 *                 example: UPI
 *     responses:
 *       201:
 *         description: Booking created successfully
 *       400:
 *         description: Bad request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: Fully booked
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: List customer bookings
 *     description: Returns a list of all bookings made by the currently authenticated user with optional status and upcoming/past filters.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, CONFIRMED, IN_PROGRESS, CANCELLED, COMPLETED, EXPIRED]
 *         description: Filter by booking status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [upcoming, past]
 *         description: Filter by timeline
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/bookings/{bookingId}:
 *   get:
 *     summary: Get booking details by ID
 *     description: Returns details of a specific booking owned by the authenticated customer.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking details retrieved
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/cancel:
 *   patch:
 *     summary: Cancel a booking
 *     description: Cancels a booking before usage. If payment was already completed, updates payment status to REFUNDED.
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *         description: Booking ID
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 *       400:
 *         description: Cannot cancel completed booking or booking with active session
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Booking not found
 */
