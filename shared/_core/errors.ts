export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = "HttpError";
  }
}

export const ForbiddenError = (msg: string): HttpError => new HttpError(403, msg);