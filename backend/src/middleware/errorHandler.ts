import { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Resource not found' });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  if (error instanceof ZodError) {
    return response.status(400).json({
      status: 'INVALID_REQUEST',
      error: error.issues.map((i) => i.message).join('; ') || 'Invalid request parameters',
    });
  }
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
};
