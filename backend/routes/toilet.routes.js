import express from 'express';

import authenticate from '../middleware/auth.js';
import authorize from '../middleware/role.middleware.js';
import validate from '../middleware/validate.middleware.js'

import {
    createToilet,
    getOwnerToilets,
    getToiletId,
    updateToilet,
    deleteToilet,
    uploadToiletImages,
} from "../src/controllers/toilet.controller.js";

import upload from '../middleware/upload.middleware.js';

import { createToiletSchema, updateToiletSchema } from '../validations/toilet.validation.js';

const router = express.Router();

router.post("/create",
    authenticate,
    authorize("OWNER"),
    validate(createToiletSchema),
    createToilet
);

router.get("/owner", 
    authenticate,
    authorize("OWNER"),
    getOwnerToilets
);

router.get("/:toiletId",
    authenticate,
    getToiletId
);

router.patch("/:toiletId", // Patch instead of Put because the owner may update only some fields
    authenticate,
    authorize("OWNER"),
    validate(updateToiletSchema),
    updateToilet
);

router.delete("/:toiletId",
    authenticate,
    authorize("OWNER"),
    deleteToilet
);

router.post("/:toiletId/images",
    authenticate,
    authorize("OWNER"),
    upload.array("images", 5),
    uploadToiletImages
)

export default router;