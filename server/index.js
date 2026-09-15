// ─────────────────────────────────────────────────────────────────────────────
//  LOCAL DEV BACKEND  —  not part of the Week 1 frontend curriculum.
//
//  In the bootcamp, students receive the backend as a ready-made repo (Week 1,
//  Slide 3). Its only job is to keep the secret AI key OFF the browser
//  (Week 1, Slide 23: "secrets live on the server, never in the frontend").
//
//  This process only runs locally (`npm run dev`), where Vite proxies /api to
//  it. In production the same logic is served by api/memes.js as a Vercel
//  Function — both share server/memes-core.js.
//
//  Contract the frontend depends on:
//    POST /api/memes   body: { category }   ->   { memes: [{ id, imageUrl, caption }] }
// ─────────────────────────────────────────────────────────────────────────────
import 'dotenv/config'
import express from 'express'
import { createMemes } from './memes-core.js'

const app = express()
app.use(express.json())

const PORT = process.env.PORT || 8787

app.post('/api/memes', async (req, res) => {
  try {
    const memes = await createMemes(req.body?.category)
    res.json({ memes })
  } catch (err) {
    const status = err.status ?? 502
    if (status >= 500) {
      console.error('[/api/memes] failed:', err.message)
    }
    res.status(status).json({
      error: status === 400 ? err.message : 'Failed to generate memes',
    })
  }
})

app.listen(PORT, () => {
  console.log(`🔥 Meme backend listening on http://localhost:${PORT}`)
})
