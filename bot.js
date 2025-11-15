require("dotenv").config();
const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const Vec3 = require("vec3");
const fs = require("fs");

let config;
try {
  config = JSON.parse(fs.readFileSync("config.json", "utf8"));
} catch (error) {
  console.error("Error reading config.json:", error.message);
  process.exit(1);
}

const botOptions = {
  host: process.env.MINECRAFT_HOST || "craftpixel42.aternos.me",
  port: parseInt(process.env.MINECRAFT_PORT, 10) || 12635,
  username: process.env.MINECRAFT_USERNAME || "Fighter",
  version: process.env.MINECRAFT_VERSION || "1.21.10",
  auth: process.env.MINECRAFT_AUTH || "offline",
  profilesFolder: "./auth-cache",
  checkTimeoutInterval: 60000,
  keepAlive: true,
  onMsaCode: (data) => {
    console.log("\n🔐 ===== MICROSOFT AUTHENTICATION REQUIRED =====");
    console.log(`Please open this URL in your browser:`);
    console.log(`   ${data.verification_uri}`);
    console.log(`\nEnter this code:`);
    console.log(`   ${data.user_code}`);
    console.log(
      `\nCode expires in ${Math.floor(data.expires_in / 60)} minutes`,
    );
    console.log("==============================================\n");
  },
};

console.log("🤖 Starting Combat-Ready Minecraft Bot...");
console.log(`Authentication mode: ${botOptions.auth}`);
console.log(
  `Connecting to ${botOptions.host}:${botOptions.port} as ${botOptions.username}`,
);

let bot;
let mcData;
let Item;
let reconnectAttempts = 0;
const maxReconnectAttempts = 10;
const reconnectDelay = 5000;

let isProcessing = false;
let isSleeping = false;
let lastActivityTime = Date.now();
let lastPacketTime = Date.now();
let activityCount = 0;
let exploreCenter = null;
let antiAFKInterval = null;
let gamemodeMonitorInterval = null;
let combatMonitorInterval = null;
let keepAliveInterval = null;
let inCombat = false;
let currentTarget = null;

