// Express 4 does not forward errors thrown in async handlers to error middleware automatically.
function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

module.exports = { asyncHandler };
