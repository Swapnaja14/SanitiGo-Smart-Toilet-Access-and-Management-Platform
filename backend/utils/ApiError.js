class ApiError extends Error {
    constructor(
        status_code,
        message,
        isOperational = true,
        errors = []
    ) {
        super(message);
        this.status_code = status_code;
        this.success = false;
        this.isOperational = isOperational;
        this.name = this.constructor.name;
        this.errors = errors;

        Error.captureStackTrace(this, this.constructor);
    }
}
export default ApiError;