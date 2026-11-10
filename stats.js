// What the bot has done since it started (used by /stats on Discord)
const s = { start: Date.now(), mined: {}, crafted: {}, kills: {}, deaths: 0, acts: [] }

function act(text) {
  const t = new Date().toLocaleTimeString('en-GB', { hour12: false })
  s.acts.push(`${t} ${text}`.slice(0, 160))
  if (s.acts.length > 40) s.acts.shift()
}
const mined = (name) => {
  s.mined[name] = (s.mined[name] || 0) + 1
}
const craft = (name, n = 1) => {
  s.crafted[name] = (s.crafted[name] || 0) + n
}
const kill = (target) => {
  const name = target.username || target.name || 'mob'
  s.kills[name] = (s.kills[name] || 0) + 1
}
const death = () => {
  s.deaths++
}

module.exports = { s, act, mined, craft, kill, death }
