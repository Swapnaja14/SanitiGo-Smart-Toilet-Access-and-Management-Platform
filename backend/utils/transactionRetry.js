/**
 * Executes a database transaction with retries for transient concurrency conflicts
 * (e.g. Prisma P2034 serialization failure / PostgreSQL 40001).
 *
 * @param {Function} operation - Async function executing the transaction
 * @param {number} maxRetries - Maximum retry attempts (default: 3)
 * @param {number} baseDelayMs - Base delay in ms for exponential backoff (default: 30)
 * @returns {Promise<any>} Result of the operation
 */
export const executeWithRetry = async (
    operation,
    maxRetries = 3,
    baseDelayMs = 30
) => {
    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (error) {
            const isSerializationConflict =
                error.code === "P2034" ||
                (error.meta && error.meta.code === "40001") ||
                (typeof error.message === "string" &&
                    (error.message.includes("write conflict") ||
                        error.message.includes("deadlock") ||
                        error.message.includes("P2034")));

            if (isSerializationConflict && attempt < maxRetries) {
                attempt++;
                const delay =
                    baseDelayMs * Math.pow(2, attempt - 1) +
                    Math.floor(Math.random() * 20);
                await new Promise((resolve) => setTimeout(resolve, delay));
                continue;
            }

            throw error;
        }
    }
};

export default executeWithRetry;
