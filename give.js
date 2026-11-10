const nav = require('./nav')
const { sleep } = require('./utils')

const FOOD = /^(cooked_|bread|apple|carrot|baked_potato|golden_carrot|beef|porkchop|mutton)/
const ALIASES = {
  diamond: /^diamond$/,
  iron: /^(iron_ingot|raw_iron|iron_block)$/,
  gold: /^(gold_ingot|raw_gold|gold_block)$/,
  coal: /^(coal|charcoal)$/,
  stone: /^(stone|cobblestone)$/,
  cobblestone: /^cobblestone$/,
  dirt: /^dirt$/,
  wood: /_log$/,
  log: /_log$/,
  plank: /_planks$/,
  food: FOOD,
  emerald: /^emerald$/,
  redstone: /^redstone$/,
  lapis: /^lapis_lazuli$/,
  netherite: /^(netherite_|ancient_debris)/,
  sab: /.*/,
  all: /.*/,
  everything: /.*/,
}

function matcher(word) {
  let w = word.trim().toLowerCase().replace(/\s+/g, '_')
  if (!ALIASES[w] && w.endsWith('s')) w = w.slice(0, -1)
  if (ALIASES[w]) return (n) => ALIASES[w].test(n)
  return (n) => n === w || n.includes(w)
}

// Walk to player and drop everything that matches. Returns number of items dropped (-1 = player not visible)
async function giveTo(bot, username, test, say) {
  const items = bot.inventory.items().filter((i) => test(i.name))
  if (!items.length) return 0
  const p = bot.players[username]
  const ent = p && p.entity
  if (!ent) {
    say('tu mujhe dikh nahi raha, paas aa na')
    return -1
  }
  await nav.near(bot, ent.position, 2, 40000)
  try {
    await bot.lookAt(ent.position.offset(0, 1.6, 0))
  } catch {}
  let total = 0
  for (const it of items) {
    await bot.toss(it.type, null, it.count)
    total += it.count
    await sleep(350)
  }
  // step away so we don't pick the items back up
  try {
    await nav.near(bot, bot.entity.position.offset(6, 0, 6), 3, 8000)
  } catch {}
  return total
}

module.exports = { giveTo, matcher, ALIASES }
