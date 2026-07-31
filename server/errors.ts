import type { ErrorRequestHandler, NextFunction, Request, RequestHandler, Response } from "express";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "request_failed",
    public details?: unknown
  ) {
    super(message);
  }
}

export function asyncHandler(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => void handler(req, res, next).catch(next);
}

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(new ApiError(404, `Route ${req.method} ${req.path} was not found`, "not_found"));
};

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  const status = Number(error?.status || 500);
  if (status >= 500) console.error(`[${req.requestId}]`, error);
  const retryAfter = Number(error?.details?.retryAfter);
  if (status === 429 && Number.isFinite(retryAfter) && retryAfter > 0) {
    res.setHeader("Retry-After", String(Math.ceil(retryAfter)));
  }
  res.status(status).json({
    error: {
      code: error?.code || (status >= 500 ? "internal_error" : "request_failed"),
      message: status >= 500 ? "Internal server error" : String(error?.message || "Request failed"),
      details: status >= 500 ? undefined : error?.details,
      requestId: req.requestId
    }
  });
};