function randomDelay(min = 500, max = 3000) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function shouldDoActivity(probability = 0.3) {
  return Math.random() < probability;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isCreativeMode() {
  if (!bot || !bot.player) return false;
  return bot.player.gamemode === 1;
}

async function ensureCreativeMode() {
  if (!bot || !bot.player) return;
  
  const currentGamemode = bot.player.gamemode;
  const gameModeNames = ["Survival", "Creative", "Adventure", "Spectator"];
  
  if (currentGamemode !== 1) {
    console.log(`⚠️  Gamemode changed to ${gameModeNames[currentGamemode] || currentGamemode} - switching back to Creative...`);
    try {
      bot.chat("/gamemode creative");
      await delay(1000);
      
      let retries = 0;
      while (bot.player.gamemode !== 1 && retries < 3) {
        await delay(2000);
        console.log(`  🔄 Gamemode not yet updated, retrying... (${retries + 1}/3)`);
        bot.chat("/gamemode creative");
        await delay(1000);
        retries++;
      }
      
      if (bot.player.gamemode === 1) {
        console.log("✅ Successfully switched to Creative mode");
      } else {
        console.log("⚠️  Failed to switch to Creative mode - bot may lack permissions");
      }
    } catch (error) {
      console.log(`  ⚠️  Failed to switch gamemode: ${error.message}`);
    }
  }
}

function startGamemodeMonitoring() {
  if (gamemodeMonitorInterval) {
    clearInterval(gamemodeMonitorInterval);
  }
  gamemodeMonitorInterval = setInterval(ensureCreativeMode, 2000);
  console.log("🎮 Gamemode monitoring enabled - will auto-maintain Creative mode");
}

function startKeepAliveMonitoring() {
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  keepAliveInterval = setInterval(() => {
    const timeSinceLastPacket = Date.now() - lastPacketTime;
    if (timeSinceLastPacket > 45000 && bot && bot.entity) {
      console.log("🔄 Sending keep-alive activity...");
      try {
        bot.setControlState("jump", true);
        setTimeout(() => {
          bot.setControlState("jump", false);
        }, 100);
        lastPacketTime = Date.now();
      } catch (error) {
      }
    }
  }, 20000);
  console.log("💓 Enhanced keep-alive monitoring enabled - will prevent automatic disconnection");
}

async function getItemFromCreativeInventory(itemName, count = 1) {
  if (!isCreativeMode()) {
    return null;
  }

  if (!Item) {
    console.log(`  ⚠️  [Creative] Item class not initialized yet`);
    return null;
  }

  try {
    console.log(
      `  🎨 [Creative] Getting ${count}x ${itemName} from creative inventory...`,
    );

    const itemId = mcData.itemsByName[itemName]?.id;
    if (!itemId) {
      console.log(`  ⚠️  Item ${itemName} not found in registry`);
      return null;
    }

    const targetSlot = 36 + Math.floor(Math.random() * 9);
    
    const item = new Item(itemId, count, null);
    await bot.creative.setInventorySlot(targetSlot, item);
    await delay(800);

    const slotItem = bot.inventory.slots[targetSlot];
    if (slotItem && slotItem.name === itemName) {
      console.log(`  ✅ [Creative] Got ${count}x ${itemName} in slot ${targetSlot}`);
      return slotItem;
    }

    return null;
  } catch (error) {
    console.log(`  ⚠️  [Creative] Failed to get ${itemName}: ${error.message}`);
    return null;
  }
}

async function ensureInventoryItem(itemName, minCount = 1) {
  const existingItem = bot.inventory
    .items()
    .find((item) => item.name === itemName);

  if (existingItem && existingItem.count >= minCount) {
    console.log(`  ✅ Already have ${existingItem.count}x ${itemName}`);
    return existingItem;
  }

  if (isCreativeMode()) {
    const neededCount = minCount - (existingItem?.count || 0);
    const creativeItem = await getItemFromCreativeInventory(
      itemName,
      neededCount > 0 ? neededCount : minCount,
    );
    if (creativeItem) {
      return creativeItem;
    }
  }

  return existingItem || null;
}

async function ensureBedInInventory() {
  const bedNames = [
    "red_bed",
    "blue_bed",
    "green_bed",
    "yellow_bed",
    "white_bed",
    "black_bed",
    "brown_bed",
    "cyan_bed",
    "gray_bed",
    "light_blue_bed",
    "light_gray_bed",
    "lime_bed",
    "magenta_bed",
    "orange_bed",
    "pink_bed",
    "purple_bed",
  ];

  const existingBed = bot.inventory
    .items()
    .find((item) => bedNames.some((name) => item.name === name));
  if (existingBed) {
    console.log(`  ✅ Already have ${existingBed.name}`);
    return existingBed;
  }

  if (isCreativeMode()) {
    console.log("  🎨 [Creative] Getting bed from creative inventory...");
    return await getItemFromCreativeInventory("red_bed", 1);
  }

  return null;
}

function findNearestBed(radius) {
  const bedNames = [
    "red_bed",
    "blue_bed",
    "green_bed",
    "yellow_bed",
    "white_bed",
    "black_bed",
    "brown_bed",
    "cyan_bed",
    "gray_bed",
    "light_blue_bed",
    "light_gray_bed",
    "lime_bed",
    "magenta_bed",
    "orange_bed",
    "pink_bed",
    "purple_bed",
  ];

  const bedBlock = bot.findBlock({
    matching: (block) => bedNames.includes(block.name),
    maxDistance: radius || config.bedSearchRadius || 16,
  });

  return bedBlock;
}

function isHostileMob(entity) {
  if (!entity || !entity.name) return false;
  
  const hostileMobs = [
    "zombie", "zombie_villager", "husk", "drowned",
    "skeleton", "stray", "wither_skeleton",
    "creeper", "spider", "cave_spider",
    "enderman", "endermite",
    "witch", "blaze", "ghast",
    "slime", "magma_cube", "silverfish",
    "phantom", "vex", "vindicator", "evoker", "pillager",
    "ravager", "hoglin", "zoglin",
    "zombified_piglin", "piglin", "piglin_brute",
    "guardian", "elder_guardian", "shulker",
    "wither"
  ];
  
  return hostileMobs.includes(entity.name);
}

function getNearbyHostileMobs() {
  if (!bot || !bot.entities) return [];
  
  const hostileMobs = [];
  const detectionRadius = config.combatSettings?.detectionRadius || 16;
  
  for (const entity of Object.values(bot.entities)) {
    if (entity === bot.entity) continue;
    
    if (isHostileMob(entity)) {
      const distance = bot.entity.position.distanceTo(entity.position);
      if (distance <= detectionRadius) {
        hostileMobs.push({
          entity: entity,
          distance: distance,
          name: entity.name
        });
      }
    }
  }
  
  hostileMobs.sort((a, b) => a.distance - b.distance);
  return hostileMobs;
}

function isMobTargetingBot(mob) {
  if (!mob || !mob.entity) return false;
  
  const distance = bot.entity.position.distanceTo(mob.entity.position);
  const engagementDistance = config.combatSettings?.engagementDistance || 8;
  
  if (distance > engagementDistance) return false;
  
  const alwaysFightMobs = [
    "zombie", "zombie_villager", "husk", "drowned",
    "skeleton", "stray", "wither_skeleton",
    "creeper", "spider", "cave_spider",
    "witch", "blaze", "ghast",
    "slime", "magma_cube", "silverfish",
    "phantom", "vex", "vindicator", "evoker", "pillager",
    "ravager", "hoglin", "zoglin"
  ];
  
  if (alwaysFightMobs.includes(mob.name)) {
    return true;
  }
  
  if (mob.name === "enderman") {
    if (mob.entity.metadata && mob.entity.metadata[16]) {
      return true;
    }
    return false;
  }
  
  if (mob.name === "zombified_piglin" || mob.name === "piglin") {
    if (mob.entity.metadata && (mob.entity.metadata[15] || mob.entity.metadata[16])) {
      return true;
    }
    return distance <= 5;
  }
  
  if (mob.name === "piglin_brute" || mob.name === "guardian" || 
      mob.name === "elder_guardian" || mob.name === "shulker" || 
      mob.name === "wither" || mob.name === "endermite") {
    return true;
  }
  
  return false;
}

async function equipWeaponFromCreative() {
  const preferredWeapon = config.combatSettings?.preferredWeapon || "diamond_sword";
  const weaponPriority = [preferredWeapon, "diamond_sword", "iron_sword", "stone_sword", "wooden_sword"];
  const uniqueWeapons = [...new Set(weaponPriority)];
  
  for (const weaponName of uniqueWeapons) {
    const weapon = await ensureInventoryItem(weaponName, 1);
    if (weapon) {
      try {
        await bot.equip(weapon, "hand");
        console.log(`  ⚔️  Equipped ${weaponName}`);
        return weapon;
      } catch (error) {
        continue;
      }
    }
  }
  
  console.log("  ⚠️  No weapon available");
  return null;
}

async function defendAgainstMobs() {
  if (!config.combatSettings?.enabled) return;
  if (inCombat || isProcessing) return;
  
  if (isNightTime()) {
    return;
  }
  
  const nearbyMobs = getNearbyHostileMobs();
  if (nearbyMobs.length === 0) return;
  
  const threateningMobs = nearbyMobs.filter(mob => isMobTargetingBot(mob));
  if (threateningMobs.length === 0) return;
  
  inCombat = true;
  const originalProcessingState = isProcessing;
  isProcessing = true;
  
  try {
    const target = threateningMobs[0];
    console.log(`\n⚔️  === COMBAT MODE ACTIVATED ===`);
    console.log(`  🎯 Target: ${target.name} (${target.distance.toFixed(1)} blocks away)`);
    console.log(`  👾 Total hostile mobs nearby: ${nearbyMobs.length}`);
    
    const weapon = await equipWeaponFromCreative();
    if (!weapon) {
      console.log("  ⚠️  Cannot fight without weapon");
      inCombat = false;
      isProcessing = originalProcessingState;
      return;
    }
    
    await engageCombat(target.entity);
    
  } catch (error) {
    console.log(`  ⚠️  Combat error: ${error.message}`);
  } finally {
    inCombat = false;
    isProcessing = originalProcessingState;
    console.log(`⚔️  === COMBAT MODE ENDED ===\n`);
  }
}

async function engageCombat(mobEntity) {
  const maxCombatDuration = 30000;
  const startTime = Date.now();
  
  while (mobEntity && mobEntity.isValid && !mobEntity.metadata[0]) {
    if (Date.now() - startTime > maxCombatDuration) {
      console.log("  ⏱️  Combat timeout");
      break;
    }
    
    const distance = bot.entity.position.distanceTo(mobEntity.position);
    
    if (distance > 20) {
      console.log("  🏃 Mob too far, disengaging");
      break;
    }
    
    try {
      await bot.lookAt(mobEntity.position.offset(0, mobEntity.height * 0.5, 0));
      
      if (distance > 3.5) {
        const goal = new goals.GoalNear(
          mobEntity.position.x,
          mobEntity.position.y,
          mobEntity.position.z,
          3
        );
        bot.pathfinder.setGoal(goal);
        await delay(300);
      } else {
        bot.pathfinder.setGoal(null);
        
        try {
          await bot.attack(mobEntity);
          console.log(`  💥 Attacked ${mobEntity.name}`);
          await delay(randomDelay(400, 600));
        } catch (error) {
          console.log(`  ⚠️  Attack failed: ${error.message}`);
          break;
        }
      }
      
      await delay(100);
      
    } catch (error) {
      break;
    }
  }
  
  bot.pathfinder.setGoal(null);
  
  if (mobEntity && !mobEntity.isValid) {
    console.log(`  ✅ Defeated ${mobEntity.name}!`);
  }
}

function startCombatMonitoring() {
  if (combatMonitorInterval) {
    clearInterval(combatMonitorInterval);
  }
  combatMonitorInterval = setInterval(() => {
    defendAgainstMobs().catch(err => {
      console.log(`  ⚠️  Combat monitor error: ${err.message}`);
    });
  }, 1000);
  console.log("⚔️  Combat monitoring enabled - will defend against nearby hostile mobs\n");
}

async function lookAround() {
  if (!bot || !bot.entity) return;

  try {
    const yaw = randomFloat(-Math.PI, Math.PI);
    const pitch = randomFloat(-Math.PI / 6, Math.PI / 6);
    await bot.look(yaw, pitch, true);
    await delay(randomDelay(300, 800));
  } catch (error) {
  }
}

async function performRandomAction() {
  if (!bot || !bot.entity) return;

  const actions = [
    async () => {
      bot.setControlState("jump", true);
      await delay(randomDelay(100, 300));
      bot.setControlState("jump", false);
    },
    async () => {
      bot.setControlState("sneak", true);
      await delay(randomDelay(500, 1500));
      bot.setControlState("sneak", false);
    },
    async () => {
      await lookAround();
      await delay(randomDelay(200, 600));
      await lookAround();
    },
    async () => {
      await delay(randomDelay(1000, 3000));
      await lookAround();
    },
    async () => {
      const items = bot.inventory.items();
      if (items.length > 0) {
        const randomItem = randomChoice(items);
        try {
          await bot.equip(randomItem, "hand");
          await delay(randomDelay(500, 1200));
        } catch (e) {}
      }
    },
  ];

  try {
    const action = randomChoice(actions);
    await action();
  } catch (error) {
  }
}

async function antiAFK() {
  const timeSinceLastActivity = Date.now() - lastActivityTime;
  const afkThreshold = randomDelay(30000, 120000);

  if (timeSinceLastActivity > afkThreshold && !isProcessing) {
    console.log("💭 Performing anti-AFK action...");
    await performRandomAction();
    lastActivityTime = Date.now();
  }
}

function startAntiAFKMonitoring() {
  if (antiAFKInterval) {
    clearInterval(antiAFKInterval);
  }
  antiAFKInterval = setInterval(antiAFK, 15000);
  console.log("🛡️  Anti-AFK monitoring enabled");
}

function createBot() {
  bot = mineflayer.createBot(botOptions);
  setupBotHandlers();
  return bot;
}

createBot();

function setupBotHandlers() {
  bot.loadPlugin(pathfinder);

  bot.on("spawn", () => {
    console.log("✅ Bot spawned successfully!");
    if (!bot.entity || !bot.entity.position) {
      console.log("⚠️  Bot entity not ready yet, waiting...");
      return;
    }
    const spawnPos = bot.entity.position;
    console.log(
      `📍 Position: X=${spawnPos.x.toFixed(1)}, Y=${spawnPos.y.toFixed(1)}, Z=${spawnPos.z.toFixed(1)}`,
    );

    const gameMode = bot.player.gamemode;
    const gameModeNames = ["Survival", "Creative", "Adventure", "Spectator"];
    console.log(`🎮 Game Mode: ${gameModeNames[gameMode] || gameMode}`);

    if (isCreativeMode()) {
      console.log("🎨 Creative mode detected - Full inventory access enabled!");
    } else {
      console.log("⚠️  Not in creative mode - attempting to switch...");
      setTimeout(() => ensureCreativeMode(), 1000);
    }

    reconnectAttempts = 0;
    exploreCenter = spawnPos.clone();
    lastPacketTime = Date.now();

    mcData = require("minecraft-data")(bot.version);
    Item = require("prismarine-item")(bot.version);
    const defaultMove = new Movements(bot, mcData);
    defaultMove.canDig = config.canDig !== undefined ? config.canDig : false;
    defaultMove.allow1by1towers = false;
    defaultMove.scafoldingBlocks = [];
    bot.pathfinder.setMovements(defaultMove);

    setTimeout(
      () => {
        console.log("🎮 Starting human-like gameplay simulation...\n");
        startAntiAFKMonitoring();
        startGamemodeMonitoring();
        startCombatMonitoring();
        startKeepAliveMonitoring();
        startHumanLikeActivity();
      },
      randomDelay(2000, 5000),
    );
  });

  bot.on("packet", () => {
    lastPacketTime = Date.now();
  });

  bot.on("error", (err) => {
    console.error("❌ Bot error:", err.message);
    if (
      err.message.includes("Invalid credentials") ||
      err.message.includes("authentication")
    ) {
      console.error("\n⚠️  AUTHENTICATION ERROR");
      console.error(
        "For Aternos servers, set MINECRAFT_AUTH=microsoft in .env",
      );
      process.exit(1);
    }
  });

  bot.on("kicked", (reason) => {
    console.log("⚠️  Bot was kicked:", reason);
    attemptReconnect();
  });

  bot.on("end", () => {
    console.log("🔌 Bot disconnected");
    attemptReconnect();
  });

  bot.on("death", () => {
    console.log("💀 Bot died! Respawning...");
    exploreCenter = null;
    inCombat = false;
    currentTarget = null;
  });

  bot.on("chat", (username, message) => {
    console.log(`💬 <${username}> ${message}`);
    lastActivityTime = Date.now();
  });

  bot.on("physicsTick", () => {
    if (!isProcessing && shouldDoActivity(0.001)) {
      lookAround().catch(() => {});
    }
  });
}

function attemptReconnect() {
  if (reconnectAttempts >= maxReconnectAttempts) {
    console.error(
      `❌ Failed to reconnect after ${maxReconnectAttempts} attempts. Exiting.`,
    );
    process.exit(1);
  }

  if (antiAFKInterval) {
    clearInterval(antiAFKInterval);
    antiAFKInterval = null;
  }
  
  if (gamemodeMonitorInterval) {
    clearInterval(gamemodeMonitorInterval);
    gamemodeMonitorInterval = null;
  }
  
  if (combatMonitorInterval) {
    clearInterval(combatMonitorInterval);
    combatMonitorInterval = null;
  }

  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
    keepAliveInterval = null;
  }

  reconnectAttempts++;
  console.log(
    `🔄 Reconnecting (${reconnectAttempts}/${maxReconnectAttempts}) in ${reconnectDelay / 1000}s...`,
  );

  setTimeout(() => {
    isProcessing = false;
    isSleeping = false;
    inCombat = false;
    currentTarget = null;
    createBot();
  }, reconnectDelay);
}

