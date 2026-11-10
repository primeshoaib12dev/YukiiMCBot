const { buildBase, stash } = require('./base')
const hook = require('./hook')
const { loadData } = require('./utils')

// Hidden underground chest: build the base if it doesn't exist, dump items, send coordinates to the webhook.
// mode 'surplus' keeps diamonds/iron/tools; mode 'all' stores everything except tools, armor and food.
async function storeAll(bot, say, mode = 'surplus') {
  if (!loadData().base) await buildBase(bot, say)
  if (bot.abort) return null
  const dep = await stash(bot, say, false, mode, 'base')
  const b = loadData().base
  if (!b || !b.chest) {
    await hook.text('❌ Chest nahi ban paya, store nahi hua')
    return null
  }
  const list =
    Object.entries(dep || {})
      .sort((x, y) => y[1] - x[1])
      .map(([k, v]) => `${k} ×${v}`)
      .join('\n') || 'kuch store nahi hua'
  await hook.embed(
    '📦 Saman chest me store ho gaya',
    [
      { name: 'Chest coordinates', value: `X ${b.chest.x}  Y ${b.chest.y}  Z ${b.chest.z}` },
      { name: 'Dimension', value: bot.game.dimension, inline: true },
      { name: 'Stored', value: list },
    ],
    0x57f287
  )
  return { chest: b.chest, dep: dep || {} }
}

module.exports = { storeAll }
