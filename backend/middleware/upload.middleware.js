import multer from "multer";
import path from "path";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
    console.log("Uploaded file:", file.originalname);
    console.log("MIME type:", file.mimetype);

    const allowedExtensions = [
        ".jpg",
        ".jpeg",
        ".png",
        ".webp",
    ];

    const extension = path.extname(file.originalname).toLowerCase();

    const allowedMimeTypes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
    ];

    if (
        allowedMimeTypes.includes(file.mimetype) ||
        (
            file.mimetype === "application/octet-stream" &&
            allowedExtensions.includes(extension)
        )
    ) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPEG, JPG, PNG, and WEBP images are allowed"
            ),
            false
        );
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
});

export default upload;