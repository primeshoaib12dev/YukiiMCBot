const fs = require('fs')
const path = require('path')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rand = (a, b) => a + Math.random() * (b - a)
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)]
const stats = require('./stats')
const log = (...a) => {
  console.log(`[${new Date().toLocaleTimeString()}]`, ...a)
  stats.act(a.join(' '))
}

const countItem = (bot, test) =>
  bot.inventory
    .items()
    .filter((i) => test(i.name))
    .reduce((s, i) => s + i.count, 0)

const hasItem = (bot, name) => countItem(bot, (n) => n === name) > 0
const mcd = (bot) => require('minecraft-data')(bot.version)

const DATA = path.join(__dirname, 'data.json')
function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA, 'utf8'))
  } catch {
    return {}
  }
}
function saveData(d) {
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2))
}

module.exports = { sleep, rand, pick, log, countItem, hasItem, mcd, loadData, saveData }
