// Morgan's development formatter uses eval, which Workers does not allow.
// Keep request logging with a formatter that requires no dynamic code generation.
export default function accessLog() {
  return (request, response, next) => {
    const started = Date.now()
    response.once('finish', () => {
      console.log(JSON.stringify({
        method: request.method,
        path: request.path,
        status: response.statusCode,
        durationMs: Date.now() - started,
      }))
    })
    next()
  }
}
