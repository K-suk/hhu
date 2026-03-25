export class AuthenticationError extends Error {
  readonly status = 401;

  constructor(message = "Unauthorized") {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class ForbiddenError extends Error {
  readonly status = 403;

  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class BadRequestError extends Error {
  readonly status = 400;
  readonly fieldErrors?: Record<string, string[] | undefined>;

  constructor(
    message = "Bad Request",
    fieldErrors?: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "BadRequestError";
    this.fieldErrors = fieldErrors;
  }
}

