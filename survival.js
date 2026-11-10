const { fight } = require('./pvp')
const { log } = require('./utils')

const FOODS = [
  'golden_carrot', 'cooked_beef', 'cooked_porkchop', 'cooked_mutton', 'cooked_salmon', 'cooked_cod',
  'cooked_chicken', 'cooked_rabbit', 'baked_potato', 'bread', 'apple', 'carrot', 'beef', 'porkchop', 'mutton',
]

const hasFood = (bot) => bot.inventory.items().some((i) => FOODS.includes(i.name))

async function eat(bot) {
  const food = FOODS.map((n) => bot.inventory.items().find((i) => i.name === n)).find(Boolean)
  if (!food || bot.eating) return
  bot.eating = true
  try {
    await bot.equip(food, 'hand')
    await bot.consume()
  } catch {}
  bot.eating = false
}

function start(bot) {
  bot.survivalTimer = setInterval(async () => {
    try {
      if (!bot.entity || bot.fighting) return
      if (bot.food < 14) await eat(bot)
      // auto-defend against nearby hostile mobs
      const mob = bot.nearestEntity(
        (e) => e.type === 'hostile' && e.name !== 'enderman' && e.position.distanceTo(bot.entity.position) < 4
      )
      if (mob) {
        log('defending vs', mob.name)
        await fight(bot, mob, 15000, { defend: true })
      }
    } catch (e) {
      log('survival err', e.message)
    }
  }, 1000)
}

const stop = (bot) => clearInterval(bot.survivalTimer)

module.exports = { start, stop, hasFood, eat }