async function startHumanLikeActivity() {
  if (isProcessing || isSleeping || inCombat) return;
  isProcessing = true;

  try {
    activityCount++;
    console.log(`\n🎯 === Activity Session ${activityCount} ===`);

    if (config.autoSleep && isNightTime() && !isSleeping) {
      isProcessing = false;
      await tryToSleep();
      return;
    }

    const activity = randomChoice([
      "explore",
      "explore",
      "explore",
      "build",
      "idle",
      "interact",
    ]);

    console.log(`🎲 Selected activity: ${activity}`);

    switch (activity) {
      case "explore":
        await exploreRandomly();
        break;
      case "build":
        await buildActivity();
        break;
      case "idle":
        await idleActivity();
        break;
      case "interact":
        await chestActivity();
        break;
    }

    const thinkingTime = randomDelay(2000, 8000);
    console.log(`💭 Taking a ${(thinkingTime / 1000).toFixed(1)}s break...\n`);
    await delay(thinkingTime);

    lastActivityTime = Date.now();
    isProcessing = false;

    setImmediate(() => startHumanLikeActivity());
  } catch (error) {
    console.error("⚠️  Error in activity:", error.message);
    isProcessing = false;
    setTimeout(startHumanLikeActivity, randomDelay(5000, 10000));
  }
}

