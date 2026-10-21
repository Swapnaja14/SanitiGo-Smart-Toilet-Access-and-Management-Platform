/**
 * @swagger
 * tags:
 *   name: Sessions
 *   description: Owner token verification and active usage session management
 */

/**
 * @swagger
 * /api/v1/sessions/verify-token:
 *   post:
 *     summary: Verify customer token and start active usage session (Owner only)
 *     description: Owner verifies customer access token (e.g. SG-493928), validates booking, ownership, payment status, and starts an ACTIVE session.
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 example: SG-493928
 *                 description: Customer 6-digit access token
 *               toiletId:
 *                 type: string
 *                 description: Optional toilet ID to verify against
 *     responses:
 *       200:
 *         description: Token verified and active session started
 *       400:
 *         description: Unpaid token or expired booking
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Not the owner of this toilet
 *       404:
 *         description: Token or booking not found
 *       409:
 *         description: Active session already in progress
 */

/**
 * @swagger
 * /api/v1/sessions/{sessionId}/end:
 *   patch:
 *     summary: End an active usage session (Owner only)
 *     description: Marks active session as COMPLETED, calculates duration in minutes, and updates booking status to COMPLETED.
 *     tags: [Sessions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sessionId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Session ended successfully
 *       400:
 *         description: Session is already ended or cancelled
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Session not found
 */
