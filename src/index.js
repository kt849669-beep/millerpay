import express from 'express'

const app = express()
let application

app.use(async (request, response, next) => {
  try {
    application ||= import('../server/src/index.js').then((module) => module.default)
    const handler = await application
    return handler(request, response, next)
  } catch (error) {
    next(error)
  }
})

export default app
