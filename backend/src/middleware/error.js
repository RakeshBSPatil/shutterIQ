export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
}

export function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request payload exceeds 100kb limit' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Malformed JSON body' });
  }
  if (err?.code === '22P02') {
    return res.status(400).json({ error: 'Invalid identifier format' });
  }

  const status = err.statusCode || err.status || 500;
  if (status >= 500) {
    console.error('[Server error]', err.message);
  }

  return res.status(status).json({
    error: status >= 500 ? 'Internal server error' : err.message,
  });
}
