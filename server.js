const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOSTNAME || '0.0.0.0'
const port = parseInt(process.env.PORT || '3000', 10)

const app = next({ dev, hostname, port, dir: __dirname })
const handle = app.getRequestHandler()

console.log(`Starting server in ${dev ? 'development' : 'production'} mode...`)

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Set CORS headers if needed
      res.setHeader('X-Powered-By', 'Next.js')
      
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
    .once('error', (err) => {
      console.error('Server error:', err)
      process.exit(1)
    })
    .listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`)
      console.log(`> Environment: ${process.env.NODE_ENV}`)
      console.log(`> Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured'}`)
    })
}).catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
