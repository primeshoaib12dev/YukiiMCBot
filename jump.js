const { Vec3 } = require('vec3')
const { sleep, rand } = require('./utils')

const SCAFFOLD = ['cobblestone', 'dirt', 'netherrack', 'stone', 'cobbled_deepslate', 'oak_planks', 'spruce_planks', 'birch_planks']

async function hop(bot) {
  bot.setControlState('jump', true)
  await sleep(120)
  bot.setControlState('jump', false)
}

// Normal jumps, human-like gaps
async function jump(bot, times = 3) {
  for (let i = 0; i < times && !bot.abort; i++) {
    await hop(bot)
    await sleep(rand(450, 750))
  }
}

// Bunny-hop forward in the direction the bot is facing
async function bunnyHop(bot, times = 6) {
  bot.setControlState('forward', true)
  bot.setControlState('sprint', true)
  for (let i = 0; i < times && !bot.abort; i++) {
    await hop(bot)
    await sleep(380)
  }
  bot.setControlState('forward', false)
  bot.setControlState('sprint', false)
}

// Spin, crouch and jump
async function dance(bot) {
  let yaw = bot.entity.yaw
  for (let i = 0; i < 14 && !bot.abort; i++) {
    yaw += 0.9
    await bot.look(yaw, rand(-0.3, 0.3), true)
    bot.setControlState('sneak', i % 2 === 0)
    if (i % 3 === 0) await hop(bot)
    await sleep(220)
  }
  bot.setControlState('sneak', false)
}

// Tower straight up: jump and place a block underneath, repeat
async function pillar(bot, height = 5) {
  let placed = 0
  for (let i = 0; i < height && !bot.abort; i++) {
    const item = SCAFFOLD.map((n) => bot.inventory.items().find((x) => x.name === n)).find(Boolean)
    if (!item) return placed
    await bot.equip(item, 'hand')
    await bot.look(bot.entity.yaw, -Math.PI / 2, true)
    const base = bot.entity.position.floored()
    const ref = bot.blockAt(base.offset(0, -1, 0))
    bot.setControlState('jump', true)
    const t0 = Date.now()
    while (bot.entity.position.y < base.y + 1.1 && Date.now() - t0 < 1200) await sleep(30)
    try {
      await bot.placeBlock(ref, new Vec3(0, 1, 0))
      placed++
    } catch {}
    bot.setControlState('jump', false)
    await sleep(300)
  }
  return placed
}

module.exports = { jump, bunnyHop, dance, pillar, hop }
