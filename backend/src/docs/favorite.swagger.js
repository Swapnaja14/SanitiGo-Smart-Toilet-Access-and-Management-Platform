/**
 * @swagger
 * tags:
 *   name: Favorites
 *   description: Customer favorite toilets management
 */

/**
 * @swagger
 * /api/v1/favorites:
 *   get:
 *     summary: Get all saved favorite toilets for logged in customer
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of favorite toilets
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /api/v1/favorites/{toiletId}:
 *   post:
 *     summary: Add toilet to customer favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toiletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       201:
 *         description: Toilet added to favorites
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Toilet not found
 *   delete:
 *     summary: Remove toilet from customer favorites
 *     tags: [Favorites]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toiletId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Toilet removed from favorites
 *       401:
 *         description: Unauthorized
 */