async function exploreRandomly() {
  if (!exploreCenter) {
    exploreCenter = bot.entity.position.clone();
  }

  const numStops = randomDelay(2, 6);
  console.log(`🚶 Exploring ${numStops} random locations...`);

  for (let i = 0; i < numStops; i++) {
    if (config.autoSleep && isNightTime() && !isSleeping) {
      console.log("🌙 Night detected during exploration");
      return;
    }
    
    if (inCombat) {
      console.log("⚔️  Combat detected during exploration");
      return;
    }

    const maxDistance = config.exploreRadius || 20;
    const angle = randomFloat(0, Math.PI * 2);
    const distance = randomFloat(5, maxDistance);

    const targetX = exploreCenter.x + Math.cos(angle) * distance;
    const targetZ = exploreCenter.z + Math.sin(angle) * distance;
    const targetY = exploreCenter.y;

    const jitterX = randomFloat(-1, 1);
    const jitterZ = randomFloat(-1, 1);

    const finalX = targetX + jitterX;
    const finalZ = targetZ + jitterZ;

    console.log(
      `  → Moving to location ${i + 1}/${numStops} (${finalX.toFixed(1)}, ${targetY.toFixed(1)}, ${finalZ.toFixed(1)})`,
    );

    const tolerance = randomFloat(1.5, 3);
    const goal = new goals.GoalNear(finalX, targetY, finalZ, tolerance);
    bot.pathfinder.setGoal(goal);

    const walkingActions = setInterval(
      async () => {
        if (shouldDoActivity(0.15)) {
          bot.setControlState("jump", true);
          setTimeout(
            () => bot.setControlState("jump", false),
            randomDelay(100, 200),
          );
        }
        if (shouldDoActivity(0.1)) {
          lookAround().catch(() => {});
        }
      },
      randomDelay(800, 2000),
    );

    await waitForArrival(
      finalX,
      targetY,
      finalZ,
      tolerance + 2,
      randomDelay(8000, 15000),
    );

    clearInterval(walkingActions);
    bot.pathfinder.setGoal(null);
    bot.setControlState("jump", false);

    if (shouldDoActivity(0.6)) {
      console.log("  👀 Looking around...");
      await lookAround();
      await delay(randomDelay(500, 2000));
      await lookAround();
    }

    if (shouldDoActivity(0.3)) {
      await performRandomAction();
    }

    await delay(randomDelay(1000, 3000));
  }

  console.log("✅ Exploration complete");
}

