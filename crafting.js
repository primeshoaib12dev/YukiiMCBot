const { Vec3 } = require('vec3')
const nav = require('./nav')
const { mcd, hasItem, countItem, log } = require('./utils')

// Place `itemName` on a free spot around the bot. Returns the placed block or null.
async function placeNear(bot, itemName) {
  const item = bot.inventory.items().find((i) => i.name === itemName)
  if (!item) return null
  await bot.equip(item, 'hand')
  const base = bot.entity.position.floored()
  const offs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [-1, -1],
    [1, -1],
    [-1, 1],
  ]
  for (const [dx, dz] of offs) {
    const ground = bot.blockAt(base.offset(dx, -1, dz))
    const above = bot.blockAt(base.offset(dx, 0, dz))
    if (ground && ground.boundingBox === 'block' && above && /air$/.test(above.name)) {
      try {
        await bot.placeBlock(ground, new Vec3(0, 1, 0))
        return bot.blockAt(base.offset(dx, 0, dz))
      } catch {}
    }
  }
  return null
}

function findNear(bot, name, dist = 32) {
  const id = mcd(bot).blocksByName[name].id
  return bot.findBlock({ matching: id, maxDistance: dist })
}

async function getTable(bot) {
  const t = findNear(bot, 'crafting_table')
  if (t) return t
  if (!hasItem(bot, 'crafting_table') && !(await craft(bot, 'crafting_table', 1))) return null
  return placeNear(bot, 'crafting_table')
}

async function craft(bot, name, amount = 1) {
  const item = mcd(bot).itemsByName[name]
  if (!item) return false
  let recipe = bot.recipesFor(item.id, null, 1, null)[0]
  let table = null
  if (!recipe) {
    table = await getTable(bot)
    if (!table) return false
    try {
      await nav.near(bot, table.position, 3, 15000)
    } catch {}
    recipe = bot.recipesFor(item.id, null, 1, table)[0]
    if (!recipe) return false
  }
  const times = Math.ceil(amount / recipe.result.count)
  try {
    await bot.craft(recipe, times, table)
    require('./stats').craft(name, times * recipe.result.count)
    return true
  } catch (e) {
    log('craft fail', name, e.message)
    return false
  }
}

// logs -> planks
async function makePlanks(bot) {
  for (const it of bot.inventory.items().filter((i) => /_log$/.test(i.name))) {
    await craft(bot, it.name.replace('_log', '_planks'), it.count * 4)
  }
}

const planks = (bot) => countItem(bot, (n) => /_planks$/.test(n))

module.exports = { craft, placeNear, getTable, makePlanks, planks, findNear }
