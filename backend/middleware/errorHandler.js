import logger from "../src/config/logger.js";

const errorHandler = (err, req, res, next) => {
    const statusCode = err.status_code || err.statusCode || 500;

    res.status(statusCode).json({
        success: false,
        message: err.message || "Internal Server Error",
        errors: err.errors || [],
    });
};

export default errorHandler;