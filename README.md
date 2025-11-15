# Minecraft Bot with Smart Bed Detection & Anti-Disconnect System

A highly optimized Node.js bot that connects to your Minecraft server and simulates a real human player with natural gameplay patterns. **Features automatic combat defense, creative mode inventory access, smart bed detection, and enhanced keep-alive system** to prevent automatic disconnection!

## New Features

### Smart Bed Detection System
- 🔍 **Scans for nearby beds** before placing new ones (configurable radius in config.json)
- 🛏️  **Pathfinds to existing beds** instead of placing duplicates
- 📍 **Remembers bed locations** to avoid wasting resources
- ⚙️ **Configurable search radius** via `bedSearchRadius` in config.json (default: 16 blocks)

### Enhanced Anti-Disconnect System
- 💓 **Advanced keep-alive monitoring** prevents automatic server kicks
- 📡 **Packet activity tracking** detects idle periods and sends periodic updates
- 🔄 **Automatic jump actions** every 45 seconds of inactivity to maintain connection
- ⏱️  **20-second check intervals** ensure consistent server communication

## Features

- ⚔️  **Automatic Combat Defense**: Detects and fights hostile mobs that attack or come nearby
- 🎮 **Gamemode Auto-Maintain**: Automatically stays in creative mode (checks every 2 seconds)
- 🎨 **Creative Mode Inventory Access**: Automatically gets items from creative inventory when in creative mode
- ⚡ **Smart Weapon System**: Auto-equips diamond sword from creative inventory when combat starts
- 🎯 **Defensive AI**: Only attacks mobs that target the bot or come within 8 blocks
- 👾 **Hostile Mob Detection**: Monitors for zombies, skeletons, creepers, spiders, endermen, and more
- 🔄 **Automatic Item Acquisition**: Bot grabs beds, blocks, weapons, and essential items as needed
- 🤖 **Human-like Behavior**: Randomized exploration, natural timing, varied activities
- 🛡️  **Anti-Detection**: All movements, timing, and actions fully randomized
- 🚶 **Natural Movement**: Random wandering with jitter, imperfect pathfinding
- 🎲 **Smart Activities**: Randomly explores, builds, idles, and interacts with chests
- 💭 **Anti-AFK System**: Automatic random actions every 30-120 seconds
- 🌙 **Day/Night Cycle**: Automatically sleeps during night with smart bed detection
- 🔌 **24/7 Operation**: Robust reconnection handling with enhanced keep-alive
- 🔐 **Microsoft Authentication**: Full support for online servers

## Combat Features

The bot now includes a defensive combat system:

- **Gamemode Monitoring**: Checks every 2 seconds if still in creative mode, auto-switches back if changed
- **Hostile Mob Detection**: Scans for nearby hostile mobs within 16 blocks
- **Defensive Combat**: Only fights mobs that attack or come within 8 blocks
- **Auto-Weapon System**: Automatically equips diamond sword from creative inventory
- **Smart Targeting**: Prioritizes closest threatening mobs
- **Combat Logging**: Displays which mobs are being fought and combat status

**Supported Hostile Mobs:**
Zombie, Skeleton, Creeper, Spider, Cave Spider, Enderman, Witch, Slime, Phantom, Blaze, Ghast, Magma Cube, Silverfish, Wither Skeleton, Zombified Piglin, Piglin, Piglin Brute, Hoglin, Drowned, Husk, Stray, Vindicator, Evoker, Pillager, Ravager, Vex, Guardian, Elder Guardian, Shulker, Endermite, Wither

## Setup Instructions

### 1. Configure Server Connection

Create a `.env` file with your server details:

```bash
cp .env.example .env
```

Edit `.env`:

**For Online Servers (Recommended):**
```
MINECRAFT_HOST=your-server.aternos.me
MINECRAFT_PORT=25565
MINECRAFT_USERNAME=your-email@example.com
MINECRAFT_VERSION=1.20.1
MINECRAFT_AUTH=microsoft
```

**For Cracked/Offline Servers:**
```
MINECRAFT_HOST=your-server.example.com
MINECRAFT_PORT=25565
MINECRAFT_USERNAME=BotUsername
MINECRAFT_VERSION=1.20.1
MINECRAFT_AUTH=offline
```

### 2. Set the Bot to Creative Mode (Recommended)

