const { Vec3 } = require('vec3')
const {
  Client,
  Events,
  GatewayIntentBits,
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require('discord.js')
const config = require('./config')
const state = require('./state')
const commands = require('./commands')
const brain = require('./brain')
const chat = require('./chat')
const nav = require('./nav')
const hook = require('./hook')
const { s: stats } = require('./stats')
const { storeAll } = require('./store')
const { sleep, log, mcd } = require('./utils')
const { craft } = require('./crafting')

const MINE = ['wood', 'stone', 'coal', 'iron', 'gold', 'diamond', 'lapis', 'redstone', 'emerald', 'dirt', 'sand', 'gravel']
const simple = (name, desc) => new SlashCommandBuilder().setName(name).setDescription(desc)

const defs = [
  simple('kill', 'Player ko dhoondh ke maaro, aur online players batao').addStringOption((o) =>
    o.setName('username').setDescription('Minecraft username').setRequired(true).setAutocomplete(true)
  ),
  simple('mine', 'Resource mine karo')
    .addStringOption((o) =>
      o
        .setName('item')
        .setDescription('Kya mine karna hai')
        .setRequired(true)
        .addChoices(...MINE.map((m) => ({ name: m, value: m })))
    )
    .addIntegerOption((o) => o.setName('count').setDescription('Kitne blocks (default 10)').setMinValue(1).setMaxValue(256)),
  simple('store', 'Chhupe chest me saman rakho, coordinates webhook pe jayenge').addStringOption((o) =>
    o
      .setName('mode')
      .setDescription('Kya rakhna hai')
      .addChoices(
        { name: 'Extra saman (diamond, iron, tools bot ke paas rahenge)', value: 'surplus' },
        { name: 'Sab kuch (tools, armor, khana chhod ke)', value: 'all' }
      )
  ),
  simple('help', 'Saare commands ki list'),
  simple('stats', 'Bot ne ab tak kya kiya'),
  simple('inventory', 'Bot ka inventory'),
  simple('server', 'Server ki information'),
  simple('players', 'Kaun kaun online hai'),
  simple('grind', 'Grind shuru karo'),
  simple('stop', 'Sab kaam rok do'),
  simple('come', 'Owner ke paas aao'),
  simple('follow', 'Owner ke peeche chalo'),
  simple('house', 'Zameen ke upar ghar banao'),
  simple('base', 'Zameen ke andar chhupa ghar banao'),
  simple('armor', 'Armor craft karke pehno'),
  simple('dance', 'Nacho'),
  simple('jump', 'Kudo').addIntegerOption((o) => o.setName('times').setDescription('Kitni baar').setMinValue(1).setMaxValue(30)),
  simple('pillar', 'Blocks se upar tower banao').addIntegerOption((o) => o.setName('height').setDescription('Kitna upar').setMinValue(1).setMaxValue(40)),
  simple('give', 'Owner ko saman do').addStringOption((o) =>
    o.setName('item').setDescription('diamond, iron, sab ...').setRequired(true).setAutocomplete(true)
  ),
  simple('say', 'Bot game chat me ye likhega').addStringOption((o) => o.setName('message').setDescription('Message').setRequired(true).setMaxLength(100)),
  simple('goto', 'Coordinates pe jao')
    .addIntegerOption((o) => o.setName('x').setDescription('X').setRequired(true))
    .addIntegerOption((o) => o.setName('y').setDescription('Y').setRequired(true))
    .addIntegerOption((o) => o.setName('z').setDescription('Z').setRequired(true)),
].map((c) => c.toJSON())

// ---------- helpers ----------
const allowed = (i) => {
  const ids = config.discord.ownerIds
  if (ids.length) return ids.includes(i.user.id)
  return !!i.memberPermissions && i.memberPermissions.has(PermissionFlagsBits.Administrator)
}

const ago = (ms) => {
  const m = Math.floor(ms / 60000)
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`
}
const top = (obj, n = 8) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ×${v}`)
    .join('\n') || '-'
const sum = (obj) => Object.values(obj).reduce((a, b) => a + b, 0)
const online = (bot) => Object.values(bot.players).filter((p) => p.username !== bot.username)

// Run an in-game command (same parser as game chat) and show what the bot answers
async function via(i, text, extra = '') {
  const out = []
  let done = false
  const say = (t) => (done ? i.followUp(`🤖 ${t}`).catch(() => {}) : out.push(t))
  commands.command(state.bot, config.owner, text, true, say)
  await sleep(1500)
  done = true
  await i.editReply((out.length ? out.map((t) => `🤖 ${t}`).join('\n') : '✅ ok') + extra)
}

// ---------- handlers ----------
const handlers = {
  async kill(i, bot) {
    const name = i.options.getString('username')
    const list = online(bot)
    const names = list.map((p) => `${p.username} (${p.ping}ms)`).join(', ') || 'koi nahi'
    const found = list.find((p) => p.username.toLowerCase() === name.toLowerCase())
    const footer = `\n🟢 Online (${list.length}): ${names}`
    if (!found) return i.editReply(`❌ **${name}** online nahi hai.${footer}`)
    return via(i, `kill ${found.username.toLowerCase()}`, footer)
  },
  mine: (i) => via(i, `mine ${i.options.getString('item')} ${i.options.getInteger('count') || 10}`),
  grind: (i) => {
    state.bot.autoResume = true
    return via(i, 'grind')
  },
  stop: (i) => via(i, 'stop'),
  come: (i) => via(i, 'come'),
  follow: (i) => via(i, 'follow'),
  house: (i) => via(i, 'house'),
  base: (i) => via(i, 'base'),
  armor: (i) => via(i, 'armor'),
  dance: (i) => via(i, 'dance'),
  jump: (i) => via(i, `jump ${i.options.getInteger('times') || 5}`),
  pillar: (i) => via(i, `pillar ${i.options.getInteger('height') || 6}`),
  give: (i) => via(i, `give ${i.options.getString('item')}`),

  async say(i, bot) {
    if (!state.authed) {
      const last = state.msgs.slice(-5).join('\n') || '-'
      return i.editReply(`⚠️ Bot server pe login nahi hua, isliye chat nahi kar sakta.\nLast server messages:\n\`\`\`${last}\`\`\``)
    }
    bot.chat(i.options.getString('message'))
    return i.editReply('✅ Game chat me bhej diya')
  },

  async goto(i, bot) {
    const p = new Vec3(i.options.getInteger('x'), i.options.getInteger('y'), i.options.getInteger('z'))
    brain.runTask(bot, 'goto', () => nav.near(bot, p, 2, 180000), commands.resume(bot))
    return i.editReply(`🧭 ${hook.xyz(p)} pe ja raha hu`)
  },

  async store(i, bot) {
    const mode = i.options.getString('mode') || 'surplus'
    brain.runTask(bot, 'store', () => storeAll(bot, (t) => hook.text(`🤖 ${t}`), mode), commands.resume(bot))
    return i.editReply(
      '📦 Store shuru. Chest na ho to pehle chhupa ghar khodega, isme time lagega. Coordinates webhook channel pe aayenge.'
    )
  },

  async help(i) {
    const e = new EmbedBuilder()
      .setTitle('🤖 Yukiiii commands')
      .setColor(0x5865f2)
      .addFields(
        { name: 'Jaankari', value: '`/stats` bot ne kya kiya\n`/inventory` inventory\n`/server` server info\n`/players` kaun online hai' },
        { name: 'Kaam', value: '`/mine item count` wood, stone, coal, iron, gold, diamond, lapis...\n`/grind` auto grind\n`/stop` sab rok do\n`/store` chhupe chest me saman + coordinates webhook pe\n`/house` ghar upar\n`/base` chhupa ghar neeche\n`/armor` armor banao' },
        { name: 'PvP', value: '`/kill username` player ko maaro (critical hits), online list bhi aati hai' },
        { name: 'Movement', value: '`/come` `/follow` `/goto x y z` `/jump` `/pillar` `/dance` `/give item` `/say message`' }
      )
    return i.editReply({ embeds: [e] })
  },

  async players(i, bot) {
    const list = Object.values(bot.players)
    const lines = list.map((p) => {
      const d = p.entity ? `, ${Math.round(p.entity.position.distanceTo(bot.entity.position))}m door` : ''
      return `${p.username === bot.username ? '🤖' : '🟢'} **${p.username}** (${p.ping}ms${d})`
    })
    const e = new EmbedBuilder()
      .setTitle(`Online players (${list.length})`)
      .setDescription(lines.join('\n') || 'Koi nahi')
      .setColor(0x57f287)
    return i.editReply({ embeds: [e] })
  },

  async stats(i, bot) {
    const pos = bot.entity ? hook.xyz(bot.entity.position) : '-'
    const e = new EmbedBuilder()
      .setTitle(`📊 ${bot.username} stats`)
      .setColor(0x5865f2)
      .addFields(
        { name: 'Uptime', value: ago(Date.now() - stats.start), inline: true },
        { name: 'Abhi kya kar raha', value: bot.taskName || 'idle', inline: true },
        { name: 'Health / Food', value: `❤ ${Math.round(bot.health)}/20   🍗 ${bot.food}/20`, inline: true },
        { name: 'Position', value: pos },
        { name: `Mined (${sum(stats.mined)})`, value: top(stats.mined).slice(0, 1000), inline: true },
        { name: `Crafted (${sum(stats.crafted)})`, value: top(stats.crafted).slice(0, 1000), inline: true },
        { name: `Kills (${sum(stats.kills)})`, value: top(stats.kills, 6), inline: true },
        { name: 'Deaths', value: String(stats.deaths), inline: true },
        { name: 'Login', value: state.authed ? '✅ ho gaya' : '❌ nahi hua', inline: true },
        { name: 'Recent activity', value: '```\n' + (stats.acts.slice(-8).join('\n') || '-').slice(0, 900) + '\n```' },
        { name: 'Server messages', value: '```\n' + (state.msgs.slice(-4).join('\n') || '-').slice(0, 900) + '\n```' }
      )
    return i.editReply({ embeds: [e] })
  },

  async inventory(i, bot) {
    const merged = {}
    for (const it of bot.inventory.items()) merged[it.name] = (merged[it.name] || 0) + it.count
    const lines = Object.entries(merged)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `**${k}** ×${v}`)
    const armor = [5, 6, 7, 8].map((n) => bot.inventory.slots[n]).filter(Boolean).map((x) => x.name)
    const off = bot.inventory.slots[45]
    const e = new EmbedBuilder()
      .setTitle(`🎒 Inventory (${bot.inventory.items().length} stacks)`)
      .setDescription(lines.join('\n').slice(0, 3800) || 'Khali hai')
      .setColor(0xfee75c)
      .addFields(
        { name: 'Haath me', value: bot.heldItem ? bot.heldItem.name : '-', inline: true },
        { name: 'Armor', value: armor.join('\n') || '-', inline: true },
        { name: 'Off-hand', value: off ? off.name : '-', inline: true }
      )
    return i.editReply({ embeds: [e] })
  },

  async server(i, bot) {
    const t = bot.time ? bot.time.timeOfDay : 0
    const hh = Math.floor(((t / 1000 + 6) % 24 + 24) % 24)
    const mm = Math.floor(((t % 1000) / 1000) * 60)
    let tps = null
    try {
      tps = typeof bot.getTps === 'function' ? bot.getTps() : null
    } catch {}
    const list = Object.values(bot.players)
    const e = new EmbedBuilder()
      .setTitle('🖥️ Server info')
      .setColor(0xeb459e)
      .addFields(
        { name: 'Address', value: `${config.host}:${config.port}`, inline: true },
        { name: 'Version', value: String(bot.version), inline: true },
        { name: 'Bot ping', value: `${bot.player ? bot.player.ping : '?'} ms`, inline: true },
        { name: `Players (${list.length})`, value: list.map((p) => `${p.username} (${p.ping}ms)`).join(', ').slice(0, 1000) || '-' },
        { name: 'Game time', value: `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${t < 12000 ? '☀️ din' : '🌙 raat'}`, inline: true },
        { name: 'Weather', value: bot.isRaining ? '🌧️ baarish' : '☀️ saaf', inline: true },
        { name: 'TPS', value: tps ? tps.toFixed(1) : '?', inline: true },
        { name: 'Dimension', value: String(bot.game.dimension), inline: true },
        { name: 'Difficulty', value: String(bot.game.difficulty), inline: true },
        { name: 'Gamemode', value: String(bot.game.gameMode), inline: true }
      )
    return i.editReply({ embeds: [e] })
  },
}

