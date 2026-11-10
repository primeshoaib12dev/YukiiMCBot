const nav = require('./nav')
const { sleep, countItem, hasItem, log } = require('./utils')
const { craft, placeNear, findNear } = require('./crafting')

const FUELS = ['coal', 'charcoal', 'oak_planks', 'spruce_planks', 'birch_planks', 'jungle_planks', 'acacia_planks', 'dark_oak_planks']

// Smelt all `input` items (e.g. raw_iron) into output. Returns true if something came out.
async function smelt(bot, input, output) {
  const have = countItem(bot, (n) => n === input)
  if (!have) return false
  let furnace = findNear(bot, 'furnace')
  if (!furnace) {
    if (!hasItem(bot, 'furnace') && !(await craft(bot, 'furnace', 1))) return false
    furnace = await placeNear(bot, 'furnace')
    if (!furnace) return false
  }
  await nav.near(bot, furnace.position, 3, 15000)
  const f = await bot.openFurnace(furnace)
  try {
    const fuel = FUELS.map((n) => bot.inventory.items().find((i) => i.name === n)).find(Boolean)
    if (!fuel) return false
    await f.putFuel(fuel.type, null, Math.min(fuel.count, Math.ceil(have / 8) + 1))
    const inp = bot.inventory.items().find((i) => i.name === input)
    await f.putInput(inp.type, null, inp.count)
    const deadline = Date.now() + have * 11000 + 15000
    while (Date.now() < deadline && !bot.abort) {
      await sleep(2000)
      if (f.outputItem()) await f.takeOutput()
      if (countItem(bot, (n) => n === output) >= have) break
    }
    if (f.outputItem()) await f.takeOutput()
  } catch (e) {
    log('smelt error', e.message)
  } finally {
    f.close()
  }
  return countItem(bot, (n) => n === output) > 0
}

module.exports = { smelt }
