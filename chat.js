const { sleep, rand, pick } = require('./utils')

// Anti-spam safe chat: min 5s gap, max 5 messages/minute, no repeats within 60s, short queue.
const MIN_GAP = 5000
const MAX_PER_MIN = 5
const queue = []
const sentAt = []
const recent = new Map()
let pumping = false
let lastSent = 0

function say(bot, text) {
  const now = Date.now()
  if (recent.has(text) && now - recent.get(text) < 60000) return
  if (queue.length >= 2) return
  recent.set(text, now)
  queue.push(text)
  pump(bot)
}

async function pump(bot) {
  if (pumping) return
  pumping = true
  while (queue.length) {
    const t = queue.shift()
    await sleep(Math.max(0, MIN_GAP - (Date.now() - lastSent)) + rand(500, 1500) + Math.min(t.length * 60, 2000))
    while (sentAt.length && Date.now() - sentAt[0] > 60000) sentAt.shift()
    if (sentAt.length >= MAX_PER_MIN) continue
    try {
      bot.chat(t)
    } catch {}
    lastSent = Date.now()
    sentAt.push(lastSent)
  }
  pumping = false
}

// Login/register command, sent directly (counted in the limiter)
async function raw(bot, text) {
  await sleep(rand(1200, 2000))
  try {
    bot.chat(text)
  } catch {}
  lastSent = Date.now()
  sentAt.push(lastSent)
}

const REPLIES = [
  [/\b(hi+|hello+|hey+|yo+|hola|namaste|salam|assalam)\b/i, ['yo', 'hey bro', 'hii', 'kya haal', 'aur bhai']],
  [/(kaise|kese|kaisa|how are) ?(ho|hai|you|u)/i, ['mast bhai, grind chal rahi hai', 'badhiya, tu bata', 'first class']],
  [/(kya kar|kya kr|what.*doing|wyd)/i, ['bas grind kar raha hu', 'mining chal rahi hai bro', 'resources jama kar raha hu']],
  [/\b(gg|nice|op|pro)\b/i, ['thanks bro', 'haha shukriya', 'gg']],
  [/\b(noob)\b/i, ['tu noob 😂', 'abe tu khud noob hai', 'haha ok']],
  [/(thanks|thx|shukriya|dhanyavad)/i, ['koi baat nahi', 'np bro', 'welcome']],
]

function casual(text) {
  for (const [re, outs] of REPLIES) if (re.test(text)) return pick(outs)
  return null
}

module.exports = { say, raw, casual }
