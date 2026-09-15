// ─────────────────────────────────────────────────────────────────────────────
//  Meme image builder (server-side only).
//
//  Images come from the free, no-key memegen.link API. For maximum variety we
//  pull memegen's FULL template catalog (~200 templates) and randomly sample a
//  fresh set each run — so you don't see the same 5 images every time.
//
//  Each template ships an `example` that demonstrates its joke format
//  (Drake = "left on unread" / "left on read"). We pass that example to the
//  model so the text fits the template's structure — that's what viral memes do.
// ─────────────────────────────────────────────────────────────────────────────
const BASE = 'https://api.memegen.link/images'
const CATALOG_URL = 'https://api.memegen.link/templates'

// Curated allowlist of WELL-KNOWN templates (1-2 text lines) whose joke format
// the model reliably understands. Random obscure templates produced nonsense,
// so we sample from these ~27 — still tons of variety, but coherent results.
const POPULAR_IDS = new Set([
  'drake', 'blb', 'rollsafe', 'grumpycat', 'fry', 'success', 'mordor',
  'spongebob', 'cmm', 'disastergirl', 'leo', 'wonka', 'aag', 'oprah', 'buzz',
  'yodawg', 'doge', 'stonks', 'both', 'fine', 'interesting', 'afraid',
  'aint-got-time', 'morpheus', 'patrick', 'spiderman', 'philosoraptor',
])

// Offline fallback so the demo still works if the catalog fetch fails.
const FALLBACK_CATALOG = [
  { id: 'drake', name: 'Drake', lines: 2, example: ['left on unread', 'left on read'] },
  { id: 'fry', name: 'Futurama Fry', lines: 2, example: ['not sure if trolling', 'or just stupid'] },
  { id: 'aag', name: 'Ancient Aliens', lines: 2, example: ['', 'aliens'] },
  { id: 'doge', name: 'Doge', lines: 2, example: ['such meme', 'very skill'] },
  { id: 'buzz', name: 'X X Everywhere', lines: 2, example: ['memes', 'memes everywhere'] },
  { id: 'grumpycat', name: 'Grumpy Cat', lines: 2, example: ['everyone said we will meet', 'no one made a plan'] },
  { id: 'mordor', name: 'One Does Not Simply', lines: 2, example: ['one does not simply', 'walk into mordor'] },
  { id: 'fine', name: 'This Is Fine', lines: 2, example: ['', 'this is fine'] },
  { id: 'wonka', name: 'Condescending Wonka', lines: 2, example: ['oh, you just graduated?', 'you must know everything'] },
  { id: 'spiderman', name: 'Spiderman Pointing', lines: 2, example: ['me pointing at you', 'you pointing at me'] },
]

let catalogCache = null

async function getCatalog() {
  if (catalogCache) return catalogCache
  try {
    // Short timeout: the catalog is only a source of variety. If it's slow we
    // fall back to the hardcoded list instead of letting the request hang.
    const res = await fetch(CATALOG_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`catalog responded ${res.status}`)
    const all = await res.json()
    const usable = all
      .filter((t) => POPULAR_IDS.has(t.id) && t.lines >= 1 && t.lines <= 2)
      .map((t) => ({
        id: t.id,
        name: t.name,
        lines: t.lines,
        example: t.example?.text ?? [],
      }))
    catalogCache = usable.length ? usable : FALLBACK_CATALOG
  } catch {
    catalogCache = FALLBACK_CATALOG
  }
  return catalogCache
}

// Randomly sample `count` distinct templates → fresh image variety every run.
export async function pickTemplates(count = 5) {
  const pool = [...(await getCatalog())]
  const picked = []
  while (picked.length < count && pool.length) {
    const i = Math.floor(Math.random() * pool.length)
    picked.push(pool.splice(i, 1)[0])
  }
  return picked
}

// memegen.link hard-rejects any path text segment longer than 200 bytes with
// HTTP 414. Long lines also wrap/overflow on the image ("not structured"), so
// cap each line at ~60 chars and truncate the tail if a model overshoots.
const MAX_LINE_CHARS = 60
const MAX_SEGMENT_BYTES = 200

// Combines the chosen templates with the model's text into ready-to-show memes.
// Templates whose text is empty are skipped entirely (a blank meme is worse than
// a slightly shorter list) — remaining memes stay matched to their template.
export function buildMemeImages(category, templates, texts) {
  return templates.flatMap((template, i) => {
    const text = texts[i] ?? { top: '', bottom: '' }
    const top = cleanLine(text.top)
    const bottom = cleanLine(text.bottom)
    if (!top && !bottom) return []

    // memegen renders top/bottom as two path segments. 1-line templates use one.
    const path =
      template.lines === 2 && bottom
        ? `${encodeMemeText(top)}/${encodeMemeText(bottom)}`
        : encodeMemeText(top || bottom || ' ')

    return [
      {
        id: `${category}-${i}-${Date.now()}`,
        caption: [top, bottom].filter(Boolean).join(' · '),
        imageUrl: `${BASE}/${template.id}/${path}.png`,
      },
    ]
  })
}

// Collapse whitespace/newlines and bound the raw line length.
function cleanLine(text) {
  return String(text || '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, MAX_LINE_CHARS)
}

// memegen.link path-encoding rules (order matters):
//   _ -> __ , - -> -- , space -> _ , then the special ~x escapes.
// Single AND double quotes are both written as '' (memegen decodes '' to ').
function encodeMemeText(text) {
  let raw = cleanLine(text)

  // Clip down at a word boundary until the encoded segment fits memegen's
  // hard 200-byte limit (prevents HTTP 414 for very long model output).
  let encoded = encode(raw)
  while (Buffer.byteLength(encoded, 'utf8') > MAX_SEGMENT_BYTES && raw.length > 0) {
    raw = clipToWord(raw)
    encoded = encode(raw)
  }
  return encoded || '_'
}

function encode(raw) {
  return raw
    .replace(/_/g, '__')
    .replace(/-/g, '--')
    .replace(/ /g, '_')
    .replace(/\?/g, '~q')
    .replace(/&/g, '~a')
    .replace(/%/g, '~p')
    .replace(/#/g, '~h')
    .replace(/\//g, '~s')
    .replace(/"/g, "''")
    .replace(/'/g, "''")
    .replace(/\n/g, '~n')
}

// Cut at the last space within the current length (word-aware truncation).
function clipToWord(text) {
  const cut = text.slice(0, -1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trim()
}
