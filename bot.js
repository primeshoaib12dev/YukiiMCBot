const mineflayer = require('mineflayer')
const { pathfinder } = require('mineflayer-pathfinder')
const config = require('./config')
const chat = require('./chat')
const brain = require('./brain')
const nav = require('./nav')
const survival = require('./survival')
const commands = require('./commands')
const { log } = require('./utils')
const state = require('./state')
const hook = require('./hook')
const stats = require('./stats')
const track = require('./track')

process.on('unhandledRejection', (e) => log('unhandledRejection', e && e.message))
process.on('uncaughtException', (e) => log('uncaughtException', e && e.message))

function start() {
  log(`connecting to ${config.host}:${config.port} as ${config.username}`)
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: config.auth,
    version: config.version,
  })
  bot.loadPlugin(pathfinder)
  brain.init(bot)
  track.attach(bot)
  state.bot = bot
  state.ready = false
  state.authed = false
  state.msgs.length = 0
  bot.on('diggingCompleted', (b) => stats.mined(b.name))

  // ---- login (AuthMe) ----
  let started = false
  let authed = false
  let sawPrompt = false
  let lastAuth = 0
  let authTries = 0

  const begin = () => {
    if (started) return
    started = true
    log('grind shuru')
    commands.startGrind(bot)
  }
  const onAuthed = () => {
    if (authed) return
    authed = true
    state.authed = true
    log('login ho gaya')
    setTimeout(begin, 2500)
  }

  bot.on('messagestr', (msg) => {
    console.log('[server]', msg.slice(0, 160))
    state.msgs.push(msg.slice(0, 160))
    if (state.msgs.length > 10) state.msgs.shift()

    const now = Date.now()
    const wantsLogin = /\/login/i.test(msg)
    const wantsReg = /\/register/i.test(msg)
    if (!authed && (wantsLogin || wantsReg)) {
      sawPrompt = true
      if (authTries >= 4 || now - lastAuth < 6000) return
      lastAuth = now
      // both mentioned: first try register, afterwards login
      const useReg = wantsReg && (!wantsLogin || authTries === 0)
      authTries++
      chat.raw(bot, useReg ? `/register ${config.password} ${config.password}` : `/login ${config.password}`)
      return
    }
    if (!authed && /success|logged in|welcome back|already logged/i.test(msg) && !/please|use |\/register|\/login/i.test(msg)) {
      onAuthed()
      return
    }

    // fallback chat parser for servers with custom chat formats: "[Rank] Name » msg" / "<Name> msg"
    const m = msg.match(/^(?:\[[^\]]*\]\s*)*<?([A-Za-z0-9_]{3,16})>?\s*(?:»|:|>)\s*(.+)$/)
    if (m) commands.handle(bot, m[1], m[2])
  })

  bot.on('chat', (username, message) => commands.handle(bot, username, message))

  bot.once('spawn', () => {
    log('spawned')
    state.ready = true
    state.spawnedAt = Date.now()
    hook.embed('🟢 Bot server me join ho gaya', [
      { name: 'Position', value: hook.xyz(bot.entity.position), inline: true },
      { name: 'Version', value: String(bot.version), inline: true },
    ])
    nav.setupMovements(bot)
    survival.start(bot)
    // server without any login plugin: start after 20s
    setTimeout(() => !sawPrompt && onAuthed(), 20000)
    // prompt seen but never logged in
    setTimeout(() => {
      if (sawPrompt && !authed) {
        log('LOGIN NAHI HUA. Upar [server] messages dekho, password / plugin check karo')
        hook.text(`⚠️ Bot login nahi kar paya. Last server messages:\n${state.msgs.slice(-4).join('\n')}`)
      }
    }, 45000)
  })

  // After dying: stop everything and wait until the owner says "@Yukiiii grind"
  bot.on('death', () => {
    log('died, waiting for owner')
    stats.death()
    hook.embed(
      '💀 Bot mar gaya',
      [
        { name: 'Death coordinates', value: hook.xyz(bot.entity.position) },
        { name: 'Status', value: 'Grind ruka hua hai. Discord pe /grind ya game me "@Yukiiii grind" likho.' },
      ],
      0xed4245
    )
    bot.autoResume = false
    brain.stopAll(bot)
    chat.say(bot, 'mar gaya, grind ke liye @Yukiiii grind likho')
  })

  let banned = false
  bot.on('kicked', (r) => {
    const s = typeof r === 'string' ? r : JSON.stringify(r)
    log('kicked:', s)
    hook.text(`⛔ Bot kick hua: ${s}`)
    if (/ban/i.test(s)) banned = true
  })
  bot.on('error', (e) => log('error:', e.message))

  // join/leave alerts on the webhook (ignore the initial player list right after spawn)
  const fresh = () => state.spawnedAt && Date.now() - state.spawnedAt > 15000
  bot.on('playerJoined', (p) => fresh() && p.username !== bot.username && hook.text(`➕ **${p.username}** server me aaya`))
  bot.on('playerLeft', (p) => fresh() && p.username !== bot.username && hook.text(`➖ **${p.username}** server se gaya`))

  bot.on('end', () => {
    state.ready = false
    state.authed = false
    survival.stop(bot)
    if (banned) {
      log('BANNED by server. Reconnect band. Server console me likho: pardon Yukiiii  (ya spam plugin ka unban command)')
      return
    }
    log('disconnected, reconnecting in 40s')
    setTimeout(start, 40000)
  })
}

require('./discordbot').start()
start()