async function autocomplete(i) {
  const bot = state.bot
  const f = i.options.getFocused(true)
  const q = String(f.value).toLowerCase()
  let names = []
  if (bot && f.name === 'username') names = online(bot).map((p) => p.username)
  if (bot && f.name === 'item') names = ['sab', 'food', ...new Set(bot.inventory.items().map((x) => x.name))]
  await i
    .respond(names.filter((n) => n.toLowerCase().includes(q)).slice(0, 25).map((n) => ({ name: n, value: n })))
    .catch(() => {})
}

function start() {
  const d = config.discord
  if (!d.token || d.token.startsWith('PASTE')) {
    log('Discord token set nahi hai (config.js), sirf Minecraft bot chalega')
    return
  }
  const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] })

  client.once(Events.ClientReady, async () => {
    log(`Discord bot online: ${client.user.tag}`)
    if (client.user.username !== config.username) client.user.setUsername(config.username).catch(() => {})
    const presence = () => {
      const b = state.bot
      const live = state.ready && b
      client.user.setPresence({
        activities: [{ name: live ? `${b.taskName} | ${Object.keys(b.players).length} online` : 'server offline' }],
        status: live ? 'online' : 'idle',
      })
    }
    presence()
    setInterval(presence, 30000)
    try {
      // Remove commands registered by older versions; this build uses .prefix messages only.
      await client.application.commands.set([])
      if (d.guildId && !d.guildId.startsWith('PASTE')) {
        const guild = await client.guilds.fetch(d.guildId)
        await guild.commands.set([])
      }
    } catch (e) {
      log('Old slash command cleanup warning:', e.message)
    }
    log('Discord prefix commands ready. Prefix: .')
    hook.text('🟢 Discord control online. Prefix commands ready.')
  })


  const isOwnerMessage = (msg) => {
    const ids = config.discord.ownerIds || []
    return ids.length ? ids.includes(msg.author.id) : !!msg.member?.permissions?.has(PermissionFlagsBits.Administrator)
  }
  const sendLong = async (msg, text) => {
    const chunks = String(text).match(/[\s\S]{1,1900}/g) || ['(empty)']
    for (const chunk of chunks) await msg.reply(chunk).catch(() => {})
  }
  const helpText = (section = '') => {
    const all = {
      main: '**YukiiBot V5 — Discord Prefix Help**\n`.help mine` `.help build` `.help kill` `.help craft`\n`.inventory` `.stats` `.players` `.server`\n`.msg <text>` public game chat\n`.msg owner <text>` private message to owner\n`.mine <resource> [count]` `.craft <item> [count]` `.find <structure>`\n`.grind` `.stop` `.come` `.follow` `.goto x y z` `.house` `.base` `.armor` `.give <item>` `.store`',
      mine: '**Mining**\n`.mine wood 32` `.mine iron 10` `.mine diamond 5`\nResources: wood, stone, coal, iron, gold, diamond, lapis, redstone, emerald, dirt, sand, gravel.\n`.grind` starts auto-grind; `.stop` stops tasks.',
      build: '**Build / Movement**\n`.house` builds a house; `.base` builds a hidden base; `.goto x y z`; `.come`; `.follow`; `.store` stores surplus items.',
      kill: '**Combat / Players**\n`.players` lists online players; `.kill <player>` hunts a player. Use only where server rules allow.',
      craft: '**Crafting**\n`.craft <item> [count]` crafts any item with a known Minecraft recipe if ingredients/table are available.\n`.craft list` shows craftable items. `.inventory` shows carried items, armor and offhand.'
    }
    return all[section] || all.main
  }
  async function locateStructure(msg, bot, raw) {
    const aliases = { village: 'village', villages: 'village', mansion: 'mansion', woodland_mansion: 'mansion', monument: 'monument', ocean_monument: 'monument', stronghold: 'stronghold', fortress: 'fortress', nether_fortress: 'fortress', bastion: 'bastion', ancient_city: 'ancient_city', trial_chambers: 'trial_chambers', desert_temple: 'desert_pyramid', temple: 'desert_pyramid', jungle_temple: 'jungle_pyramid', mineshaft: 'mineshaft', mineshafts: 'mineshaft', shipwreck: 'shipwreck', igloo: 'igloo', pillager_outpost: 'pillager_outpost', outpost: 'pillager_outpost', end_city: 'end_city', swamp_hut: 'swamp_hut' }
    const key = raw.toLowerCase().trim().replace(/[ -]+/g, '_')
    const structure = aliases[key] || key
    if (!/^[a-z0-9_]+$/.test(structure)) return msg.reply('Structure name sahi likho. Example: `.find village`')
    const before = state.msgs.length
    await msg.reply(`🔎 ${structure} locate kar raha hoon... Server ko /locate permission chahiye.`)
    bot.chat(`/locate structure minecraft:${structure}`)
    const started = Date.now()
    while (Date.now() - started < 12000) {
      const recent = state.msgs.slice(before).join('\n')
      const match = recent.match(/(?:\[(-?\d+)\s*,\s*~?\s*,\s*(-?\d+)\]|at\s+(-?\d+)\s*,\s*(-?\d+)|(-?\d+)\s+~\s+(-?\d+))/i)
      if (match) {
        const x = match[1] || match[3] || match[5], z = match[2] || match[4] || match[6]
        return msg.reply(`📍 **${structure} found!**\nCoordinates: **X ${x}, Z ${z}**\n[Open map](https://www.google.com/maps/search/?api=1&query=${x},${z})`)
      }
      if (/could not find|unable to locate|not found|unknown structure|incorrect argument/i.test(recent)) return msg.reply(`❌ ${structure} nahi mila ya server ne /locate reject kar diya. OP/permission aur structure ID check karo.`)
      await sleep(500)
    }
    return msg.reply('⌛ Locate ka result nahi mila. Server version /locate output format ya command permission check karo.')
  }
  client.on(Events.MessageCreate, async (msg) => {
    if (msg.author.bot || !msg.guild || !msg.content.startsWith('.')) return
    if (!isOwnerMessage(msg)) return msg.reply('⛔ Is command ke liye permission nahi hai.').catch(() => {})
    const bot = state.bot
    if (!state.ready || !bot?.entity) return msg.reply('⏳ Minecraft bot abhi server mein ready nahi hai.').catch(() => {})
    const [rawCmd, ...args] = msg.content.slice(1).trim().split(/\s+/)
    const cmd = (rawCmd || '').toLowerCase()
    const arg = args.join(' ')
    try {
      if (cmd === 'help') return sendLong(msg, helpText((args[0] || '').toLowerCase()))
      if (cmd === 'msg' || cmd === 'say') {
        if (!arg) return msg.reply('Use `.msg hello` (public) ya `.msg owner hello` (private).')
        const parts = arg.split(/\s+/)
        if (parts[0].toLowerCase() === 'owner') {
          const text = parts.slice(1).join(' ')
          if (!text) return msg.reply('Use `.msg owner <message>`.')
          bot.chat(`/msg ${config.owner} ${text}`)
          return msg.reply(`🔒 Owner **${config.owner}** ko private message bhej diya.`)
        }
        bot.chat(arg)
        return msg.reply('📢 Minecraft public chat mein message bhej diya.')
      }
      if (cmd === 'inventory' || cmd === 'inv') {
        const merged = {}
        for (const it of bot.inventory.items()) merged[it.name] = (merged[it.name] || 0) + it.count
        const rows = Object.entries(merged).sort((a,b)=>a[0].localeCompare(b[0])).map(([n,c])=>`• ${n.replace(/_/g,' ')} ×${c}`)
        const armor = [5,6,7,8].map(i=>bot.inventory.slots[i]).filter(Boolean).map(x=>`${x.name} ×${x.count}`)
        const off = bot.inventory.slots[45]
        const hand = bot.heldItem ? `${bot.heldItem.name} ×${bot.heldItem.count}` : 'empty'
        return sendLong(msg, `🎒 **${bot.username} Inventory**\nSlots used: ${bot.inventory.items().length}\nHand: ${hand}\nArmor: ${armor.join(', ') || 'none'}\nOffhand: ${off ? off.name+' ×'+off.count : 'empty'}\n\n${rows.join('\n') || 'Inventory empty'}`)
      }
      if (cmd === 'craft') {
        if (!args.length) return msg.reply('Use `.craft diamond_pickaxe 1` or `.craft list`.')
        if (args[0].toLowerCase() === 'list') {
          const data = mcd(bot)
          const names = data.itemsArray.filter(it => { try { return bot.recipesFor(it.id, null, 1, null).length > 0 } catch { return false } }).map(it=>it.name)
          return sendLong(msg, `🧰 **Craftable without crafting table nearby**\n${names.join(', ') || 'No recipes available in current inventory/version'}`)
        }
        const name = args[0].toLowerCase().replace(/\s+/g,'_')
        const amount = Math.max(1, Math.min(64, parseInt(args[1] || '1',10) || 1))
        if (!mcd(bot).itemsByName[name]) return msg.reply(`❌ Item \`${name}\` Minecraft version mein nahi mila.`)
        await msg.reply(`🛠️ ${name} ×${amount} craft karne ki koshish...`)
        const ok = await craft(bot, name, amount)
        return msg.reply(ok ? `✅ ${name} craft ho gaya.` : `❌ ${name} craft nahi hua. Ingredients, recipe ya crafting table missing ho sakti hai.`)
      }
      if (cmd === 'find' || cmd === 'locate') return locateStructure(msg, bot, arg || 'village')
      if (cmd === 'mine') return viaMessage(msg, `mine ${args[0] || 'wood'} ${args[1] || 10}`)
      if (cmd === 'grind') { bot.autoResume = true; return viaMessage(msg, 'grind') }
      if (cmd === 'stop') return viaMessage(msg, 'stop')
      if (cmd === 'come' || cmd === 'follow' || cmd === 'house' || cmd === 'base' || cmd === 'armor' || cmd === 'store' || cmd === 'players' || cmd === 'stats' || cmd === 'server' || cmd === 'kill' || cmd === 'give') return viaMessage(msg, `${cmd} ${arg}`.trim())
      if (cmd === 'goto') {
        const xyz = args.slice(0,3).map(Number)
        if (xyz.length !== 3 || xyz.some(n=>!Number.isFinite(n))) return msg.reply('Use `.goto x y z`.')
        const p = new Vec3(...xyz)
        brain.runTask(bot, 'goto', () => nav.near(bot, p, 2, 180000), commands.resume(bot))
        return msg.reply(`🧭 ${hook.xyz(p)} ki taraf ja raha hoon.`)
      }
      return msg.reply('Unknown command. `.help` dekho.')
    } catch (e) {
      log('Discord prefix command error:', e.message)
      return msg.reply(`❌ Error: ${e.message}`).catch(()=>{})
    }
  })
  async function viaMessage(msg, text) {
    const out = []
    const say = t => out.push(String(t))
    commands.command(state.bot, config.owner, text, true, say)
    await sleep(1200)
    return sendLong(msg, out.length ? out.map(t=>'🤖 '+t).join('\n') : '✅ Command accepted / task started.')
  }

  client.on(Events.InteractionCreate, async (i) => {
    try {
      if (i.isAutocomplete()) return await autocomplete(i)
      if (!i.isChatInputCommand()) return
      if (!allowed(i)) return await i.reply({ content: '⛔ Tumhe ye command chalane ki permission nahi hai.', flags: MessageFlags.Ephemeral })
      if (!state.ready || !state.bot || !state.bot.entity) {
        return await i.reply({ content: '⏳ Bot abhi Minecraft server me join nahi hua. Server online hai?', flags: MessageFlags.Ephemeral })
      }
      await i.deferReply()
      await handlers[i.commandName](i, state.bot)
    } catch (e) {
      log('discord cmd error:', e.message)
      try {
        if (i.deferred || i.replied) await i.editReply(`❌ Error: ${e.message}`)
      } catch {}
    }
  })

  client.on('error', (e) => log('discord error:', e.message))
  client.login(d.token).catch((e) => log('Discord login fail:', e.message, '(token sahi hai?)'))
}

module.exports = { start }
