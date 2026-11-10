// Discord webhook: coordinates, deaths, joins, store reports
const config = require('./config')

async function send(payload) {
  const url = config.webhook
  if (!url || !/^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(url)) return false
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: config.username, ...payload }),
    })
    return r.ok
  } catch (e) {
    console.log('webhook error:', e.message)
    return false
  }
}

const text = (content) => send({ content: String(content).slice(0, 1900) })

const embed = (title, fields = [], color = 0x5865f2, description) =>
  send({
    embeds: [
      {
        title,
        description,
        color,
        fields: fields.map((f) => ({ name: f.name, value: String(f.value).slice(0, 1000) || '-', inline: !!f.inline })),
        timestamp: new Date().toISOString(),
      },
    ],
  })

const xyz = (p) => `X ${Math.floor(p.x)}  Y ${Math.floor(p.y)}  Z ${Math.floor(p.z)}`

module.exports = { send, text, embed, xyz }
