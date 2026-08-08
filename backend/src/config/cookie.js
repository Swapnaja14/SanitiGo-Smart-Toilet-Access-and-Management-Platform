// This file defines how the browser should store your refresh token cookie.
// It is like attaching instruction to the cookie when you send it to the browser.


export const refreshTokenCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
};