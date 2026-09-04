import express from 'express'
import { fileURLToPath } from 'node:url'

const app = express()
let application
const publicDirectory = fileURLToPath(new URL('../public/', import.meta.url))

app.use(express.static(publicDirectory, { index: false }))

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
