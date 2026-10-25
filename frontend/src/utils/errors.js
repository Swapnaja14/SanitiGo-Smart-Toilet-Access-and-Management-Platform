/**
 * Extract human-readable error messages from Axios / Backend ApiError responses.
 */
export function extractErrorMessage(error, defaultMessage = 'An unexpected error occurred. Please try again.') {
  if (!error) return defaultMessage;

  // If error has a response from Express backend
  if (error.response) {
    const data = error.response.data;

    if (data) {
      if (typeof data.message === 'string' && data.message.trim().length > 0) {
        return data.message;
      }
      if (typeof data.error === 'string' && data.error.trim().length > 0) {
        return data.error;
      }
      // If validation error list returned by Zod middleware
      if (Array.isArray(data.errors) && data.errors.length > 0) {
        const first = data.errors[0];
        if (typeof first === 'string') return first;
        if (first?.message) return first.message;
      }
    }

    if (error.response.status === 401) {
      return 'Session expired or unauthorized. Please sign in again.';
    }
    if (error.response.status === 403) {
      return 'You do not have permission to perform this action.';
    }
    if (error.response.status === 404) {
      return 'Requested resource was not found.';
    }
    if (error.response.status === 429) {
      return 'Too many requests. Please slow down and try again shortly.';
    }
    if (error.response.status >= 500) {
      return 'Server encountered an issue. Our team has been notified.';
    }
  }

  // Network offline or failed request
  if (error.request && !error.response) {
    return 'Unable to reach the SanitiGo servers. Please verify your internet connection.';
  }

  return error.message || defaultMessage;
}

/**
 * Extract structured field validation errors (e.g. from Zod or Mongoose validation)
 */
export function extractValidationErrors(error) {
  const fieldErrors = {};
  if (!error?.response?.data) return fieldErrors;

  const data = error.response.data;
  if (Array.isArray(data.errors)) {
    data.errors.forEach((err) => {
      if (err.path && (err.message || typeof err === 'string')) {
        const fieldName = Array.isArray(err.path) ? err.path.join('.') : err.path;
        fieldErrors[fieldName] = err.message || String(err);
      }
    });
  }

  return fieldErrors;
}
