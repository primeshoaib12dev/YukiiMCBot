const { Vec3 } = require('vec3')
const nav = require('./nav')
const { digStairs, digAt, DIRS } = require('./dig')
const { craft, makePlanks, planks } = require('./crafting')
const { sleep, pick, countItem, loadData, saveData, log } = require('./utils')

const STASH = /^(cobblestone|stone|dirt|gravel|sand|andesite|diorite|granite|deepslate|cobbled_deepslate|tuff|coal|flint|raw_.*|.*_log|.*_planks|rotten_flesh|bone|string|spider_eye|gunpowder)$/

// Dig an underground house: 5x5x3 room at the bottom of a staircase, chest + sign.
async function buildBase(bot, say) {
  say('zameen ke andar ghar bana raha hu, 2 min')
  await makePlanks(bot)
  if (planks(bot) < 16) {
    const { gather } = require('./dig')
    const { mcd } = require('./utils')
    const logs = mcd(bot).blocksArray.filter((b) => /_log$/.test(b.name) && !b.name.startsWith('stripped_')).map((b) => b.name)
    await gather(bot, logs, 4)
    await makePlanks(bot)
  }
  await craft(bot, 'chest', 1)
  await craft(bot, 'stick', 4)
  const signName = bot.inventory.items().map((i) => i.name).find((n) => /_planks$/.test(n))?.replace('_planks', '_sign')
  if (signName) await craft(bot, signName, 3)
  await craft(bot, 'torch', 4)

  const dir = pick(DIRS)
  const side = new Vec3(dir.z, 0, dir.x)
  await digStairs(bot, dir, 8)
  const o = bot.entity.position.floored()
  const at = (i, j, k) => o.offset(dir.x * i + side.x * j, k, dir.z * i + side.z * j)

  for (let i = 1; i <= 5 && !bot.abort; i++)
    for (let j = -2; j <= 2; j++) for (let k = 0; k <= 2; k++) await digAt(bot, at(i, j, k))
  await nav.block(bot, at(3, 0, 0), 15000)

  // chest on the back wall, sign above it
  const floor = bot.blockAt(at(5, 0, -1))
  const chestItem = bot.inventory.items().find((i) => i.name === 'chest')
  let chestBlock = null
  if (floor && chestItem) {
    await bot.equip(chestItem, 'hand')
    await bot.placeBlock(floor, new Vec3(0, 1, 0))
    await sleep(400)
    chestBlock = bot.blockAt(at(5, 0, 0))
  }
  // torches on floor corners
  const torch = bot.inventory.items().find((i) => i.name === 'torch')
  if (torch) {
    for (const [i, j] of [[1, -2], [1, 2], [5, -2], [5, 2]]) {
      const f = bot.blockAt(at(i, j, -1))
      const t = bot.inventory.items().find((x) => x.name === 'torch')
      if (f && t && f.boundingBox === 'block') {
        try {
          await bot.equip(t, 'hand')
          await bot.placeBlock(f, new Vec3(0, 1, 0))
        } catch {}
      }
    }
  }

  const data = loadData()
  data.base = { x: o.x, y: o.y, z: o.z, chest: chestBlock ? { x: chestBlock.position.x, y: chestBlock.position.y, z: chestBlock.position.z } : null }
  saveData(data)
  await stash(bot, say, true)
  say('ghar ready hai, andar chest aur sign bhi laga diya 😎')
}

async function writeSign(bot, chestBlock, lines) {
  const signItem = bot.inventory.items().find((i) => /_sign$/.test(i.name) && !/hanging/.test(i.name))
  if (!signItem) return
  const p = chestBlock.position
  // find a solid wall next to the chest column to mount the sign on
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const wall = bot.blockAt(p.offset(dx, 1, dz))
    const cell = bot.blockAt(p.offset(0, 1, 0))
    if (wall && wall.boundingBox === 'block' && cell && /air$/.test(cell.name)) {
      try {
        await bot.equip(signItem, 'hand')
        await bot.placeBlock(wall, new Vec3(-dx, 0, -dz))
        await sleep(600)
        const sb = bot.blockAt(p.offset(0, 1, 0))
        if (sb && /sign/.test(sb.name)) {
          bot.updateSign(sb, lines.join('\n'))
          return
        }
      } catch (e) {
        log('sign fail', e.message)
      }
    }
  }
}

// Go to base chest and store surplus (diamonds/iron/tools/food stay with the bot)
// mode 'all' stores everything except these
const KEEP = /(_pickaxe|_sword|_axe|_shovel|_hoe|_helmet|_chestplate|_leggings|_boots)$|^(shield|torch|bread|apple|carrot|baked_potato|golden_carrot|crafting_table|furnace|chest)$|^cooked_/

// Returns { itemName: count } of what was stored, or false if the chest wasn't reachable.
// which = 'base' | 'house' picks that chest, otherwise house first, then base.
async function stash(bot, say, withSign = false, mode = 'surplus', which = null) {
  const d = loadData()
  const base = (which && d[which]) || d.house || d.base
  if (!base || !base.chest) return false
  const cpos = new Vec3(base.chest.x, base.chest.y, base.chest.z)
  await nav.near(bot, cpos, 3, 90000)
  const chest = bot.blockAt(cpos)
  if (!chest || chest.name !== 'chest') return false
  const dep = {}
  const c = await bot.openContainer(chest)
  try {
    const pick = mode === 'all' ? (i) => !KEEP.test(i.name) : (i) => STASH.test(i.name)
    for (const it of bot.inventory.items().filter(pick)) {
      try {
        await c.deposit(it.type, null, it.count)
        dep[it.name] = (dep[it.name] || 0) + it.count
      } catch {
        break // chest full
      }
    }
    if (withSign) {
      const n = (re) => c.containerItems().filter((i) => re.test(i.name)).reduce((s, i) => s + i.count, 0)
      var lines = ['Yukiiii', 'Private Base', `Stone x${n(/stone/)}`, `Coal x${n(/^coal$/)}`]
    }
  } finally {
    c.close()
  }
  if (withSign) await writeSign(bot, chest, lines)
  return dep
}

module.exports = { buildBase, stash, writeSign }
