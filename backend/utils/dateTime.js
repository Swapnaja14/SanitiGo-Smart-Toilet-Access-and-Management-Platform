const INDIA_TIMEZONE_OFFSET = "+05:30";

/**
 * Checks whether the given dateString is a valid calendar date in YYYY-MM-DD format.
 * Prevents invalid dates such as 2026-02-31 or 2026-13-40.
 */
export const isValidCalendarDate = (dateString) => {
    if (typeof dateString !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        return false;
    }
    const [year, month, day] = dateString.split("-").map(Number);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }
    const d = new Date(Date.UTC(year, month - 1, day));
    return (
        d.getUTCFullYear() === year &&
        d.getUTCMonth() === month - 1 &&
        d.getUTCDate() === day
    );
};

export const createISTDateTime = (
    dateString,
    timeString,
) => {
    return new Date(
        `${dateString}T${timeString}:00${INDIA_TIMEZONE_OFFSET}`
    );
};

export const createISTDate = (dateString) => {
    return new Date(
        `${dateString}T00:00:00${INDIA_TIMEZONE_OFFSET}`
    );
};
