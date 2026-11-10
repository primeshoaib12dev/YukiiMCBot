require('dotenv').config()

module.exports = {
  host: 'backbenchers1.aternos.me',
  port: 25762,
  username: 'Yukiiii',
  version: false, // auto-detect. Agar error aaye to yaha server version likho, e.g. '1.21.1'
  auth: 'offline', // cracked/offline server (AuthMe /register /login)

  password: process.env.MC_PASSWORD || 'Shoaib@123',

  // Sirf ye players bot ko order de sakte hain (give / kill / base etc.)
  trusted: ['ShoaibXNoob'],
  owner: 'ShoaibXNoob', // /come, /follow, /give me isi player ke paas jayega

  // Chat me ye likhne par bot sunta hai: "@Yukiiii diamond"
  tag: '@yukiiii',

  // Discord webhook: coordinates, death, join/leave, store report yaha aate hain
  webhook:
    process.env.DISCORD_WEBHOOK || 'https://discord.com/api/webhooks/1569312275326697482/SPT_dhls7k90Dw37A-12smEZFhKXscnsUzGSW1WYIji2OoXdjonnCsV1BXXH-W3JQLUV',

  // Discord bot (prefix commands). Token environment variable se set karo
  discord: {
    token: process.env.DISCORD_TOKEN || '', // YAHAN NAYA TOKEN DAALO
    applicationId: process.env.DISCORD_CLIENT_ID || '1569406802398019745',
    clientId: process.env.DISCORD_CLIENT_ID || '1569406802398019745',
    guildId: process.env.DISCORD_GUILD_ID || '1234847245665304617',
    // Inhi Discord user IDs ko command chalane ki permission hogi.
    // Khali chhodo to sirf server ke Administrator chala sakte hain.
    ownerIds: [],
    prefix: '.',
  },
}
