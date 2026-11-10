const { goals } = require('mineflayer-pathfinder')
const config = require('./config')
const chat = require('./chat')
const brain = require('./brain')
const nav = require('./nav')
const { grind } = require('./grind')
const { buildBase, stash } = require('./base')
const { giveTo, matcher, ALIASES } = require('./give')
const { huntPlayer } = require('./hunt')
const { buildHouse } = require('./house')
const { jump, bunnyHop, dance, pillar } = require('./jump')
const { craftArmor } = require('./armor')
const { gather } = require('./dig')
const { sleep, countItem, mcd } = require('./utils')

const seen = new Map()
const startGrind = (bot) => brain.runTask(bot, 'grind', () => grind(bot))
const resume = (bot) => () => bot.autoResume && startGrind(bot)

const ORES = {
  diamond: [['diamond_ore', 'deepslate_diamond_ore'], -54],
  iron: [['iron_ore', 'deepslate_iron_ore'], 16],
  coal: [['coal_ore', 'deepslate_coal_ore']],
  gold: [['gold_ore', 'deepslate_gold_ore'], -16],
  redstone: [['redstone_ore', 'deepslate_redstone_ore'], -50],
  lapis: [['lapis_ore', 'deepslate_lapis_ore'], 0],
  emerald: [['emerald_ore', 'deepslate_emerald_ore'], 0],
  stone: [['stone']],
  cobblestone: [['stone']],
  dirt: [['dirt']],
  sand: [['sand']],
  gravel: [['gravel']],
}

function handle(bot, username, message) {
  if (username === bot.username) return
  const key = username + '|' + message
  const now = Date.now()
  if (seen.has(key) && now - seen.get(key) < 1500) return
  seen.set(key, now)

  const say = (t) => chat.say(bot, t)
  const lower = message.toLowerCase()

  if (!lower.includes(config.tag)) {
    const reply = chat.casual(message)
    if (reply && (/yukiiii/i.test(message) || Math.random() < 0.4)) say(reply)
    return
  }
  const cmd = lower.replace(config.tag, ' ').replace(/[,:!?]/g, ' ').replace(/\s+/g, ' ').trim()
  const trusted = config.trusted.map((x) => x.toLowerCase()).includes(username.toLowerCase())
  command(bot, username, cmd, trusted, say)
}

