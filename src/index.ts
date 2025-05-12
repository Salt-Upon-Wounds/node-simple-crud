import { db, isUser } from './db.js'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { parse } from 'url'
import { v4, validate } from 'uuid'
import { User } from './types.js'
import { config } from 'dotenv'

config()
const PORT = parseInt(process.env.PORT ?? '') || 4000

const server = createServer(async (req: IncomingMessage, resp: ServerResponse) => {
  const { pathname } = parse(req.url || '', true)
  const method = req.method || ''
  const id = pathname?.match(/^\/api\/users\/([a-f\d-]+)$/i)?.[1]
  let status = 404
  let message: string | User = 'Not Found'

  if (pathname === '/api/users' && method === 'GET') {
    status = 200
    message = JSON.stringify([...db])
  } else if (id && method === 'GET') {
    if (!validate(id)) {
      status = 400
      message = 'Invalid UUID'
    } else if (db.get(id)) {
      status = 200
      message = db.get(id)!
    } else {
      status = 404
      message = 'User not found'
    }
  } else if (pathname === '/api/users' && method === 'POST') {
    let body = ''
    await new Promise<void>((resolve, reject) => {
      req.on('data', (chunk) => (body += chunk))
      req.on('end', () => {
        const data = JSON.parse(body)
        if (!isUser(data)) {
          status = 400
          message = 'Invalid user data'
        } else {
          status = 201
          const newId = v4()
          db.set(newId, {
            id: newId,
            username: data.username,
            age: data.age,
            hobbies: data.hobbies,
          })
          message = db.get(newId)!
        }
        resolve()
      })
      req.on('error', reject)
    })
  } else if (id && method === 'PUT') {
    if (!validate(id)) {
      status = 400
      message = 'Invalid UUID'
    } else if (!db.get(id)) {
      status = 404
      message = 'User not found'
    } else {
      let body = ''
      await new Promise<void>((resolve, reject) => {
        req.on('data', (chunk) => (body += chunk))
        req.on('end', () => {
          const data = JSON.parse(body)
          if (!isUser(data)) {
            status = 400
            message = 'Invalid user data'
          } else {
            status = 201
            db.set(id, { id, username: data.username, age: data.age, hobbies: data.hobbies })
            message = db.get(id)!
          }
          resolve()
        })
        req.on('error', reject)
      })
    }
  } else if (id && method === 'DELETE') {
    if (!validate(id)) {
      status = 400
      message = 'Invalid UUID'
    } else if (!db.get(id)) {
      status = 404
      message = 'User not found'
    } else {
      db.delete(id)
      status = 204
      message = ''
    }
  }

  resp.writeHead(status, { 'Content-Type': 'application/json' })
  resp.end(message)
})

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
