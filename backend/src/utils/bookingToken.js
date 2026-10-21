import { randomInt } from "node:crypto";

/**
 * Generates a cryptographically random booking access token.
 *
 * Example: SG-493928
 */
export const generateBookingToken = () => {
  const number = randomInt(100000, 1000000);

  return `SG-${number}`;
};

/**
 * Detects a Prisma unique-constraint violation involving
 * the booking token field.
 *
 * The booking service will use this to retry token generation
 * if a collision occurs during database insertion.
 */
export const isBookingTokenConflict = (error) => {
  if (error?.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;

  if (Array.isArray(target)) {
    return target.some((field) =>
      String(field).toLowerCase().includes("token")
    );
  }

  return (
    typeof target === "string" &&
    target.toLowerCase().includes("token")
  );
};
