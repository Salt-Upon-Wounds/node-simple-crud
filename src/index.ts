import { config } from 'dotenv'
import server from './server'

config()
const PORT = parseInt(process.env.PORT ?? '') || 4000

server().listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`)
})
