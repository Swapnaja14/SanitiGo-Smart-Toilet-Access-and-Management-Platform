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
    searchToilets,
    getNearbyToilets,
    updateOperatingHours,
    updateAmenties,
    getAllAmenities,
    getOwnerBookings,
} from "../src/controllers/toilet.controller.js";

import upload from '../middleware/upload.middleware.js';

import { createToiletSchema, operatingHoursSchema, updateAmentitiesSchema, updateToiletSchema } from '../validations/toilet.validation.js';

const router = express.Router();

router.get("/amenities", getAllAmenities);
router.get("/amenities/all", getAllAmenities);

router.post("/create",
    authenticate,
    authorize("OWNER"),
    validate(createToiletSchema),
    createToilet
);

router.get("/owner/bookings",
    authenticate,
    authorize("OWNER"),
    getOwnerBookings
);

router.get("/owner", 
    authenticate,
    authorize("OWNER"),
    getOwnerToilets
);

router.get("/search",
    authenticate,
    searchToilets
);

router.get("/nearby",
    authenticate,
    getNearbyToilets
);

router.put(
    "/:toiletId/operating-hours",
    authenticate,
    authorize("OWNER"),
    validate(operatingHoursSchema),
    updateOperatingHours
);

router.put(
    "/:toiletId/amenities",
    authenticate,
    authorize("OWNER"),
    validate(updateAmentitiesSchema),
    updateAmenties
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