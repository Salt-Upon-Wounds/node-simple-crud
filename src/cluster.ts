import cluster from 'cluster'
import { availableParallelism } from 'os'
import createServer from './server'
import http from 'http'
import { config } from 'dotenv'
import { db } from './db'

config()
const PORT = Number(process.env.PORT) || 4000
const workersCount = availableParallelism() - 1

if (cluster.isPrimary) {
  const workers: number[] = []

  for (let i = 0; i < workersCount; i++) {
    const worker = cluster.fork({ WORKER_PORT: String(PORT + i + 1) })

    worker.on('message', (msg) => {
      if (msg.type === 'getAll') {
        worker.send({ type: 'getAllResult', data: [...db.values()] })
      }

      if (msg.type === 'getById') {
        const user = db.get(msg.id)
        worker.send({ type: 'getByIdResult', data: user ?? null })
      }

      if (msg.type === 'create') {
        const newUser = { ...msg.user, id: crypto.randomUUID() }
        db.set(newUser.id, newUser)
        worker.send({ type: 'createResult', data: newUser })
      }

      if (msg.type === 'update') {
        if (!db.has(msg.id)) return worker.send({ type: 'updateResult', data: null })
        const updated = { ...db.get(msg.id), ...msg.user }
        db.set(msg.id, updated)
        worker.send({ type: 'updateResult', data: updated })
      }

      if (msg.type === 'delete') {
        const deleted = db.delete(msg.id)
        worker.send({ type: 'deleteResult', data: deleted })
      }
    })

    workers.push(PORT + i + 1)
  }

  let current = 0
  const balancer = http.createServer((req, res) => {
    const proxy = http.request(
      {
        hostname: 'localhost',
        port: workers[current],
        path: req.url,
        method: req.method,
        headers: req.headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode || 500, proxyRes.headers)
        proxyRes.pipe(res, { end: true })
      }
    )

    req.pipe(proxy, { end: true })
    current = (current + 1) % workers.length
  })

  balancer.listen(PORT, () => {
    console.log(`Balancer listening on http://localhost:${PORT}`)
  })
} else {
  const workerPort = Number(process.env.WORKER_PORT)
  const server = createServer()
  server.listen(workerPort, () => {
    console.log(`Worker ${process.pid} listening on port ${workerPort}`)
  })
}
