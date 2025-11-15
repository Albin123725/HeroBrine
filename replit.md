# Minecraft Bot for Aternos Server

## Overview
This is a highly optimized Minecraft bot built with Node.js and mineflayer that connects to Aternos servers. The bot simulates human-like gameplay with randomized exploration, varied activities, natural timing, and anti-detection features to appear as a real player for 24/7 operation. **Now includes smart bed detection system, enhanced keep-alive mechanism, automatic combat defense, gamemode auto-maintain, and full creative mode inventory access** for automatic item acquisition and mob defense.

## Recent Changes
- **November 15, 2025**: Optimized Smart Bed Detection & Enhanced Anti-Disconnect System
  - **Smart bed detection**: Bot now scans for beds within configurable radius before placing new ones
    - Uses `findNearestBed()` function to search within `bedSearchRadius` (default 16 blocks)
    - Pathfinds to existing beds instead of placing duplicates
    - Logs distance to found bed for transparency
    - Only places new bed if none found nearby
  - **Enhanced keep-alive system**: Prevents automatic server disconnection
    - Tracks packet activity with `lastPacketTime` variable
    - Monitors idle time every 20 seconds via `startKeepAliveMonitoring()`
    - Sends jump action if 45+ seconds since last packet
    - Added `bot.on("packet")` handler to track server activity
    - Added `keepAlive: true` and `checkTimeoutInterval: 60000` to bot options
  - **Bed management optimization**: Reduces bed spam and resource waste
    - `tryToSleep()` function now searches first, places second
    - Clear logging: "Found bed X blocks away - going to existing bed instead of placing new one"
    - Configurable search radius via `bedSearchRadius` in config.json
  - **Connection stability improvements**: Enhanced reconnection handling
    - Clears keep-alive interval on reconnect in `attemptReconnect()`
    - Prevents interval stacking across reconnection attempts
  - **New functions added**: `findNearestBed()`, `startKeepAliveMonitoring()`
  - **Enhanced config.json**: Added `bedSearchRadius` configuration option
  - **Improved bot options**: Added `checkTimeoutInterval` and `keepAlive` flags
  - Tested and verified: Bot successfully finds and reuses existing beds, prevents automatic disconnection

- **November 15, 2025**: Finalized Proactive Combat System with Smart Targeting
  - **Proactive combat**: Bot now actively hunts 23 common hostile mob types within 8 blocks
  - **Combat monitoring**: Bot checks for hostile mobs every second and engages threats
  - **Gamemode auto-maintain**: Bot checks every 2 seconds if in creative mode, auto-switches back if changed
  - **Smart aggression detection**: Metadata-based targeting for selective mobs
  - **Auto-weapon system**: Automatically equips preferred weapon from creative inventory
  - **Smart targeting**: Prioritizes closest threatening mobs

- **November 15, 2025**: Added Creative Mode Inventory Support
  - **Creative mode detection**: Bot automatically detects game mode on spawn
  - **Automatic item acquisition**: Bot can grab items from creative inventory when in creative mode
  - **Smart bed management**: Automatically gets beds from creative inventory when night falls
  - **Fallback system**: Gracefully falls back to survival mode inventory management

## Project Architecture

### Structure
```
.
├── server.js           # Health check server and bot supervisor
├── bot.js              # Main bot logic with smart bed detection & keep-alive
├── config.json         # Location and behavior configuration
├── package.json        # Node.js dependencies
├── .env.example        # Example environment variables
├── .env                # Actual environment variables (not in git)
├── .gitignore          # Git ignore patterns
└── README.md           # Documentation
```

### Key Components
1. **server.js**: Health check server and process supervisor
2. **bot.js**: Main application file containing:
   - **Smart bed detection system**: Scans for beds before placing new ones
   - **Enhanced keep-alive mechanism**: Prevents automatic disconnection
   - **Creative mode inventory management**: Detects creative mode and enables full inventory access
   - Human-like behavior utilities
   - Activity-based gameplay with weighted random selection
   - Day/night cycle adaptation with optimized sleep functionality
   - Event handlers for bot lifecycle and reconnection

3. **config.json**: Configuration for:
   - Exploration radius
   - Block type to place/break
   - Building activity toggle
   - Auto-sleep during night time
   - **Bed search radius** (new!)
   - Combat settings
   - Chest interaction settings

### Dependencies
- `express`: HTTP server for health checks
- `mineflayer`: Core Minecraft bot framework
- `mineflayer-pathfinder`: Navigation and pathfinding
- `dotenv`: Environment variable management

## Smart Bed Detection Features

### How It Works
The bot uses an intelligent bed detection system:

1. **Search Phase**: Uses `findNearestBed(radius)` to scan for beds within configured distance
2. **Decision Making**: 
   - If bed found: Pathfind to it and sleep (no new bed placed)
   - If no bed found: Get bed from creative inventory and place nearby
3. **Optimization**: Prevents duplicate bed placement and resource waste

### Configuration
Set `bedSearchRadius` in config.json (default: 16 blocks):
```json
{
  "bedSearchRadius": 16
}
```

### Functions
- `findNearestBed(radius)`: Searches for any bed within specified radius
- `tryToSleep()`: Enhanced sleep logic with smart bed detection
- `placeBedNearby()`: Places bed only when necessary

## Enhanced Keep-Alive System

### How It Works
The bot maintains active connection through:

1. **Packet Tracking**: Monitors all incoming server packets via `bot.on("packet")`
2. **Idle Detection**: Checks if 45+ seconds have passed since last packet
3. **Activity Updates**: Sends jump action to prevent timeout
4. **Periodic Monitoring**: Runs every 20 seconds via `setInterval`

### Configuration
Built-in bot options:
```javascript
{
  checkTimeoutInterval: 60000,
  keepAlive: true
}
```

### Functions
- `startKeepAliveMonitoring()`: Initializes keep-alive system
- `lastPacketTime`: Tracks server activity timestamp
- Cleanup in `attemptReconnect()`: Prevents interval stacking

## Configuration Required

### Environment Variables
- `MINECRAFT_HOST`: Aternos server address
- `MINECRAFT_PORT`: Server port (usually 25565)
- `MINECRAFT_USERNAME`: Microsoft account email for online mode
- `MINECRAFT_VERSION`: Minecraft version (e.g., 1.21.10)
- `MINECRAFT_AUTH`: Authentication mode ('microsoft' for online servers)

### Server Requirements
- Aternos server must be running
- Bot account may need to be whitelisted
- **For creative mode features**: Set bot to creative mode with `/gamemode creative BotName`
- Server must allow block placement/breaking

## User Preferences
- Keep smart bed detection enabled by default
- Maintain enhanced keep-alive system for 24/7 operation
- Preserve creative mode inventory features
- Continue human-like randomized behavior for anti-detection

## Deployment
The bot is designed to run on Replit with auto-restart capabilities. See README.md for detailed deployment instructions.
