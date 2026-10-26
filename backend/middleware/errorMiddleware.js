export function notFound(req, res, next) {
  res.status(404);
  next(new Error(`Route not found: ${req.originalUrl}`));
}

export function errorHandler(err, req, res, next) {
  const status = err.code === 'P2002' ? 409 : err.code === 'P2025' ? 404 : res.statusCode >= 400 ? res.statusCode : 500;
  const message = err.code === 'P2002' ? 'An account with this email already exists.' : err.code === 'P2025' ? 'Resource not found.' : err.message || 'Server error';
  res.status(status).json({ message: status === 500 && process.env.NODE_ENV === 'production' ? 'Server error' : message });
}
