import swaggerJsdoc from "swagger-jsdoc";

const options = {
    definition: {
        openapi: "3.0.0",

        info: {
            title: "SanitiGo API",
            version: "1.0.0",
            description: "Smart Toilet Access and Management API",
        },

        servers: [
            {
                url: "http://localhost:5000",
            },
        ],

        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT",
                },
            },
        },
    },

    apis: [
        "./src/routes/*.js",
        "./src/docs/*.js",
    ],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;