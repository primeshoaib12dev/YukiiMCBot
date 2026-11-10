# dcbobyuki — YukiiBot V5

## Termux setup (Android)

```bash
pkg update -y && pkg upgrade -y
pkg install nodejs-lts unzip tmux -y
termux-setup-storage
cd ~/storage/downloads
unzip -o dcbobyuki.zip -d ~
cd ~/YukiiBotV5
bash setup.sh
npm start
```

`setup.sh` securely prompts for a **newly reset** Discord bot token, a **newly regenerated** webhook URL (optional), and the Minecraft AuthMe password. Secrets are stored locally in `.env`; `.env` is not inside the ZIP. Never share `.env`.

Configured Discord application/client ID: `1569406802398019745`.
Configured Guild ID carried forward from the original ZIP: `1234847245665304617`.

Enable **Message Content Intent** in Discord Developer Portal → Bot. Invite the bot to your server with View Channels, Send Messages, Read Message History and Embed Links permissions. In `config.js`, set `ownerIds` to your Discord user ID; otherwise only server Administrators may use privileged commands.

## Prefix commands

- `.help`, `.help mine`, `.help build`, `.help kill`, `.help craft`
- `.msg hello` — send a public Minecraft chat message
- `.msg owner hello` — whisper the configured Minecraft owner
- `.inventory` — list inventory, armor, hand and offhand
- `.craft <item> [count]` and `.craft list`
- `.find <structure>` — request server `/locate` and report coordinates if the server responds
- Existing bot commands: `.mine`, `.grind`, `.stop`, `.come`, `.follow`, `.goto`, `.house`, `.base`, `.armor`, `.store`, `.give`, `.kill`, `.players`, `.stats`, `.server`

Minecraft `.find`/locate depends on server permissions and server version. Crafting requires a valid recipe and available ingredients.

## Keep alive in Termux (best effort)

```bash
termux-wake-lock
tmux new -s yukii
npm start
```

Detach: `Ctrl+B`, then `D`. Reattach: `tmux attach -t yukii`.

A loop can restart the Node process after it exits, but Android can still kill Termux. For operation after Termux is closed or the phone is off, use a VPS or bot-hosting service.
