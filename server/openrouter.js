// ─────────────────────────────────────────────────────────────────────────────
//  OpenRouter meme-text generation (server-side only).
//
//  Uses the OpenAI-compatible Chat Completions endpoint OpenRouter exposes.
//  We try a list of FREE models in order, so the demo keeps working even if one
//  is rate-limited or retired. Browse current free models at:
//    https://openrouter.ai/models?max_price=0
//
//  The key idea for GOOD memes: we don't ask for generic captions. We tell the
//  model exactly which meme template each line is for, and its joke structure,
//  so the text actually fits the format (that's what viral memes do).
// ─────────────────────────────────────────────────────────────────────────────
const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'

// NOTE: OpenRouter's free catalog changes often, and free variants are heavily
// rate-limited (20 req/min, 50 req/day per account). We lead with the env
// override, then `openrouter/free` (OpenRouter's router — it picks a live free
// model that supports the request itself), then a small hardcoded tail. Set
// OPENROUTER_MODEL in .env / Vercel to pin an exact model.
const FREE_MODELS = [
  process.env.OPENROUTER_MODEL,
  'openrouter/free',
  'nvidia/nemotron-3-super-120b-a12b:free',
  'qwen/qwen3-coder:free',
  'meta-llama/llama-3.3-70b-instruct:free',
].filter(Boolean)

// templates: [{ id, name, lines, example }]  ->  [{ top, bottom }] (one per template)
export async function generateMemeTexts(theme, templates) {
  // Standard name on Vercel / .env is OPENROUTER_API_KEY. Older versions of
  // this repo used OPEN_ROUTER_API_KEY — accept both so existing configs work.
  // Trim: pasting into the Vercel editor can leave a trailing newline, which
  // OpenRouter rejects with "401 User not found".
  const rawKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_ROUTER_API_KEY
  const apiKey = (rawKey || '').trim()
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is missing from the environment')
  }
  if (apiKey !== rawKey) {
    console.warn('[openrouter] OPENROUTER_API_KEY had surrounding whitespace (trimmed before sending)')
  }

  const prompt = buildPrompt(theme, templates)
  const placeholders = collectPlaceholders(templates)

  const failures = []
  let fallbackTexts = null
  let fallbackEchoes = Infinity

  for (const model of FREE_MODELS) {
    try {
      const texts = await callModel(apiKey, model, prompt)
      if (texts.length < 1) {
        failures.push(`model ${model} returned no usable text`)
        continue
      }
      const echoes = countPlaceholderReuse(texts, placeholders)
      // A single match can be legitimate (some templates, e.g. "one does not
      // simply", reuse their own catchphrase), so only reject two or more.
      if (echoes < 2) {
        return normalize(texts, templates.length)
      }
      // The model parroted the templates' example captions instead of writing
      // new jokes. Remember the least-echoing attempt and try another model.
      if (echoes < fallbackEchoes) {
        fallbackEchoes = echoes
        fallbackTexts = texts
      }
      failures.push(`model ${model} reused ${echoes} template placeholder line(s)`)
    } catch (err) {
      failures.push(err.message)
    }
  }

  // Every model copied placeholders — showing the least-echoing result still
  // beats failing the whole request.
  if (fallbackTexts) {
    console.warn(
      `[openrouter] every model echoed template placeholders; using least-echoing result. ${failures.join('. ')}`,
    )
    return normalize(fallbackTexts, templates.length)
  }

  const lastError = new Error(
    `All OpenRouter attempts failed. ${failures.join('. ')}`,
  )
  lastError.status = 502
  throw lastError
}

function buildPrompt(theme, templates) {
  const list = templates
    .map((t, i) => {
      const eg = (t.example || []).filter(Boolean).join(' / ') || 'setup / punchline'
      const slots = t.lines === 2 ? 'top + bottom' : 'one line'
      return `${i + 1}. ${t.name} (${slots}). Format placeholder to REPLACE: "${eg}"`
    })
    .join('\n')

  return [
    `Write ${templates.length} genuinely funny, RELATABLE memes about ${theme}.`,
    '',
    'WHAT MAKES A GOOD MEME (read carefully):',
    '- Each meme = ONE specific everyday situation with a clear setup and a punchline.',
    '- Every line must be a COMPLETE, natural Hinglish sentence, like texting a friend.',
    '- The two lines must connect into ONE joke. NEVER write disconnected keywords.',
    '- top = the setup, bottom = the sharp punchline. For one-line templates use only top.',
    '- Be specific + relatable: padhai, salary, shaadi, cricket, reels, mummy ki daant, EMI.',
    '- Hinglish = Hindi + English in Roman/English letters. Casual spoken tone.',
    '- Each line: under 8 words, under 60 characters. No emojis, no hashtags, no quotes, no gaali.',
    '',
    'CRITICAL — WRITE ORIGINAL TEXT:',
    `- Every caption must be a BRAND-NEW joke invented for ${theme}.`,
    '- The "Format placeholder" below is the template\'s own built-in example, not an answer.',
    '- NEVER copy, reuse, translate or lightly reword any placeholder (or any text above).',
    '- If a caption repeats a placeholder, the whole answer is wrong.',
    '',
    `Now write EXACTLY ${templates.length} memes, one per template, IN THE SAME ORDER:`,
    list,
    '',
    'Reply with ONLY this JSON (bottom = "" for one-line templates):',
    '{"memes":[{"top":"...","bottom":"..."}]}',
  ].join('\n')
}

