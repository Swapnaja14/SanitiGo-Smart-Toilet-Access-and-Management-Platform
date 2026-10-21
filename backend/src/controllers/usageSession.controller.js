import {
  startUsageSession as startUsageSessionService,
  endUsageSession as endUsageSessionService,
  getUsageSessionById as getUsageSessionByIdService,
} from "../services/usageSession.service.js";

import ApiError from "../utils/ApiError.js";

const getOwnerId = (req) => {
  const ownerId = req.user?.id;

  if (!ownerId) {
    throw new ApiError(401, "Authentication is required.");
  }

  return ownerId;
};

export const startUsageSession = async (req, res, next) => {
  try {
    const result = await startUsageSessionService(
      getOwnerId(req),
      req.body.token
    );

    return res.status(201).json({
      success: true,
      message: "Usage session started successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const endUsageSession = async (req, res, next) => {
  try {
    const result = await endUsageSessionService(
      getOwnerId(req),
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: "Usage session ended successfully.",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getUsageSessionById = async (
  req,
  res,
  next
) => {
  try {
    const session = await getUsageSessionByIdService(
      getOwnerId(req),
      req.params.sessionId
    );

    return res.status(200).json({
      success: true,
      message: "Usage session retrieved successfully.",
      data: session,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  startUsageSession,
  endUsageSession,
  getUsageSessionById,
};
