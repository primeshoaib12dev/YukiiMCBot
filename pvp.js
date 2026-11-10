const { goals } = require('mineflayer-pathfinder')
const { sleep } = require('./utils')

const WEAPONS = [
  'netherite_sword', 'diamond_sword', 'iron_sword', 'stone_sword', 'golden_sword', 'wooden_sword',
  'netherite_axe', 'diamond_axe', 'iron_axe', 'stone_axe',
]

async function equipWeapon(bot) {
  for (const n of WEAPONS) {
    const it = bot.inventory.items().find((i) => i.name === n)
    if (it) {
      try {
        await bot.equip(it, 'hand')
      } catch {}
      return true
    }
  }
  return false
}

// Chase and hit `target` until it dies / disappears / time runs out.
// opts.defend = true -> keep fighting even if a normal task was aborted.
async function fight(bot, target, maxMs = 60000, opts = {}) {
  if (bot.fighting) return
  bot.fighting = true
  await equipWeapon(bot)
  bot.pathfinder.setGoal(new goals.GoalFollow(target, 2), true)
  const end = Date.now() + maxMs
  try {
    while ((opts.defend || !bot.abort) && Date.now() < end && target.isValid) {
      const d = bot.entity.position.distanceTo(target.position)
      if (d < 3.3) {
        try {
          await bot.lookAt(target.position.offset(0, target.height * 0.9, 0), true)
          // jump first, hit while falling = critical hit
          if (bot.entity.onGround) {
            bot.setControlState('jump', true)
            await sleep(330)
            bot.setControlState('jump', false)
          }
          bot.attack(target)
        } catch {}
        await sleep(380)
      } else {
        await sleep(120)
      }
    }
    if (!target.isValid) require('./stats').kill(target)
  } finally {
    try {
      bot.pathfinder.setGoal(null)
    } catch {}
    bot.fighting = false
  }
}

const PREY = ['cow', 'pig', 'sheep', 'chicken', 'rabbit']
async function hunt(bot) {
  const e = bot.nearestEntity((x) => PREY.includes(x.name) && x.position.distanceTo(bot.entity.position) < 40)
  if (!e) return false
  await fight(bot, e, 25000)
  await require('./mining').collectDrops(bot)
  return true
}

module.exports = { fight, hunt, equipWeapon }
