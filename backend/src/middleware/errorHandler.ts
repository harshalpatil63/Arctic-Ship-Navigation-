import { ErrorRequestHandler, RequestHandler } from 'express';

export const notFound: RequestHandler = (_request, response) => {
  response.status(404).json({ error: 'Resource not found' });
};

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  void _next;
  console.error(error);
  response.status(500).json({ error: 'Internal server error' });
};
