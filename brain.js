const { log } = require('./utils')

let seq = 0

function init(bot) {
  bot.abort = false
  bot.task = Promise.resolve()
  bot.taskName = 'idle'
  bot.taskId = 0
  bot.autoResume = true
}

function stopAll(bot) {
  bot.abort = true
  try {
    bot.pathfinder.stop()
    bot.clearControlStates()
  } catch {}
}

// Only one task at a time. A new task aborts the old one.
// onDone runs only if this task was not replaced/aborted.
async function runTask(bot, name, fn, onDone) {
  const id = ++seq
  bot.taskId = id
  stopAll(bot)
  await bot.task
  if (bot.taskId !== id) return
  bot.abort = false
  bot.taskName = name
  log('task ->', name)
  bot.task = (async () => {
    try {
      await fn()
    } catch (e) {
      log('task error', name, e.message)
    }
    if (bot.taskId === id) {
      bot.taskName = 'idle'
      if (onDone && !bot.abort) onDone()
    }
  })()
}

module.exports = { init, stopAll, runTask }