async function buildActivity() {
  if (!config.buildingEnabled) {
    console.log("🏗️  Building disabled in config");
    await idleActivity();
    return;
  }

  const numBlocks = randomDelay(1, 3);
  console.log(`🏗️  Placing and breaking ${numBlocks} block(s)...`);

  for (let i = 0; i < numBlocks; i++) {
    await lookAround();
    await delay(randomDelay(300, 800));

    await placeAndBreakBlock();

    if (i < numBlocks - 1) {
      await delay(randomDelay(2000, 5000));
    }
  }
}

async function idleActivity() {
  const idleTime = randomDelay(3000, 10000);
  console.log(`😴 Idle for ${(idleTime / 1000).toFixed(1)}s...`);

  const actions = randomDelay(2, 4);
  for (let i = 0; i < actions; i++) {
    await lookAround();
    await delay(randomDelay(1000, 3000));

    if (shouldDoActivity(0.4)) {
      await performRandomAction();
    }
  }
}

async function chestActivity() {
  if (!config.chestInteraction?.enabled) {
    console.log("🗄️  Chest interaction disabled");
    await idleActivity();
    return;
  }

  console.log("🗄️  Looking for chest...");
  await chestInteraction();
}

async function waitForArrival(x, y, z, threshold, timeout = 10000) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const checkArrival = setInterval(() => {
      if (inCombat) {
        clearInterval(checkArrival);
        resolve();
        return;
      }
      
      const distance = bot.entity.position.distanceTo({ x, y, z });
      const elapsed = Date.now() - startTime;

      if (distance < threshold || elapsed > timeout) {
        clearInterval(checkArrival);
        resolve();
      }
    }, 100);
  });
}

