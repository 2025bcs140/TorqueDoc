import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config';
import { HttpError } from '../http';

/** JSON 404 for anything that didn't match a route. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
    code: 'NOT_FOUND',
  });
}

/**
 * Single error boundary for the API.
 *
 * Express 5 forwards rejected promises from async handlers here, so routes
 * can simply `throw` and get a consistent JSON response. Operational details
 * are logged server-side; in production the client never receives a stack
 * trace or an internal message.
 */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details === undefined ? {} : { details: error.details }),
    });
    return;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(413).json({
        error: `File is too large. The maximum upload size is ${config.maxUploadMb} MB.`,
        code: 'FILE_TOO_LARGE',
      });
      return;
    }
    res.status(400).json({
      error: `Upload failed: ${error.message}`,
      code: 'UPLOAD_ERROR',
    });
    return;
  }

  // body-parser throws SyntaxError for malformed JSON, with status 400.
  const status = (error as { status?: unknown; statusCode?: unknown })?.status;
  if (error instanceof SyntaxError && status === 400) {
    res.status(400).json({ error: 'Request body contains invalid JSON', code: 'INVALID_JSON' });
    return;
  }
  if (status === 413) {
    res.status(413).json({ error: 'Request body is too large', code: 'PAYLOAD_TOO_LARGE' });
    return;
  }

  console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  res.status(500).json({
    error: config.env === 'production' ? 'Internal server error' : String(error),
    code: 'INTERNAL_ERROR',
  });
}
