import http from 'node:http'

const port = Number(process.env.PORT || 8787)
const apiKey = process.env.OPENAI_API_KEY
const upstream = 'https://api.openai.com/v1'

function writeCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
}

const server = http.createServer(async (req, res) => {
  writeCors(res)
  if (req.method === 'OPTIONS') return res.writeHead(204).end()
  if (req.method === 'GET' && req.url === '/health') {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ ok: true }))
  }
  if (!apiKey) return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }))
  if (req.method !== 'POST' || !['/v1/audio/transcriptions', '/v1/chat/completions', '/audio/transcriptions', '/chat/completions'].includes(req.url || '')) {
    return res.writeHead(404).end('Not found')
  }
  const chunks = []
  for await (const chunk of req) chunks.push(chunk)
  const target = `${upstream}${req.url.startsWith('/v1') ? req.url.slice(3) : req.url}`
  const response = await fetch(target, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': req.headers['content-type'] || 'application/json' },
    body: Buffer.concat(chunks),
  })
  res.statusCode = response.status
  const contentType = response.headers.get('content-type')
  if (contentType) res.setHeader('Content-Type', contentType)
  res.end(Buffer.from(await response.arrayBuffer()))
})

server.listen(port, '0.0.0.0', () => console.log(`Interview relay listening on ${port}`))
