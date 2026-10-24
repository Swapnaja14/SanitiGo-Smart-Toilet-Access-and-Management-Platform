import dotenv from "dotenv";

dotenv.config({
    path: ".env.test",
});

if (process.env.TEST_DATABASE_URL) {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (process.env.TEST_JWT_ACCESS_SECRET) {
    process.env.JWT_ACCESS_SECRET = process.env.TEST_JWT_ACCESS_SECRET;
}

if (process.env.TEST_JWT_REFRESH_SECRET) {
    process.env.JWT_REFRESH_SECRET = process.env.TEST_JWT_REFRESH_SECRET;
}
