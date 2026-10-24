import ApiError from "../utils/ApiError.js";

/**
 * In-memory sliding window rate limiter.
 * Zero external dependencies, thread-safe for Node.js event loop,
 * with automatic memory cleanup of expired windows.
 */
export function createRateLimiter({
  windowMs = 15 * 60 * 1000, // 15 minutes
  max = 100, // max requests per window
  message = "Too many requests, please try again later.",
  statusCode = 429,
  keyGenerator = (req) => req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "global",
  skip = (req) => process.env.NODE_ENV === "test",
} = {}) {
  const hits = new Map();

  // Periodic cleanup every minute to prevent memory leak
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of hits.entries()) {
      if (now > record.resetTime) {
        hits.delete(key);
      }
    }
  }, 60 * 1000);

  // Unref timer so it doesn't prevent Node process from cleanly exiting
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }

  return (req, res, next) => {
    if (skip(req)) {
      return next();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const record = hits.get(key) || { count: 0, resetTime: now + windowMs };

    if (now > record.resetTime) {
      record.count = 1;
      record.resetTime = now + windowMs;
    } else {
      record.count += 1;
    }

    hits.set(key, record);

    const remaining = Math.max(0, max - record.count);
    const resetSeconds = Math.ceil((record.resetTime - now) / 1000);

    res.setHeader("X-RateLimit-Limit", max);
    res.setHeader("X-RateLimit-Remaining", remaining);
    res.setHeader("X-RateLimit-Reset", resetSeconds);

    if (record.count > max) {
      res.setHeader("Retry-After", resetSeconds);
      return next(new ApiError(statusCode, message));
    }

    next();
  };
}

// 1. Strict rate limiter for Authentication endpoints (prevent brute-force attacks)
export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per 15 minutes
  message: "Too many authentication attempts. Please try again after 15 minutes.",
  statusCode: 429,
  skip: (req) => process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"],
});

// 2. General API rate limiter for standard routes
export const globalApiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per 15 minutes
  message: "Too many requests to the SanitiGo API. Please slow down.",
  statusCode: 429,
  skip: (req) => process.env.NODE_ENV === "test" && !req.headers["x-test-rate-limit"],
});

export default {
  createRateLimiter,
  authRateLimiter,
  globalApiRateLimiter,
};