async function placeAndBreakBlock() {
  const blockType = config.blockType || "dirt";
  let placedBlockPosition = null;

  try {
    const item = await ensureInventoryItem(blockType, 1);

    if (!item) {
      console.log(`  ⚠️  No ${blockType} available`);
      return;
    }

    await bot.equip(item, "hand");
    await delay(randomDelay(200, 500));

    const pos = bot.entity.position.floored();

    const directions = [
      {
        pos: new Vec3(pos.x + 1, pos.y, pos.z),
        ref: new Vec3(pos.x + 1, pos.y - 1, pos.z),
        vec: new Vec3(0, 1, 0),
      },
      {
        pos: new Vec3(pos.x - 1, pos.y, pos.z),
        ref: new Vec3(pos.x - 1, pos.y - 1, pos.z),
        vec: new Vec3(0, 1, 0),
      },
      {
        pos: new Vec3(pos.x, pos.y, pos.z + 1),
        ref: new Vec3(pos.x, pos.y - 1, pos.z + 1),
        vec: new Vec3(0, 1, 0),
      },
      {
        pos: new Vec3(pos.x, pos.y, pos.z - 1),
        ref: new Vec3(pos.x, pos.y - 1, pos.z - 1),
        vec: new Vec3(0, 1, 0),
      },
    ];

    for (let i = directions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [directions[i], directions[j]] = [directions[j], directions[i]];
    }

    let placed = false;
    for (const attempt of directions) {
      const targetBlock = bot.blockAt(attempt.pos);
      const referenceBlock = bot.blockAt(attempt.ref);

      if (targetBlock?.name === "air" && referenceBlock?.name !== "air") {
        try {
          await bot.placeBlock(referenceBlock, attempt.vec);
          await delay(randomDelay(400, 800));

          const verifyBlock = bot.blockAt(attempt.pos);
          if (verifyBlock?.name === blockType) {
            console.log(`  ✅ Placed ${blockType} block`);
            placedBlockPosition = attempt.pos;
            placed = true;
            break;
          }
        } catch (err) {
        }
      }
    }

    if (!placed) return;

    await delay(randomDelay(1000, 3000));
    await lookAround();

    const placedBlock = bot.blockAt(placedBlockPosition);
    if (
      placedBlock &&
      placedBlock.name !== "air" &&
      bot.canDigBlock(placedBlock)
    ) {
      try {
        await bot.dig(placedBlock);
        console.log(`  ✅ Broke ${blockType} block`);
      } catch (err) {
        console.log(`  ⚠️  Failed to break: ${err.message}`);
      }
    }
  } catch (error) {
  }
}

