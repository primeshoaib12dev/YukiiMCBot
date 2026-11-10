// Locator bar (1.21.6+): the server sends "waypoint" packets for every player, even when they are far away.
// We store what we can parse: exact position, chunk position or just a direction (azimuth).
const { log } = require('./utils')

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const num = (v) => typeof v === 'number'

function findKey(o, key, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return undefined
  if (key in o && num(o[key])) return o[key]
  for (const v of Object.values(o)) {
    const r = findKey(v, key, depth + 1)
    if (r !== undefined) return r
  }
  return undefined
}

function findObj(o, pred, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 6) return undefined
  if (!Array.isArray(o) && pred(o)) return o
  for (const v of Object.values(o)) {
    const r = findObj(v, pred, depth + 1)
    if (r) return r
  }
  return undefined
}

function attach(bot) {
  bot.waypoints = {}
  let shown = 0
  bot._client.on('packet', (data, meta) => {
    if (!meta || !/waypoint/i.test(meta.name)) return
    try {
      const j = JSON.stringify(data, (k, v) => (typeof v === 'bigint' ? v.toString() : v))
      if (shown++ < 3) log('waypoint packet', meta.name, j.slice(0, 240))
      const uuid = ((j.match(UUID) || [])[0] || '').toLowerCase()
      if (!uuid) return
      if (data.operation === 'untrack' || data.operation === 1) {
        delete bot.waypoints[uuid]
        return
      }
      const v3 = findObj(data, (o) => num(o.x) && num(o.y) && num(o.z))
      const ch = findObj(data, (o) => num(o.x) && num(o.z) && !('y' in o))
      const az = findKey(data, 'azimuth')
      if (v3) bot.waypoints[uuid] = { x: v3.x, y: v3.y, z: v3.z }
      else if (ch) bot.waypoints[uuid] = { x: ch.x * 16 + 8, z: ch.z * 16 + 8 }
      else if (az !== undefined) bot.waypoints[uuid] = { azimuth: az }
    } catch {}
  })
}

// Latest known locator-bar info for a player name, or null
function get(bot, name) {
  const p = bot.players[name]
  if (!p || !p.uuid || !bot.waypoints) return null
  return bot.waypoints[String(p.uuid).toLowerCase()] || null
}

module.exports = { attach, get }
