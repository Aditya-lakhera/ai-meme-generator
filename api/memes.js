// ─────────────────────────────────────────────────────────────────────────────
//  PRODUCTION BACKEND (Vercel)
//
//  Vercel serves the Vite build as static files — there is no long-running
//  Express process up there, and the Vite dev proxy only exists during
//  `npm run dev`. So POST /api/memes needs a real server in production.
//
//  Vercel deploys every file in /api as a function, so this file IS the
//  production endpoint for POST /api/memes. The actual work lives in
//  server/memes-core.js, shared with the local Express server.
//
//  Requires the OPEN_ROUTER_API_KEY environment variable to be set on Vercel
//  (Project → Settings → Environment Variables). .env is gitignored and is
//  never uploaded, so the key must be configured there too.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config'
import { createMemes } from '../server/memes-core.js'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const memes = await createMemes(readCategory(req))
    return res.status(200).json({ memes })
  } catch (err) {
    const status = err.status ?? 502
    if (status >= 500) {
      console.error('[/api/memes] failed:', err.message)
    }
    return res.status(status).json({
      error: status === 400 ? err.message : 'Failed to generate memes',
    })
  }
}

// Vercel parses JSON bodies for us, but be tolerant of a raw string body.
function readCategory(req) {
  const body = typeof req.body === 'string' ? tryParse(req.body) : req.body
  return body?.category
}

function tryParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}