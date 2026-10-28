// This file defines how the browser should store your refresh token cookie.
// It is like attaching instruction to the cookie when you send it to the browser.

const isSecureEnv = process.env.NODE_ENV === "production" || process.env.NODE_ENV === "staging";

export const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: isSecureEnv,
    sameSite: process.env.COOKIE_SAMESITE || (isSecureEnv ? "none" : "lax"),
    maxAge: 7 * 24 * 60 * 60 * 1000,
};