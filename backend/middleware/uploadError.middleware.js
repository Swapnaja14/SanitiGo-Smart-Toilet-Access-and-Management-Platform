import multer from "multer";
import ApiError from "../utils/ApiError";

const uploadErrorHandler = (err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return next(
                new ApiError(400, "Image size must not exceed 5 MB")
            );
        }

        return next(
            new ApiError(400, `Image upload error: ${err.message}`)
        );
    }

    if (err) {
        return next(
            new ApiError(400, err.message)
        );
    }
    next();
};

export default uploadErrorHandler;