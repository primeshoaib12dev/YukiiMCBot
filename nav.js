const { Movements, goals } = require('mineflayer-pathfinder')

function setupMovements(bot) {
  const m = new Movements(bot)
  m.canDig = true
  m.allowSprinting = true
  m.allowParkour = true
  m.allowFreeMotion = false
  bot.moves = m
  bot.pathfinder.setMovements(m)
}

// goto with a hard timeout so the bot never gets stuck forever
async function goto(bot, goal, timeout = 30000) {
  let timer
  const t = new Promise((_, rej) => {
    timer = setTimeout(() => {
      try {
        bot.pathfinder.stop()
      } catch {}
      rej(new Error('nav timeout'))
    }, timeout)
  })
  try {
    await Promise.race([bot.pathfinder.goto(goal), t])
  } finally {
    clearTimeout(timer)
  }
}

const near = (bot, p, r = 2, t) => goto(bot, new goals.GoalNear(p.x, p.y, p.z, r), t)
const block = (bot, p, t) => goto(bot, new goals.GoalBlock(p.x, p.y, p.z), t)
// ignore height: good for walking far across the surface
const nearXZ = (bot, x, z, r = 3, t) => goto(bot, new goals.GoalNearXZ(x, z, r), t)
const toBlock = (bot, p, t) => goto(bot, new goals.GoalGetToBlock(p.x, p.y, p.z), t)

module.exports = { setupMovements, goto, near, nearXZ, block, toBlock }
