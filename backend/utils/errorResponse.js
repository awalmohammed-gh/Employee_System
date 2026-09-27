/**
 * Client-safe error messages for API responses.
 * Internal error text (database, driver, stack-related) is only exposed outside production.
 * Errors deliberately raised for the client (4xx statusCode, validation, upload limits) always keep their message.
 */

const isClientFacingError = (error) => {
  const status = Number(error?.statusCode || error?.status);
  return (
    (status >= 400 && status < 500) ||
    error?.name === "ValidationError" ||
    error?.name === "MulterError"
  );
};

export const safeErrorMessage = (error, fallback = "Internal server error") => {
  if (error?.message && (process.env.NODE_ENV !== "production" || isClientFacingError(error))) {
    return error.message;
  }
  return fallback;
};

export default safeErrorMessage;
