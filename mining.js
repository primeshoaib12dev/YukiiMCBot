const { sleep, mcd, log } = require('./utils')
const nav = require('./nav')

const MATS = ['netherite', 'diamond', 'iron', 'stone', 'golden', 'wooden']

function toolType(name) {
  if (/_log$|_planks$|_wood$|chest|crafting_table|bookshelf/.test(name)) return 'axe'
  if (/^(dirt|grass_block|sand|red_sand|gravel|clay|soul_sand|snow|mud|podzol|coarse_dirt)/.test(name)) return 'shovel'
  return 'pickaxe'
}

async function equipTool(bot, block) {
  const type = toolType(block.name)
  const tools = bot.inventory
    .items()
    .filter((i) => i.name.endsWith('_' + type))
    .sort((a, b) => MATS.findIndex((m) => a.name.startsWith(m)) - MATS.findIndex((m) => b.name.startsWith(m)))
  if (tools[0]) {
    try {
      await bot.equip(tools[0], 'hand')
    } catch {}
  }
}

const SIDES = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
]
function isDanger(bot, block) {
  return SIDES.some(([x, y, z]) => {
    const b = bot.blockAt(block.position.offset(x, y, z))
    return b && b.name.includes('lava')
  })
}

async function collectDrops(bot) {
  await sleep(300)
  for (let i = 0; i < 6 && !bot.abort; i++) {
    const e = Object.values(bot.entities)
      .filter((x) => x.name && x.name.toLowerCase() === 'item' && x.position.distanceTo(bot.entity.position) < 8)
      .sort((a, b) => a.position.distanceTo(bot.entity.position) - b.position.distanceTo(bot.entity.position))[0]
    if (!e) return
    try {
      await nav.near(bot, e.position, 1, 6000)
    } catch {}
  }
}

// Mine `amount` blocks whose name is in `names`. Returns how many were mined.
async function mine(bot, names, amount, opts = {}) {
  const d = mcd(bot)
  const ids = new Set(names.map((n) => d.blocksByName[n] && d.blocksByName[n].id).filter((x) => x !== undefined))
  if (!ids.size) return 0
  const deadline = Date.now() + (opts.timeout || 180000)
  const bad = new Set()
  let got = 0
  const key = (p) => `${p.x},${p.y},${p.z}`
  const idList = [...ids]
  while (got < amount && Date.now() < deadline && !bot.abort) {
    const pos = bot
      .findBlocks({ matching: idList, maxDistance: opts.maxDist || 64, count: 40 })
      .find((p) => !bad.has(key(p)))
    if (!pos) {
      log(`mine: ${names[0]} aas-paas nahi mila (${got}/${amount})`)
      break
    }
    const b = bot.blockAt(pos)
    if (!b) {
      bad.add(key(pos))
      continue
    }
    try {
      if (isDanger(bot, b)) {
        bad.add(key(pos))
        continue
      }
      await nav.toBlock(bot, b.position, 25000)
      await equipTool(bot, b)
      await bot.dig(b)
      got++
      if (got % 3 === 0 || got === amount) log(`mine: ${b.name} ${got}/${amount}`)
      await collectDrops(bot)
    } catch (e) {
      log(`mine fail: ${names[0]} @${key(pos)}: ${e.message}`)
      bad.add(key(pos))
      await sleep(200)
    }
  }
  return got
}

module.exports = { mine, equipTool, isDanger, collectDrops, toolType }
