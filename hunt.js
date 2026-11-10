const nav = require('./nav')
const track = require('./track')
const { fight } = require('./pvp')
const { sleep, log } = require('./utils')

const angDiff = (a, b) => ((((a - b) % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI)) - Math.PI
// azimuth -> (dx, dz) under 3 possible conventions; we switch if the bearing drifts while walking
const dirFor = (az, c) => [
  [-Math.sin(az), Math.cos(az)],
  [-Math.sin(az), -Math.cos(az)],
  [Math.cos(az), Math.sin(az)],
][c]

// Find a player however far away and kill him.
// 1) already visible -> fight   2) /tp to him (needs the bot to be OP)   3) follow the locator bar
async function huntPlayer(bot, name, say) {
  const get = () => bot.players[name] && bot.players[name].entity
  let ent = get()

  if (!ent) {
    say(`${name} door hai, /tp try karta hu (bot OP ho to turant pahunch jayega)`)
    bot.chat(`/tp ${bot.username} ${name}`)
    await sleep(3000)
    ent = get()
  }

  let conv = 0
  let lastAz = null
  const end = Date.now() + 5 * 60000
  while (!ent && !bot.abort && Date.now() < end) {
    const w = track.get(bot, name)
    if (!w) {
      say(`locator bar se ${name} ka signal nahi mila. Bot ko OP do (/op ${bot.username}) to /tp chalega`)
      break
    }
    try {
      if (w.x !== undefined) {
        log('hunt: coords', Math.round(w.x), Math.round(w.z))
        await nav.nearXZ(bot, w.x, w.z, 8, 90000)
      } else {
        if (lastAz !== null && Math.abs(angDiff(w.azimuth, lastAz)) > 0.06) conv = (conv + 1) % 3
        lastAz = w.azimuth
        const d = dirFor(w.azimuth, conv)
        const p = bot.entity.position
        log('hunt: direction', w.azimuth.toFixed(2), 'conv', conv)
        await nav.nearXZ(bot, p.x + d[0] * 100, p.z + d[1] * 100, 6, 90000)
      }
    } catch (e) {
      await sleep(500)
    }
    ent = get()
  }

  if (!ent) {
    say(`${name} tak pahunch nahi paya`)
    return false
  }
  say(`${name} mil gaya, maar raha hu`)
  await fight(bot, ent, 120000)
  return true
}

module.exports = { huntPlayer }
