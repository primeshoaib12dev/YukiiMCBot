const { Vec3 } = require('vec3')
const nav = require('./nav')
const { digAt, gather } = require('./dig')
const { craft, makePlanks, planks } = require('./crafting')
const { writeSign, stash } = require('./base')
const { sleep, countItem, hasItem, mcd, loadData, saveData, log } = require('./utils')

const H = 3 // wall height; floor at y0, walls y0+1..y0+3, roof y0+4
const REPLACEABLE = /^(air|cave_air|void_air|short_grass|tall_grass|grass|fern|large_fern|snow|dead_bush|vine)$/
const FACES = [[0, -1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0]]
const NOT_GROUND = /leaves|log$/

const need = (s) => 2 * s * s + (4 * s - 4) * H - 2 + 8 // floor+roof+walls-door+furnace

function surfaceY(bot, x, z, fromY) {
  for (let y = fromY + 10; y > fromY - 12; y--) {
    const b = bot.blockAt(new Vec3(x, y, z))
    if (b && b.boundingBox === 'block' && !NOT_GROUND.test(b.name)) return y + 1
  }
  return null
}

// Look around (+-24 blocks) for the flattest s x s patch
function findSite(bot, s) {
  const c = bot.entity.position.floored()
  let best = null
  for (let dx = -24; dx <= 24; dx += 4) {
    for (let dz = -24; dz <= 24; dz += 4) {
      const ox = c.x + dx
      const oz = c.z + dz
      const cy = surfaceY(bot, ox + (s >> 1), oz + (s >> 1), c.y)
      if (cy === null) continue
      let flat = 0
      for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) if (surfaceY(bot, ox + x, oz + z, cy) === cy) flat++
      const score = flat - Math.hypot(dx, dz) * 0.1
      if (!best || score > best.score) best = { ox, oy: cy, oz, score, flat }
    }
  }
  return best
}

// Place `name` at pos, using any solid neighbour as the reference block.
async function placeAt(bot, pos, name, tries = 3) {
  for (let t = 0; t < tries && !bot.abort; t++) {
    const cur = bot.blockAt(pos)
    if (!cur) return false
    if (cur.name === name) return true
    if (!REPLACEABLE.test(cur.name)) {
      try {
        await digAt(bot, pos)
      } catch {
        return false
      }
    }
    let ref = null
    let face = null
    for (const f of FACES) {
      const r = bot.blockAt(pos.offset(f[0], f[1], f[2]))
      if (r && r.boundingBox === 'block') {
        ref = r
        face = new Vec3(-f[0], -f[1], -f[2])
        break
      }
    }
    const item = bot.inventory.items().find((i) => i.name === name)
    if (!ref || !item) return false
    if (bot.entity.position.distanceTo(pos.offset(0.5, 0.5, 0.5)) > 4) {
      try {
        await nav.near(bot, pos, 3, 15000)
      } catch {}
    }
    const me = bot.entity.position.floored()
    if (me.x === pos.x && me.z === pos.z && (me.y === pos.y || me.y === pos.y - 1)) {
      try {
        await nav.near(bot, pos.offset(3, 0, 0), 1, 8000)
      } catch {}
      continue
    }
    try {
      await bot.equip(item, 'hand')
      await bot.placeBlock(ref, face)
      return true
    } catch {
      await sleep(250)
    }
  }
  return false
}

async function prepareItems(bot) {
  await makePlanks(bot)
  if (planks(bot) < 40) {
    const logs = mcd(bot).blocksArray.filter((b) => /_log$/.test(b.name) && !b.name.startsWith('stripped_')).map((b) => b.name)
    await gather(bot, logs, 10)
    await makePlanks(bot)
  }
  const wood = bot.inventory.items().map((i) => i.name).find((n) => /_planks$/.test(n)).replace('_planks', '')
  await craft(bot, 'stick', 8)
  await craft(bot, 'chest', 1)
  await craft(bot, 'furnace', 1)
  await craft(bot, `${wood}_door`, 3)
  await craft(bot, `${wood}_sign`, 3)
  await craft(bot, 'torch', 8)
  if (!hasItem(bot, 'crafting_table')) await craft(bot, 'crafting_table', 1)
  return wood
}