async function callModel(apiKey, model, prompt) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      // Recommended by OpenRouter so your app shows up in their rankings.
      'HTTP-Referer': 'https://ai-meme-generator.vercel.app',
      'X-Title': 'AI Meme Generator',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content:
            'You are a savage desi meme writer who thinks in Hinglish and knows ' +
            'every classic meme template by heart. You always reply with valid JSON.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    }),
  })

  // fetch does NOT throw on 4xx/5xx — check res.ok yourself (Week 1, Slide 22).
  // Pull OpenRouter's own error message so the real cause (missing key, rate
  // limit, 402, unknown model) is visible in logs instead of a bare "502".
  if (!res.ok) {
    throw new Error(await openRouterFailure(res, model))
  }

  const data = await res.json()
  const text = data?.choices?.[0]?.message?.content ?? ''
  return parseMemes(text)
}

// Best-effort extraction of OpenRouter's error detail for a non-OK response.
async function openRouterFailure(res, model) {
  let detail = ''
  try {
    const body = await res.json()
    detail =
      body?.error?.message ||
      body?.error?.code ||
      (typeof body === 'string' ? body : JSON.stringify(body).slice(0, 300))
  } catch {
    detail = (await res.text().catch(() => ''))?.slice(0, 300) || 'no details'
  }
  return `OpenRouter responded ${res.status} for ${model}: ${detail}`
}

// Models sometimes wrap JSON in ``` fences or add stray text. Parse leniently.
function parseMemes(text) {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()

  try {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
      const obj = JSON.parse(match[0])
      const list = Array.isArray(obj.memes) ? obj.memes : Array.isArray(obj) ? obj : null
      if (list) return list.map(toMeme)
    }
  } catch {
    // fall through
  }

  // Fallback: treat each non-empty line as a single-line meme.
  return cleaned
    .split('\n')
    .map((line) => line.replace(/^[-*\d.)\s]+/, '').replace(/^"|"$/g, '').trim())
    .filter(Boolean)
    .map((top) => ({ top, bottom: '' }))
}

// Accept a few shapes the model might use and normalise to { top, bottom }.
function toMeme(item) {
  if (typeof item === 'string') return { top: item.trim(), bottom: '' }
  const top = item.top ?? item.line1 ?? item.text ?? ''
  const bottom = item.bottom ?? item.line2 ?? ''
  return { top: String(top).trim(), bottom: String(bottom).trim() }
}

function normalize(texts, count) {
  const list = texts.slice(0, count)
  // Remove only TRAILING empty entries: dropping one from the middle would
  // shift later memes onto the wrong template. Middle blanks stay in place.
  let end = list.length
  while (end > 0 && !(list[end - 1].top || list[end - 1].bottom)) end--
  return list.slice(0, end)
}

// Normalised form of the templates' built-in example captions. Models love to
// parrot these back ("left on unread" / "left on read") instead of inventing a
// joke, so we keep them around to detect that.
function collectPlaceholders(templates) {
  const phrases = []
  for (const t of templates) {
    for (const line of t.example || []) {
      const norm = normaliseLine(line)
      // Skip very short phrases that a real joke could plausibly contain.
      if (norm.length >= 8) phrases.push(norm)
    }
  }
  return phrases
}

// How many output lines merely repeat a template placeholder.
function countPlaceholderReuse(texts, phrases) {
  if (!phrases.length) return 0
  let count = 0
  for (const { top, bottom } of texts) {
    for (const line of [top, bottom]) {
      const norm = normaliseLine(line)
      if (norm && phrases.some((p) => norm === p || norm.includes(p))) count++
    }
  }
  return count
}

// Case/punctuation-insensitive comparison key.
function normaliseLine(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}