async function chestInteraction() {
  if (!config.chestInteraction?.enabled) return;

  try {
    const chestNames = ["chest", "trapped_chest"];
    let chestBlock = bot.findBlock({
      matching: (block) => chestNames.includes(block.name),
      maxDistance: 32,
    });

    if (!chestBlock) {
      console.log("  ℹ️  No chest found nearby");
      return;
    }

    console.log(`  ✅ Found chest`);

    const distance = bot.entity.position.distanceTo(chestBlock.position);
    if (distance > 3) {
      const goal = new goals.GoalNear(
        chestBlock.position.x,
        chestBlock.position.y,
        chestBlock.position.z,
        2,
      );
      bot.pathfinder.setGoal(goal);
      await waitForArrival(
        chestBlock.position.x,
        chestBlock.position.y,
        chestBlock.position.z,
        3,
        10000,
      );
      bot.pathfinder.setGoal(null);
    }

    await delay(randomDelay(500, 1000));
    await lookAround();

    const chest = await bot.openChest(chestBlock);
    await delay(randomDelay(800, 1500));

    if (config.chestInteraction.depositItems && shouldDoActivity(0.5)) {
      for (const [itemName, count] of Object.entries(
        config.chestInteraction.depositItems,
      )) {
        const items = bot.inventory
          .items()
          .filter((item) => item.name.includes(itemName));
        if (items.length > 0) {
          const item = items[0];
          const amount = Math.min(count, item.count);
          await chest.deposit(item.type, null, amount);
          console.log(`  📥 Deposited ${amount}x ${itemName}`);
          await delay(randomDelay(400, 900));
        }
      }
    }

    if (config.chestInteraction.withdrawItems && shouldDoActivity(0.5)) {
      for (const [itemName, count] of Object.entries(
        config.chestInteraction.withdrawItems,
      )) {
        const chestItems = chest
          .containerItems()
          .filter((item) => item.name.includes(itemName));
        if (chestItems.length > 0) {
          const item = chestItems[0];
          const amount = Math.min(count, item.count);
          await chest.withdraw(item.type, null, amount);
          console.log(`  📤 Withdrew ${amount}x ${itemName}`);
          await delay(randomDelay(400, 900));
        }
      }
    }

    await delay(randomDelay(500, 1200));
    chest.close();
    console.log("  🔒 Closed chest");
  } catch (error) {
    console.log(`  ⚠️  Chest error: ${error.message}`);
  }
}

function isNightTime() {
  if (!bot.time || bot.time.timeOfDay === undefined) return false;
  const timeOfDay = bot.time.timeOfDay;
  return timeOfDay >= 13000 && timeOfDay < 23000;
}

