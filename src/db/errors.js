/* db/errors.js — one error type for "the request was wrong".
   status is the HTTP code the server will send later: 400 bad input, 404 not found, 409 not allowed right now. */
class AppError extends Error {
  constructor(message, status = 400) { super(message); this.name = 'AppError'; this.status = status; }
}
module.exports = { AppError };