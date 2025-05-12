import cluster from 'cluster'
import { availableParallelism } from 'os'
import createServer from './server.js'
import http from 'http'
import { config } from 'dotenv'

config()
const PORT = Number(process.env.PORT) || 4000
const workersCount = availableParallelism() - 1

if (cluster.isPrimary) {
  const workers: number[] = []

  for (let i = 0; i < workersCount; i++) {
    cluster.fork({ WORKER_PORT: String(PORT + i + 1) })
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
