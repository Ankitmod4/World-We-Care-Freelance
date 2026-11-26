/** Every failed API call is thrown as an ApiError, so screens handle one shape. */
export class ApiError extends Error {
  readonly status: number;
  /** True when the middleware blocked the call because the email is not confirmed. */
  readonly needsVerification: boolean;
  /** The parsed JSON error body, when the server sent one. */
  readonly body: Record<string, unknown> | null;

  constructor(status: number, message: string, body: Record<string, unknown> | null = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
    this.needsVerification = body?.needsVerification === true;
  }

  get isUnauthorized() {
    return this.status === 401;
  }

  get isNetworkError() {
    return this.status === 0;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

/** A short, user-facing message for any thrown value. */
export function errorMessage(e: unknown, fallback = "Something went wrong. Please try again."): string {
  if (isApiError(e)) {
    if (e.isNetworkError) return "Can't reach World We Care. Check your connection.";
    return e.message || fallback;
  }
  return fallback;
}
