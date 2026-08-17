import express from "express";
import authenticate from "../middleware/auth.js";
import authorize from "../middleware/authorize.middleware.js";

import {
    removeFavorite,
    saveFavorite,
    getFavorites,
} from "../src/controllers/favorite.controller.js";

const router = express.Router();

router.get(
    "/",
    authenticate,
    authorize("USER"),
    getFavorites
);

router.post(
    "/:toiletId",
    authenticate,
    authorize("USER"),
    saveFavorite
);

router.delete(
    "/:toiletId",
    authenticate,
    authorize("USER"),
    removeFavorite
);

export default router;