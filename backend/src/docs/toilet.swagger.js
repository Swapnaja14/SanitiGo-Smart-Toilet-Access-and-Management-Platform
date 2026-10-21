/**
 * @swagger
 * tags:
 *   name: Toilets
 *   description: Smart toilet listing, search, management, and operating hours
 */

/**
 * @swagger
 * /api/v1/toilets/create:
 *   post:
 *     summary: Create a new toilet (Owner only)
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - address
 *               - city
 *               - state
 *               - country
 *               - postalCode
 *               - latitude
 *               - longitude
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 example: Central Smart Pod
 *               description:
 *                 type: string
 *                 example: Modern hygiene pod with touchless access
 *               address:
 *                 type: string
 *                 example: FC Road Metro Station
 *               city:
 *                 type: string
 *                 example: Pune
 *               state:
 *                 type: string
 *                 example: Maharashtra
 *               country:
 *                 type: string
 *                 example: India
 *               postalCode:
 *                 type: string
 *                 example: "411004"
 *               latitude:
 *                 type: number
 *                 example: 18.5204
 *               longitude:
 *                 type: number
 *                 example: 73.8567
 *               price:
 *                 type: number
 *                 example: 25.0
 *               capacity:
 *                 type: integer
 *                 example: 1
 *     responses:
 *       201:
 *         description: Toilet created successfully
 *       400:
 *         description: Validation failed
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Owner role required
 */

/**
 * @swagger
 * /api/v1/toilets/owner:
 *   get:
 *     summary: Get all toilets owned by the logged-in owner
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of owner toilets
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Owner role required
 */

/**
 * @swagger
 * /api/v1/toilets/search:
 *   get:
 *     summary: Search toilets with filters
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: city
 *         schema:
 *           type: string
 *         example: Pune
 *       - in: query
 *         name: minRating
 *         schema:
 *           type: number
 *         example: 4
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         example: 50
 *     responses:
 *       200:
 *         description: Filtered toilets
 */

/**
 * @swagger
 * /api/v1/toilets/nearby:
 *   get:
 *     summary: Find toilets near a geographic location
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *         example: 18.5204
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *         example: 73.8567
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *         description: Search radius in kilometers (default 5km)
 *         example: 5
 *     responses:
 *       200:
 *         description: Nearby toilets list
 */

/**
 * @swagger
 * /api/v1/toilets/{toiletId}:
 *   get:
 *     summary: Get toilet details by ID
 *     tags: [Toilets]
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
 *         description: Toilet details
 *       404:
 *         description: Toilet not found
 *   patch:
 *     summary: Update toilet details (Owner only)
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toiletId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               price:
 *                 type: number
 *               isAvailable:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Toilet updated
 *   delete:
 *     summary: Delete toilet (Owner only)
 *     tags: [Toilets]
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
 *         description: Toilet deleted
 */

/**
 * @swagger
 * /api/v1/toilets/{toiletId}/operating-hours:
 *   put:
 *     summary: Update toilet operating hours (Owner only)
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toiletId
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
 *               - operatingHours
 *             properties:
 *               operatingHours:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - day
 *                     - openingTime
 *                     - closingTime
 *                   properties:
 *                     day:
 *                       type: string
 *                       enum: [MONDAY, TUESDAY, WEDNESDAY, THURSDAY, FRIDAY, SATURDAY, SUNDAY]
 *                     openingTime:
 *                       type: string
 *                       example: "06:00"
 *                     closingTime:
 *                       type: string
 *                       example: "22:00"
 *                     isClosed:
 *                       type: boolean
 *                       example: false
 *     responses:
 *       200:
 *         description: Operating hours updated
 */

/**
 * @swagger
 * /api/v1/toilets/{toiletId}/amenities:
 *   put:
 *     summary: Update toilet amenities (Owner only)
 *     tags: [Toilets]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: toiletId
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
 *               - amenityIds
 *             properties:
 *               amenityIds:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Amenities updated
 */