Once the bot connects to your server, set it to creative mode so it can access the full inventory:

```
/gamemode creative YourBotUsername
```

The bot will automatically detect creative mode and enable full inventory access!

### 3. Configure Bot Behavior

Edit `config.json` to customize:

```json
{
  "exploreRadius": 25,
  "blockType": "dirt",
  "canDig": false,
  "buildingEnabled": true,
  "autoSleep": true,
  "bedSearchRadius": 16,
  "combatSettings": {
    "enabled": true,
    "detectionRadius": 16,
    "engagementDistance": 8,
    "preferredWeapon": "diamond_sword"
  },
  "requiredInventory": {
    "bed": 1,
    "dirt": 64
  },
  "chestInteraction": {
    "enabled": true,
    "depositItems": {
      "cobblestone": 16,
      "stone": 16
    },
    "withdrawItems": {
      "dirt": 8
    }
  }
}
```

**New Configuration Option:**
- `bedSearchRadius`: How far to search for existing beds before placing a new one (default: 16 blocks)

### 4. Run the Bot

Click the "Run" button or execute:

```bash
npm start
```

The bot will:
1. Connect to your server
2. Detect game mode (Survival, Creative, Adventure, Spectator)
3. Enable creative inventory access if in creative mode
4. Start exploring, building, and performing natural activities
5. **Search for nearby beds before placing new ones** (optimized behavior)
6. Sleep during night time using existing beds when available
7. **Maintain active connection with enhanced keep-alive system**
8. Continue 24/7 operation without disconnections

## How Smart Bed Detection Works

When night falls, the bot:

1. **Searches for existing beds** within the configured radius (default 16 blocks)
2. If a bed is found:
   - Pathfinds to the nearest bed
   - Uses the existing bed to sleep
   - **Avoids placing duplicate beds**
3. If no bed is found:
   - Gets a bed from creative inventory
   - Places it nearby
   - Goes to sleep

This prevents cluttering the world with multiple beds and saves resources!

## How Enhanced Keep-Alive Works

The bot prevents automatic disconnection by:

1. **Tracking all packet activity** from the server
2. **Monitoring idle time** (time since last packet received)
3. **Sending periodic activity updates** via jump actions every 45 seconds of inactivity
4. **Checking connection status** every 20 seconds
5. **Maintaining consistent server communication** to avoid timeouts

This ensures the bot stays connected 24/7 without getting kicked for inactivity!

## Creative Mode Features

When the bot is in creative mode, it can:

- **Automatically get beds** when it's night time and no bed is available
- **Grab building blocks** (dirt, stone, etc.) from creative inventory for placement activities
- **Grab weapons** (diamond sword, iron sword, etc.) from creative inventory for combat
- **Access any item** from the creative inventory as needed (except TNT for safety)
- **Fall back to survival mode** behavior when not in creative mode

The bot detects your game mode automatically and adjusts its inventory management accordingly!

## Important Notes

- ⚠️ **Set the bot to creative mode** for full inventory access: `/gamemode creative BotName`
- 📦 In survival mode, the bot uses regular inventory management
- 📋 Add the bot to your server whitelist if enabled
- 🔒 The bot needs appropriate permissions to place and break blocks
- 🚀 Your server must be running before starting the bot
- 🛏️  **Smart bed detection reduces bed spam** - bot reuses existing beds
- 💓 **Enhanced keep-alive prevents disconnections** - no more automatic kicks

## Troubleshooting

**Bot gets disconnected automatically:**
- The enhanced keep-alive system should prevent this
- Check console logs for connection status
- Verify your server allows keep-alive packets

**Bot says "No bed available" even in creative mode:**
- Make sure you've set the bot to creative mode with `/gamemode creative BotName`
- Check the console for "Creative mode detected" message on spawn

**Bot places multiple beds:**
- This should no longer happen with smart bed detection
- Adjust `bedSearchRadius` in config.json if needed

**Bot can't place blocks:**
- Set the bot to creative mode: `/gamemode creative BotName`
- Or give blocks in survival: `/give BotName minecraft:dirt 64`
- Check spawn protection settings

**Connection issues:**
- Verify your server is running and online
- Check the server address and port in `.env`
- For online servers, use `MINECRAFT_AUTH=microsoft`

## License

MIT
