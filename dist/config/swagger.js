import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
const options = {
    definition: {
        openapi: "3.0.0",
        info: {
            title: "Airbnb API",
            version: "1.0.0",
            description: "REST API for Airbnb listings, users, and authentication",
        },
        servers: [
            {
                url: "http://localhost:3000",
                description: "Development server",
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
            schemas: {
                RegisterInput: {
                    type: "object",
                    required: ["name", "email", "phone", "username", "password"],
                    properties: {
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", format: "email", example: "john@example.com" },
                        phone: { type: "string", example: "+1234567890" },
                        username: { type: "string", example: "johndoe" },
                        password: { type: "string", format: "password", example: "password123" },
                        role: { type: "string", enum: ["GUEST", "HOST", "ADMIN"], example: "GUEST" },
                    },
                },
                LoginInput: {
                    type: "object",
                    required: ["email", "password"],
                    properties: {
                        email: { type: "string", format: "email", example: "john@example.com" },
                        password: { type: "string", format: "password", example: "password123" },
                    },
                },
                AuthResponse: {
                    type: "object",
                    properties: {
                        token: { type: "string", example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." },
                    },
                },
                User: {
                    type: "object",
                    properties: {
                        id: { type: "integer", example: 1 },
                        name: { type: "string", example: "John Doe" },
                        email: { type: "string", format: "email", example: "john@example.com" },
                        username: { type: "string", example: "johndoe" },
                        phone: { type: "string", example: "+1234567890" },
                        role: { type: "string", enum: ["GUEST", "HOST", "ADMIN"], example: "GUEST" },
                        avatar: { type: "string", nullable: true, example: null },
                        createdAt: { type: "string", format: "date-time", example: "2026-04-29T00:00:00.000Z" },
                        updatedAt: { type: "string", format: "date-time", example: "2026-04-29T00:00:00.000Z" },
                    },
                },
                ErrorResponse: {
                    type: "object",
                    properties: {
                        error: { type: "string", example: "Error message" },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
    },
    apis: ["./src/routes/*.ts"],
};
function createSwaggerSpec() {
    const originalEmitWarning = process.emitWarning.bind(process);
    process.emitWarning = ((warning, ...args) => {
        const warningCode = typeof warning === "object" && warning !== null && "code" in warning
            ? String(warning.code)
            : typeof args[0] === "string"
                ? args[0]
                : undefined;
        const warningMessage = typeof warning === "string"
            ? warning
            : warning instanceof Error
                ? warning.message
                : String(warning);
        if (warningCode === "DEP0169" || warningMessage.includes("`url.parse()` behavior is not standardized")) {
            return;
        }
        return originalEmitWarning(warning, ...args);
    });
    try {
        return swaggerJsdoc(options);
    }
    finally {
        process.emitWarning = originalEmitWarning;
    }
}
const swaggerSpec = createSwaggerSpec();
export function setupSwagger(app) {
    app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
        swaggerOptions: {
            persistAuthorization: true,
        },
    }));
    app.get("/api-docs.json", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.send(swaggerSpec);
    });
    console.log("Swagger docs available at http://localhost:3000/api-docs");
}