function command(bot, username, cmd, trusted, say) {
  if (!cmd) return say('haan bol')
  if (!trusted) return say(chat.casual(cmd) || 'sirf ShoaibXNoob ka order maanta hu 😄')

  const [w, ...rest] = cmd.split(/\s+/)
  const arg = rest.join(' ')
  const playerEntity = () => bot.players[username] && bot.players[username].entity

  if (/^(stop|ruk|ruko|rukja|halt)$/.test(w)) {
    bot.autoResume = false
    brain.stopAll(bot)
    return say('ok ruk gaya')
  }
  if (/^(grind|start|resume|kaam)$/.test(w)) {
    bot.autoResume = true
    say('chalo grind shuru')
    return startGrind(bot)
  }
  if (/^(come|aao|aa|idhar|here)$/.test(w)) {
    return brain.runTask(
      bot,
      'come',
      async () => {
        const e = playerEntity()
        if (!e) return say('tu dikh nahi raha bhai')
        await nav.near(bot, e.position, 2, 60000)
      },
      resume(bot)
    )
  }
  if (/^(follow|chal)$/.test(w)) {
    return brain.runTask(bot, 'follow', async () => {
      const e = playerEntity()
      if (!e) return say('tu dikh nahi raha bhai')
      say('chal peeche aa raha hu')
      bot.pathfinder.setGoal(new goals.GoalFollow(e, 3), true)
      while (!bot.abort) await sleep(500)
      bot.pathfinder.setGoal(null)
    })
  }
  if (/^(base|ghar|home)$/.test(w)) {
    return brain.runTask(bot, 'base', () => buildBase(bot, say), resume(bot))
  }
  if (/^(house|makaan|ghar2)$/.test(w)) {
    return brain.runTask(bot, 'house', () => buildHouse(bot, say), resume(bot))
  }
  if (/^(jump|kud|kood)$/.test(w)) {
    const times = Math.min(parseInt(rest[0]) || 5, 30)
    return brain.runTask(bot, 'jump', () => jump(bot, times), resume(bot))
  }
  if (/^(hop|bhag|run)$/.test(w)) {
    return brain.runTask(bot, 'hop', () => bunnyHop(bot, 10), resume(bot))
  }
  if (/^(dance|nach|naach)$/.test(w)) {
    return brain.runTask(bot, 'dance', () => dance(bot), resume(bot))
  }
  if (/^(pillar|tower|upar|oopar)$/.test(w)) {
    const h = Math.min(parseInt(rest[0]) || 6, 40)
    return brain.runTask(bot, 'pillar', async () => {
      const done = await pillar(bot, h)
      say(done ? `${done} block upar chadh gaya` : 'blocks nahi hai mere paas')
    })
  }
  if (/^(armor|armour|kavach)$/.test(w)) {
    return brain.runTask(bot, 'armor', () => craftArmor(bot), resume(bot))
  }
  if (/^(stash|chest|jama)$/.test(w)) {
    return brain.runTask(bot, 'stash', () => stash(bot, say), resume(bot))
  }
  if (/^(status|inv|inventory|stats)$/.test(w)) {
    const c = (n) => countItem(bot, (x) => x === n)
    return say(`diamond ${c('diamond')}, iron ${c('iron_ingot')}, coal ${c('coal')}, stone ${c('cobblestone')} | ${bot.taskName}`)
  }
  if (/^(kill|attack|maar|fight|pvp)$/.test(w)) {
    const name = rest[0] && Object.keys(bot.players).find((p) => p.toLowerCase() === rest[0])
    if (!name) {
      const on = Object.keys(bot.players).filter((p) => p !== bot.username)
      return say(`wo player online nahi hai. Online: ${on.join(', ') || 'koi nahi'}`)
    }
    if (config.trusted.map((x) => x.toLowerCase()).includes(name.toLowerCase())) return say('apne bande ko nahi maarunga 😂')
    say(`${name} ko dhoondh raha hu`)
    return brain.runTask(bot, 'pvp', () => huntPlayer(bot, name, say), resume(bot))
  }
  if (/^(mine|khod|dhundh|collect)$/.test(w)) {
    const m = arg.match(/^(\w+)(?:\s+(\d+))?/)
    const item = m && m[1].replace(/s$/, '')
    const count = (m && parseInt(m[2])) || 10
    const logs = mcd(bot)
      .blocksArray.filter((b) => /_log$/.test(b.name) && !b.name.startsWith('stripped_'))
      .map((b) => b.name)
    const spec =
      item === 'wood' || item === 'log' ? [logs] : ORES[item] || [[`${item}_ore`, `deepslate_${item}_ore`, item], undefined]
    say(`ok ${count} ${item} mine karta hu`)
    return brain.runTask(bot, 'mine', () => gather(bot, spec[0], count, spec[1]), resume(bot))
  }

  // give: "give diamond" / "diamond" / "sab"
  const item = /^(give|de|do|dede)$/.test(w) ? arg : cmd
  const word = item.trim().toLowerCase().replace(/s$/, '')
  const known = ALIASES[word] || ALIASES[item.trim()] || mcd(bot).itemsArray.some((i) => i.name.includes(word.replace(/\s+/g, '_')))
  if (!item || !known) return say(chat.casual(cmd) || 'samjha nahi bhai 😅')

  const test = matcher(item)
  const have = bot.inventory.items().filter((i) => test(i.name))
  if (!have.length) return say(`mere paas abhi ${item} nahi hai bhai, grind chal rahi hai`)
  say(`aa raha hu, ${have.reduce((s, i) => s + i.count, 0)} ${item} lekar`)
  return brain.runTask(
    bot,
    'give',
    async () => {
      const r = await giveTo(bot, username, test, say)
      if (r > 0) say(`le bhai ${r} drop kar diye`)
    },
    resume(bot)
  )
}

module.exports = { handle, command, startGrind, resume }
