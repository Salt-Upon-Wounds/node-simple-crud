import { db, isUser } from './db'
import { createServer, IncomingMessage, ServerResponse } from 'node:http'
import { parse } from 'url'
import { v4, validate } from 'uuid'
import { Message, User } from './types'
import cluster from 'cluster'

export default () =>
  createServer(async (req: IncomingMessage, resp: ServerResponse) => {
    const { pathname } = parse(req.url || '', true)
    const method = req.method || ''
    const id = pathname?.match(/^\/api\/users\/([a-f\d-]+)$/i)?.[1]
    let status = 404
    let message: string | User = 'Not Found'
    resp.setHeader('x-worker-pid', process.pid)

    if (pathname === '/api/users' && method === 'GET') {
      if (!cluster.isPrimary) {
        return await new Promise((resolve) => {
          process.send?.({ type: 'getAll' })
          process.once('message', (msg: Message) => {
            resp.writeHead(200, { 'Content-Type': 'application/json' })
            resp.end(JSON.stringify(msg.data))
            resolve()
          })
        })
      }
      status = 200
      message = JSON.stringify([...db])
    } else if (id && method === 'GET') {
      if (!validate(id)) {
        status = 400
        message = 'Invalid UUID'
      } else if (!cluster.isPrimary) {
        return await new Promise((resolve) => {
          process.send?.({ type: 'getById', id })
          process.once('message', (msg: Message) => {
            if (!msg.data) {
              resp.writeHead(404)
              resp.end('Not found')
            } else {
              resp.writeHead(200, { 'Content-Type': 'application/json' })
              resp.end(JSON.stringify(msg.data))
            }
            resolve()
          })
        })
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
        req.on('end', async () => {
          try {
            const data = JSON.parse(body)
            if (!isUser(data)) {
              status = 400
              message = 'Invalid user data'
            } else {
              status = 201
              const newId = v4()
              if (!cluster.isPrimary) {
                await new Promise<void>((resolve) => {
                  process.send?.({
                    type: 'create',
                    user: {
                      id: newId,
                      username: data.username,
                      age: data.age,
                      hobbies: data.hobbies,
                    },
                  })
                  process.once('message', (msg: Message) => {
                    message = JSON.stringify(msg.data)
                    resolve()
                  })
                })
              } else {
                db.set(newId, {
                  id: newId,
                  username: data.username,
                  age: data.age,
                  hobbies: data.hobbies,
                })
                message = db.get(newId)!
              }
            }
          } catch {
            status = 500
            message = 'Internal server error'
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
          req.on('end', async () => {
            try {
              const data = JSON.parse(body)
              if (!isUser(data)) {
                status = 400
                message = 'Invalid user data'
              } else {
                status = 201
                if (!cluster.isPrimary) {
                  await new Promise<void>((resolve) => {
                    process.send?.({
                      type: 'update',
                      id,
                      user: {
                        id,
                        username: data.username,
                        age: data.age,
                        hobbies: data.hobbies,
                      },
                    })
                    process.once('message', (msg: Message) => {
                      message = JSON.stringify(msg.data)
                      resolve()
                    })
                  })
                } else {
                  db.set(id, { id, username: data.username, age: data.age, hobbies: data.hobbies })
                  message = db.get(id)!
                }
              }
            } catch {
              status = 500
              message = 'Internal server error'
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
      } else if (!cluster.isPrimary) {
        return await new Promise((resolve) => {
          process.send?.({ type: 'delete', id })
          process.once('message', (msg: Message) => {
            if (!msg.data) {
              resp.writeHead(404)
              resp.end('Not found')
            } else {
              resp.writeHead(204)
              resp.end()
            }
            resolve()
          })
        })
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
    resp.end(JSON.stringify(message))
  })