async function tryToSleep() {
  if (isSleeping) return;

  try {
    isSleeping = true;
    isProcessing = true;
    bot.pathfinder.setGoal(null);

    console.log("🌙 Night time - attempting to sleep...");

    const bedNames = [
      "red_bed",
      "blue_bed",
      "green_bed",
      "yellow_bed",
      "white_bed",
      "black_bed",
      "brown_bed",
      "cyan_bed",
      "gray_bed",
      "light_blue_bed",
      "light_gray_bed",
      "lime_bed",
      "magenta_bed",
      "orange_bed",
      "pink_bed",
      "purple_bed",
    ];

    const searchRadius = config.bedSearchRadius || 16;
    console.log(`  🔍 Searching for beds within ${searchRadius} blocks...`);
    
    let bedBlock = findNearestBed(searchRadius);

    if (bedBlock) {
      const distance = bedBlock.position.distanceTo(bot.entity.position);
      console.log(`  ✅ Found bed ${distance.toFixed(1)} blocks away - going to existing bed instead of placing new one`);
      
      if (distance > 3) {
        const goal = new goals.GoalBlock(
          bedBlock.position.x,
          bedBlock.position.y,
          bedBlock.position.z,
        );
        bot.pathfinder.setGoal(goal);
        await waitForArrival(
          bedBlock.position.x,
          bedBlock.position.y,
          bedBlock.position.z,
          3,
          10000,
        );
        bot.pathfinder.setGoal(null);
      }

      console.log("  💤 Going to sleep on existing bed...");

      try {
        await bot.sleep(bedBlock);
        console.log("  ✅ Sleeping... will wake at dawn");

        bot.once("wake", () => {
          console.log("  ☀️  Good morning!");
          isSleeping = false;
          isProcessing = false;
          setTimeout(() => startHumanLikeActivity(), randomDelay(1000, 3000));
        });
        return;
      } catch (error) {
        console.log(`  ⚠️  Failed to sleep on existing bed: ${error.message}`);
        console.log("  🛏️  Trying to place a new bed...");
      }
    } else {
      console.log(`  ℹ️  No bed found within ${searchRadius} blocks, placing one from creative inventory...`);
    }

    const bedItem = await ensureBedInInventory();

    if (bedItem) {
      bedBlock = await placeBedNearby(bedItem, bedNames);
      
      if (bedBlock) {
        const distance = bot.entity.position.distanceTo(bedBlock.position);
        if (distance > 3) {
          const goal = new goals.GoalBlock(
            bedBlock.position.x,
            bedBlock.position.y,
            bedBlock.position.z,
          );
          bot.pathfinder.setGoal(goal);
          await waitForArrival(
            bedBlock.position.x,
            bedBlock.position.y,
            bedBlock.position.z,
            3,
            10000,
          );
          bot.pathfinder.setGoal(null);
        }

        try {
          await bot.sleep(bedBlock);
          console.log("  ✅ Sleeping on new bed... will wake at dawn");
          
          bot.once("wake", () => {
            console.log("  ☀️  Good morning!");
            isSleeping = false;
            isProcessing = false;
            setTimeout(() => startHumanLikeActivity(), randomDelay(1000, 3000));
          });
          return;
        } catch (err) {
          console.log(`  ⚠️  Failed to sleep on new bed: ${err.message}`);
        }
      }
    }
    
    console.log("  ⚠️  No bed available");
    isSleeping = false;
    isProcessing = false;
    setTimeout(startHumanLikeActivity, randomDelay(2000, 5000));
  } catch (error) {
    console.log(`  ⚠️  Sleep error: ${error.message}`);
    isSleeping = false;
    isProcessing = false;
    setTimeout(startHumanLikeActivity, randomDelay(2000, 5000));
  }
}

async function placeBedNearby(bedItem, bedNames) {
  console.log("  📦 Placing bed from creative inventory...");
  const pos = bot.entity.position.floored();

  const placePositions = [];
  
  for (let dy = 0; dy >= -3; dy--) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        if (dx === 0 && dz === 0 && dy === 0) continue;
        placePositions.push({
          ref: new Vec3(pos.x + dx, pos.y + dy - 1, pos.z + dz),
          vec: new Vec3(0, 1, 0)
        });
      }
    }
  }

  try {
    await bot.equip(bedItem, "hand");
    await delay(randomDelay(300, 600));

    for (const attempt of placePositions) {
      const refBlock = bot.blockAt(attempt.ref);
      const targetPos = attempt.ref.offset(0, 1, 0);
      const targetBlock = bot.blockAt(targetPos);

      if (refBlock && refBlock.name !== "air" && targetBlock && targetBlock.name === "air") {
        try {
          await bot.placeBlock(refBlock, attempt.vec);
          await delay(randomDelay(400, 800));
          
          const bedBlock = bot.findBlock({
            matching: (block) => bedNames.includes(block.name),
            maxDistance: 5,
          });
          
          if (bedBlock) {
            console.log(`  ✅ Successfully placed bed at (${targetPos.x}, ${targetPos.y}, ${targetPos.z})`);
            return bedBlock;
          }
        } catch (err) {
          continue;
        }
      }
    }
    
    console.log("  ⚠️  Could not place bed - no suitable location found");
    console.log(`  ℹ️  Bot position: (${pos.x}, ${pos.y}, ${pos.z})`);
    return null;
  } catch (error) {
    console.log(`  ⚠️  Bed placement error: ${error.message}`);
    return null;
  }
}

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down bot...");
  if (antiAFKInterval) {
    clearInterval(antiAFKInterval);
  }
  if (gamemodeMonitorInterval) {
    clearInterval(gamemodeMonitorInterval);
  }
  if (combatMonitorInterval) {
    clearInterval(combatMonitorInterval);
  }
  if (keepAliveInterval) {
    clearInterval(keepAliveInterval);
  }
  if (bot) bot.quit();
  process.exit(0);
});

console.log("🚀 Bot initialized and ready!\n");
