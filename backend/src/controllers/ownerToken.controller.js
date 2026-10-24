import { verifyBookingToken as verifyBookingTokenService } from "../services/ownerToken.service.js";
import ApiError from "../utils/ApiError.js";

export const verifyOwnerBookingToken = async (req, res, next) => {
  try {
    const ownerId = req.user?.id;

    if (!ownerId) {
      throw new ApiError(401, "Authentication is required.");
    }

    const result = await verifyBookingTokenService(
      ownerId,
      req.body.token
    );

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  verifyOwnerBookingToken,
};
