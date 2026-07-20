import logger from "../src/config/logger";

const errorHandler = (err, req, res, next) => {
    let statusCode = err.statusCode || 500;
    let message = err.message || "Internal Server Error";
    logger.error(err);
    const response = {
        success: false,
        message,
    };

    if (process.env.NODE_ENV != "production") {
        response.stack = err.stack;
    }

    res.status(statusCode).json(response);
};
export default errorHandler;