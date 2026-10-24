import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import logger from './config/logger.js';
import swaggerUi from "swagger-ui-express";
import swaggerSpec from "./docs/swagger.js";
import errorHandler from "../middleware/errorHandler.js";
import notFound from "../middleware/notFound.js";
import cookieParser from "cookie-parser";
import authRoutes from "../routes/auth.routes.js";
import toiletRoutes from "../routes/toilet.routes.js";
import favoriteRoutes from "../routes/favorite.routes.js";
import bookingRoutes from "../routes/booking.routes.js";
import customerBookingRoutes from "./routes/booking.routes.js";
import paymentRoutes from "./routes/payment.routes.js";
import ownerTokenRoutes from "./routes/ownerToken.routes.js";
import usageSessionRoutes from "./routes/usageSession.routes.js";
import sessionRoutes from "../routes/session.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import reviewRoutes from "./routes/review.routes.js";
import adminRoutes from "./routes/admin.routes.js";


const app = express();
app.use(cors());
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// app.use(morgan("dev"))

app.use(
    morgan("combined", {
        stream: {
            write: (message) => logger.http(message.trim()),
        },
    })
);


import { checkOperationalHealth } from "./jobs/operationalMonitor.job.js";

app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SanitiGo Backend Running"
    });
});

app.get("/api/health/operations", async (req, res) => {
    try {
        const health = await checkOperationalHealth();
        const statusCode = health.status === "DEGRADED" ? 503 : 200;
        res.status(statusCode).json({
            success: health.status !== "DEGRADED",
            ...health
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

import { globalApiRateLimiter } from "./middlewares/rateLimiter.js";

app.use("/api", globalApiRateLimiter);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/toilets", toiletRoutes);
app.use("/api/v1/favorites", favoriteRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/bookings", customerBookingRoutes);
app.use("/api/v1/bookings", paymentRoutes);
app.use("/api/bookings", paymentRoutes);
app.use("/api/v1/payments", paymentRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/owner", ownerTokenRoutes);
app.use("/api/v1/owner", ownerTokenRoutes);
app.use("/api/owner/sessions", usageSessionRoutes);
app.use("/api/v1/owner/sessions", usageSessionRoutes);
app.use("/api/v1/sessions", sessionRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/v1/notifications", notificationRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/v1/reviews", reviewRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/v1/admin", adminRoutes);

app.use(notFound);
app.use(errorHandler);  

export default app;