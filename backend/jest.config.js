import { setup } from "swagger-ui-express";

export default {
    testEnvironment: "node",
    clearMocks: true,
    testTimeout: 10000,
    setupFiles: [
        "<rootDir>/tests/setup.js"
    ]
}