const { gather } = require('./dig')
const { craft, makePlanks } = require('./crafting')
const { smelt } = require('./smelt')
const { hunt } = require('./pvp')
const { hasFood } = require('./survival')
const { stash } = require('./base')
const chat = require('./chat')
const { equipArmor, craftArmor } = require('./armor')
const { jump } = require('./jump')
const { sleep, countItem, mcd, loadData, log } = require('./utils')

const has = (bot, re) => bot.inventory.items().some((i) => re.test(i.name))
const n = (bot, name) => countItem(bot, (x) => x === name)
const logNames = (bot) =>
  mcd(bot).blocksArray.filter((b) => /_log$/.test(b.name) && !b.name.startsWith('stripped_')).map((b) => b.name)

const COAL = ['coal_ore', 'deepslate_coal_ore']
const IRON = ['iron_ore', 'deepslate_iron_ore']
const GOLD = ['gold_ore', 'deepslate_gold_ore']
const LAPIS = ['lapis_ore', 'deepslate_lapis_ore']
const REDSTONE = ['redstone_ore', 'deepslate_redstone_ore']
const DIAMOND = ['diamond_ore', 'deepslate_diamond_ore']

// 1. 5 wood -> planks -> crafting table -> wooden pickaxe
async function stageWood(bot) {
  await gather(bot, logNames(bot), 5)
  await makePlanks(bot)
  await craft(bot, 'stick', 4)
  await craft(bot, 'wooden_pickaxe', 1) // places a crafting table if none nearby
}

// 2. 3 stone -> stone pickaxe, then throw the wooden tools away
async function stageStone(bot) {
  await gather(bot, ['stone'], 3)
  await craft(bot, 'stick', 4)
  await craft(bot, 'stone_pickaxe', 1)
  if (has(bot, /^stone_pickaxe$/)) await dropWooden(bot)
}

async function dropWooden(bot) {
  for (const it of bot.inventory.items().filter((i) => /^wooden_/.test(i.name))) {
    try {
      await bot.toss(it.type, null, it.count)
    } catch {}
  }
}

// 3. stone sword + axe
async function stageGear(bot) {
  if (n(bot, 'cobblestone') < 12) await gather(bot, ['stone'], 14)
  await craft(bot, 'stone_sword', 1)
  await craft(bot, 'stone_axe', 1)
}

// 4. coal + iron -> smelt -> iron tools
async function stageIron(bot) {
  if (n(bot, 'coal') < 4) await gather(bot, COAL, 6)
  if (n(bot, 'raw_iron') + n(bot, 'iron_ingot') < 5) await gather(bot, IRON, 6, 16)
  await smelt(bot, 'raw_iron', 'iron_ingot')
  await craft(bot, 'iron_pickaxe', 1)
  await craft(bot, 'iron_sword', 1)
  await craft(bot, 'iron_axe', 1)
}

// 5. full iron armor + shield
async function stageArmor(bot) {
  if (n(bot, 'iron_ingot') + n(bot, 'raw_iron') < 24) await gather(bot, IRON, 14, 16)
  await smelt(bot, 'raw_iron', 'iron_ingot')
  await craftArmor(bot)
}

// 6. diamonds, plus lapis / redstone / gold / coal in rotation
async function stageDiamond(bot) {
  await gather(bot, DIAMOND, 6, -54)
  if (!has(bot, /^diamond_pickaxe$/) && n(bot, 'diamond') >= 3) await craft(bot, 'diamond_pickaxe', 1)
  if (!has(bot, /^diamond_sword$/) && n(bot, 'diamond') >= 5) await craft(bot, 'diamond_sword', 1)
  await extra(bot)
}

async function extra(bot) {
  bot.extraIdx = ((bot.extraIdx || 0) + 1) % 4
  if (bot.extraIdx === 0) await gather(bot, LAPIS, 8, 0)
  else if (bot.extraIdx === 1) await gather(bot, REDSTONE, 8, -50)
  else if (bot.extraIdx === 2) {
    await gather(bot, GOLD, 5, -16)
    await smelt(bot, 'raw_gold', 'gold_ingot')
  } else await gather(bot, COAL, 8)
}

// Run one stage and print what happened, so the console never looks stuck
async function stage(bot, name, fn) {
  log('>> stage:', name)
  await fn(bot)
  const inv = bot.inventory.items().slice(0, 8).map((i) => `${i.name}x${i.count}`).join(' ')
  log('<< stage done:', name, '| inv:', inv || 'khali')
}

// Endless grind. Never chats on its own.
async function grind(bot) {
  let loops = 0
  while (!bot.abort) {
    loops++
    if (bot.food < 10 && !hasFood(bot)) await hunt(bot)
    if (bot.inventory.emptySlotCount() < 4 && (loadData().house || loadData().base)) await stash(bot, (t) => chat.say(bot, t))

    if (!has(bot, /_pickaxe$/)) await stage(bot, 'wood+pickaxe', stageWood)
    else if (!has(bot, /^(stone|iron|diamond|netherite)_pickaxe$/)) await stage(bot, 'stone pickaxe', stageStone)
    else if (!has(bot, /^(stone|iron|diamond|netherite)_sword$/)) await stage(bot, 'stone sword/axe', stageGear)
    else if (!has(bot, /^(iron|diamond|netherite)_pickaxe$/)) await stage(bot, 'coal+iron', stageIron)
    else if (!has(bot, /_chestplate$/) && loops < 40) await stage(bot, 'armor', stageArmor)
    else await stage(bot, 'diamond+extras', stageDiamond)
    await equipArmor(bot)
    if (Math.random() < 0.3) await jump(bot, 2)

    log('grind loop', loops, 'diamonds:', n(bot, 'diamond'), 'iron:', n(bot, 'iron_ingot'))
    await sleep(1500)
  }
}

module.exports = { grind, stageWood }
