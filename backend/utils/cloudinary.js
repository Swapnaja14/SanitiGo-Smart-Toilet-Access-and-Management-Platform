import { error } from "console";
import cloudinary from "../src/config/cloudinary.js";
import {Readable} from "stream";

const uploadToCloudinary = (buffer, folder) => {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                folder,
                resource_type: "image",
            },
            (error, result) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(result);
                }
            }
        );

        Readable.from(buffer).pipe(uploadStream);
    });
};

const deleteFromCloudinary = async(publicId) => {
    return cloudinary.uploader.destroy(publicId);
};

export {
    uploadToCloudinary,
    deleteFromCloudinary,
};