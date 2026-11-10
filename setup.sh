#!/data/data/com.termux/files/usr/bin/bash
set -e
cd "$(dirname "$0")"
echo 'YukiiBot Discord + Minecraft setup'
read -r -s -p 'New Discord bot token (reset it first): ' DISCORD_TOKEN; echo
read -r -s -p 'NEW Discord webhook URL (optional; leave blank to skip): ' DISCORD_WEBHOOK; echo
read -r -s -p 'Minecraft AuthMe password (leave blank if not used): ' MC_PASSWORD; echo
cat > .env <<ENV
DISCORD_TOKEN=$DISCORD_TOKEN
DISCORD_CLIENT_ID=1569406802398019745
DISCORD_GUILD_ID=1234847245665304617
DISCORD_WEBHOOK=$DISCORD_WEBHOOK
MC_PASSWORD=$MC_PASSWORD
ENV
chmod 600 .env
unset DISCORD_TOKEN DISCORD_WEBHOOK MC_PASSWORD
echo 'Secrets saved in .env (not included in ZIP).'
npm install
echo 'Setup complete. Start with: npm start'