async function buildHouse(bot, say) {
  const cob = () => countItem(bot, (n) => n === 'cobblestone')
  if (cob() < need(7)) {
    say('pehle patthar jama karta hu, ghar ke liye')
    await gather(bot, ['stone'], need(7) - cob())
  }
  if (bot.abort) return
  const s = cob() >= need(7) ? 7 : 5
  if (cob() < need(5)) return say('patthar kam pad gaye, thodi der baad try karunga')

  const wood = await prepareItems(bot)
  const site = findSite(bot, s)
  if (!site) return say('yaha flat jagah nahi mili')
  say(`${s}x${s} ka ghar bana raha hu, dekhte raho`)

  const P = (x, y, z) => new Vec3(site.ox + x, site.oy + y, site.oz + z)
  const door = s >> 1
  bot.moves.canDig = false // don't let pathfinding break our own walls
  try {
    await nav.near(bot, P(door, 0, -3), 2, 40000).catch(() => {})

    // 1. clear the plot (trees, bushes) and fill holes under the floor
    for (let x = 0; x < s; x++)
      for (let z = 0; z < s; z++) {
        for (let y = 0; y <= H + 1; y++) {
          const b = bot.blockAt(P(x, y, z))
          if (b && !REPLACEABLE.test(b.name)) await digAt(bot, P(x, y, z)).catch(() => {})
        }
        const g = bot.blockAt(P(x, -1, z))
        if (g && REPLACEABLE.test(g.name)) await placeAt(bot, P(x, -1, z), 'cobblestone')
      }

    // 2. floor
    for (let x = 0; x < s && !bot.abort; x++) for (let z = 0; z < s; z++) await placeAt(bot, P(x, 0, z), 'cobblestone')

    // 3. walls, layer by layer, with a doorway
    const ring = []
    for (let x = 0; x < s; x++) ring.push([x, 0])
    for (let z = 1; z < s; z++) ring.push([s - 1, z])
    for (let x = s - 2; x >= 0; x--) ring.push([x, s - 1])
    for (let z = s - 2; z >= 1; z--) ring.push([0, z])
    for (let k = 1; k <= H && !bot.abort; k++)
      for (const [x, z] of ring) {
        if (x === door && z === 0 && k <= 2) continue
        await placeAt(bot, P(x, k, z), 'cobblestone')
      }

    // 4. roof, outer ring first so every block touches a neighbour
    const roof = []
    for (let x = 0; x < s; x++) for (let z = 0; z < s; z++) roof.push([x, z, Math.min(x, z, s - 1 - x, s - 1 - z)])
    roof.sort((a, b) => a[2] - b[2])
    for (const [x, z] of roof) {
      if (bot.abort) break
      await placeAt(bot, P(x, H + 1, z), 'cobblestone')
    }

    // 5. door + interior
    await placeAt(bot, P(door, 1, 0), `${wood}_door`)
    await placeAt(bot, P(1, 1, s - 2), 'crafting_table')
    await placeAt(bot, P(2, 1, s - 2), 'furnace')
    await placeAt(bot, P(s - 2, 1, s - 2), 'chest')
    for (const [x, z] of [[1, 1], [s - 2, 1], [1, s - 3], [s - 2, s - 3]]) await placeAt(bot, P(x, 1, z), 'torch')
    const wool = bot.inventory.items().find((i) => /_wool$/.test(i.name) && i.count >= 3)
    if (wool) {
      const bed = wool.name.replace('_wool', '_bed')
      if (await craft(bot, bed, 1)) await placeAt(bot, P(s - 3, 1, 2), bed)
    }
  } finally {
    bot.moves.canDig = true
  }

  const chestBlock = bot.blockAt(P(s - 2, 1, s - 2))
  const data = loadData()
  data.house = { x: site.ox, y: site.oy, z: site.oz, size: s, chest: chestBlock && chestBlock.name === 'chest' ? { x: chestBlock.position.x, y: chestBlock.position.y, z: chestBlock.position.z } : null }
  saveData(data)
  if (chestBlock && chestBlock.name === 'chest') {
    await writeSign(bot, chestBlock, ['Yukiiii', 'Home Sweet', 'Home', 'Do not steal'])
    await stash(bot, say).catch((e) => log('stash fail', e.message))
  }
  say(`ghar ready! x${site.ox} y${site.oy} z${site.oz} pe hai, andar table furnace chest sab hai 🏠`)
}

module.exports = { buildHouse, placeAt }
