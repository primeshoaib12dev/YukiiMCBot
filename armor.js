const { craft } = require('./crafting')
const { log } = require('./utils')

const TIERS = ['netherite', 'diamond', 'iron', 'golden', 'chainmail', 'leather']
const SLOTS = { helmet: 'head', chestplate: 'torso', leggings: 'legs', boots: 'feet' }
const tierOf = (name) => TIERS.findIndex((t) => name.startsWith(t))

function worn(bot, dest) {
  return bot.inventory.slots[bot.getEquipmentDestSlot(dest)]
}

// Wear the best armor (and shield) found in the inventory
async function equipArmor(bot) {
  for (const [piece, dest] of Object.entries(SLOTS)) {
    const best = bot.inventory
      .items()
      .filter((i) => i.name.endsWith('_' + piece))
      .sort((a, b) => tierOf(a.name) - tierOf(b.name))[0]
    if (!best) continue
    const cur = worn(bot, dest)
    if (!cur || tierOf(best.name) < tierOf(cur.name)) {
      try {
        await bot.equip(best, dest)
      } catch (e) {
        log('armor equip fail', e.message)
      }
    }
  }
  const shield = bot.inventory.items().find((i) => i.name === 'shield')
  if (shield && !worn(bot, 'off-hand')) {
    try {
      await bot.equip(shield, 'off-hand')
    } catch {}
  }
}

// Craft whichever pieces the current materials allow (iron first, then diamond)
async function craftArmor(bot) {
  for (const tier of ['diamond', 'iron']) {
    for (const piece of Object.keys(SLOTS)) {
      const name = `${tier}_${piece}`
      const have = bot.inventory.items().some((i) => i.name === name)
      const cur = worn(bot, SLOTS[piece])
      if (have || (cur && cur.name === name)) continue
      if (cur && tierOf(cur.name) <= TIERS.indexOf(tier)) continue
      await craft(bot, name, 1)
    }
  }
  await craft(bot, 'shield', 1)
  await equipArmor(bot)
}

module.exports = { equipArmor, craftArmor }
