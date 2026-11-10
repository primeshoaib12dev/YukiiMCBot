const { Vec3 } = require('vec3')
const nav = require('./nav')
const { equipTool, isDanger, mine } = require('./mining')
const { pick, sleep, log } = require('./utils')

const DIRS = [new Vec3(1, 0, 0), new Vec3(-1, 0, 0), new Vec3(0, 0, 1), new Vec3(0, 0, -1)]

async function digAt(bot, pos) {
  for (let k = 0; k < 3; k++) {
    const b = bot.blockAt(pos)
    if (!b || /air$/.test(b.name) || !b.diggable) return
    if (b.name.includes('lava')) throw new Error('lava')
    if (isDanger(bot, b)) throw new Error('lava near')
    if (bot.entity.position.distanceTo(b.position.offset(0.5, 0.5, 0.5)) > 4.5) await nav.near(bot, b.position, 3, 10000)
    await equipTool(bot, b)
    await bot.dig(b)
  }
}

// Dig a 3-high staircase going down in direction `dir`. Returns final feet position.
async function digStairs(bot, dir, steps) {
  let p = bot.entity.position.floored()
  for (let i = 0; i < steps && !bot.abort; i++) {
    const f = p.offset(dir.x, 0, dir.z)
    await digAt(bot, f.offset(0, 1, 0))
    await digAt(bot, f)
    await digAt(bot, f.offset(0, -1, 0))
    const n = f.offset(0, -1, 0)
    const floor = bot.blockAt(n.offset(0, -1, 0))
    if (floor && floor.name.includes('lava')) throw new Error('lava below')
    await nav.block(bot, n, 10000)
    p = n
  }
  return p
}

// Straight 1x2 tunnel
async function tunnel(bot, dir, len) {
  let p = bot.entity.position.floored()
  for (let i = 0; i < len && !bot.abort; i++) {
    const f = p.offset(dir.x, 0, dir.z)
    await digAt(bot, f.offset(0, 1, 0))
    await digAt(bot, f)
    const floor = bot.blockAt(f.offset(0, -1, 0))
    if (!floor || /air$|lava|water/.test(floor.name)) throw new Error('hole ahead')
    await nav.block(bot, f, 10000)
    p = f
  }
}

// Find ore; if none loaded, go down to targetY (if given) and tunnel around, then retry.
async function gather(bot, names, amount, targetY) {
  let got = 0
  for (let tries = 0; got < amount && !bot.abort && tries < 10; tries++) {
    got += await mine(bot, names, amount - got)
    log(`gather ${names[0]}: ${got}/${amount} (try ${tries + 1})`)
    if (got >= amount || bot.abort) break
    try {
      const dir = pick(DIRS)
      if (targetY !== undefined && bot.entity.position.y > targetY + 1) {
        await digStairs(bot, dir, Math.min(12, Math.floor(bot.entity.position.y - targetY)))
      } else if (targetY !== undefined) {
        await tunnel(bot, dir, 20)
      } else {
        const p = bot.entity.position
        log('explore: nayi jagah dhoondh raha hu')
        await nav.nearXZ(bot, p.x + dir.x * 40, p.z + dir.z * 40, 4, 40000)
      }
    } catch (e) {
      log('explore fail:', e.message)
      await sleep(500)
    }
  }
  return got
}

module.exports = { digAt, digStairs, tunnel, gather, DIRS }
