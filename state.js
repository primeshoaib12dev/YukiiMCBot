// Shared handle so the Discord side always talks to the current Minecraft bot
// (bot.js creates a new bot object on every reconnect)
module.exports = { bot: null, ready: false, authed: false, spawnedAt: 0, msgs: [] }
