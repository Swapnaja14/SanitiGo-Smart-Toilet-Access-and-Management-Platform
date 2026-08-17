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


const app = express();
app.use(cors());
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(cookieParser());

// app.use(morgan("dev"))

app.use(
    morgan("combined", {
        stream: {
            write: (message) => logger.http(message.trim()),
        },
    })
);


app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "SanitiGo Backend Running"
    });
});

app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec)
);

app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/toilets", toiletRoutes);
app.use("/api/v1/favorites", favoriteRoutes);

app.use(notFound);
app.use(errorHandler);  

export default app;