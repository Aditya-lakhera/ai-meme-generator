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
//  Requires the OPENROUTER_API_KEY environment variable to be set on Vercel
//  (Project → Settings → Environment Variables). .env is gitignored and is
//  never uploaded, so the key must be configured there too.
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config'
import { createMemes } from '../server/memes-core.js'

// Generating memes calls OpenRouter + memegen.link, which can take a few
// seconds. Vercel's default function time limit (~10s on Hobby) would cut the
// request short and surface as a 502 — give the function room to finish.
export const config = {
  maxDuration: 100, // seconds
}

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
    // Include the real reason (missing key, rate limit, unknown model, ...) so
    // the failing deploy is debuggable straight from the network tab.
    return res.status(status).json({
      error: status === 400 ? err.message : `Failed to generate memes — ${err.message}`,
    })
  }
}

// Vercel parses JSON bodies for us, but be tolerant of a raw string or Buffer
// body (depending on runtime/builder version).
function readCategory(req) {
  let body = req.body
  if (Buffer.isBuffer(body)) body = body.toString()
  if (typeof body === 'string') body = tryParse(body)
  return body?.category
}

function tryParse(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}