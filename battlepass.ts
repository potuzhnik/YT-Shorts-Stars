/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GameState, Entity, GameWorld, HeroId, Projectile, HeroStats, GameMode, GameCoin } from '../types';
import { HERO_VERSIONS, ARENA_SIZE, BOT_COUNT, BUSH_LAYOUT, GAME_MODES, DESTRUCTIBLES_LAYOUT } from '../constants';
import { subscribeToPlayers, updatePlayerState, updateRoomState, subscribeToRoom, RemotePlayer } from '../services/multiplayerService';

const resolveDestructibleCollisions = (
  x: number,
  y: number,
  radius: number,
  destructibles: any[] = []
): { x: number; y: number } => {
  let newX = x;
  let newY = y;
  for (const d of destructibles) {
    if (d.health <= 0) continue;
    const closestX = Math.max(d.x, Math.min(newX, d.x + d.width));
    const closestY = Math.max(d.y, Math.min(newY, d.y + d.height));
    const distX = newX - closestX;
    const distY = newY - closestY;
    const dist = Math.hypot(distX, distY);
    if (dist < radius) {
      if (dist > 0) {
        newX = closestX + (distX / dist) * radius;
        newY = closestY + (distY / dist) * radius;
      } else {
        const centerX = d.x + d.width / 2;
        const centerY = d.y + d.height / 2;
        const dirX = newX - centerX;
        const dirY = newY - centerY;
        const dirDist = Math.hypot(dirX, dirY);
        if (dirDist > 0) {
          newX = closestX + (dirX / dirDist) * radius;
          newY = closestY + (dirY / dirDist) * radius;
        } else {
          newX += radius;
        }
      }
    }
  }
  return { x: newX, y: newY };
};

const isLineOfSightBlocked = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  destructibles: any[] = []
): boolean => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = 10;
  for (let i = 1; i < steps; i++) {
    const tx = x1 + (dx * i) / steps;
    const ty = y1 + (dy * i) / steps;
    for (const d of destructibles) {
      if (d.health <= 0) continue;
      if (tx >= d.x && tx <= d.x + d.width && ty >= d.y && ty <= d.y + d.height) {
        return true;
      }
    }
  }
  return false;
};

function spawnBreakthroughWave(w: GameWorld, wave: number) {
  w.bots = []; // clear other bots to be safe
  if (wave === 10) {
    // SPAWN BOSS SCROOGE!
    // aura-scrooge model on team red
    w.bots.push({
      id: 'breakthrough-boss',
      name: '💰 BOSS AURA SCROOGE',
      x: 1200,
      y: w.height / 2,
      rotation: 180,
      health: 200000,
      maxHealth: 200000,
      speed: 2.2,
      isBot: true,
      heroId: 'aura-scrooge',
      ammo: 5,
      maxAmmo: 5,
      lastReloadProgress: 0,
      ultimateCharge: 100, // Ready to shoot shotgun!
      lastShotTime: 0,
      stunnedUntil: 0,
      abilityCooldown: 0,
      lastDamageTime: 0,
      isHidden: false,
      team: 'red',
      coins: 0,
      isBossEntity: true, // Mark boss
      behaviorState: 'attack'
    } as any);
  } else {
    // Normal wave: spawn regular enemies with scaled stats
    const numEnemies = 4 + wave * 2;
    const heroIds: HeroId[] = ['chicken', 'svinobomba', 'bimbolit', 'oreshki', 'svin', 'seliuk', 'aura-tom', 'smurfik', 'capybara', 'pes-patron'];
    for (let i = 0; i < numEnemies; i++) {
      const hId = heroIds[Math.floor(Math.random() * heroIds.length)];
      w.bots.push({
        id: `breakthrough-wave-${wave}-bot-${i}`,
        name: `Wave ${wave} Bot`,
        x: 800 + Math.random() * 800,
        y: 100 + Math.random() * (w.height - 200),
        rotation: 180,
        health: 800 + wave * 200,
        maxHealth: 800 + wave * 200,
        speed: 2.0 + wave * 0.1, // slowly gets faster
        isBot: true,
        heroId: hId,
        ammo: 3,
        maxAmmo: 3,
        lastReloadProgress: 0,
        ultimateCharge: 0,
        lastShotTime: 0,
        stunnedUntil: 0,
        abilityCooldown: 0,
        lastDamageTime: 0,
        isHidden: false,
        team: 'red',
        coins: 0,
        behaviorState: 'attack'
      } as any);
    }
  }
}

export function useGameLoop(
  heroId: HeroId, 
  heroLevel: number, 
  skinColor: string, 
  isFinished: boolean, 
  mode: GameMode = GameMode.SOLO_SHOWDOWN,
  multiplayer?: { roomId: string, userId: string, isHost: boolean },
  prestigeLevel: number = 0
) {
  const [world, setWorld] = useState<GameWorld | null>(null);
  const requestRef = useRef<number>(0);
  const worldRef = useRef<GameWorld | null>(null);
  const heroLevelRef = useRef(heroLevel);
  const prestigeLevelRef = useRef(prestigeLevel);
  const lastPlayerSyncRef = useRef(0);
  const lastRoomSyncRef = useRef(0);
  const remotePlayersRef = useRef<RemotePlayer[]>([]);
  useEffect(() => { heroLevelRef.current = heroLevel; }, [heroLevel]);
  useEffect(() => { prestigeLevelRef.current = prestigeLevel; }, [prestigeLevel]);

  const inputRef = useRef({ 
    move: { x: 0, y: 0 }, 
    shoot: { x: 0, y: 0 }, 
    autoAim: false,
    active: false,
    useAbility: false,
    useUltimate: false
  });
  const keysRef = useRef<Record<string, boolean>>({});

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { 
      keysRef.current[e.key.toLowerCase()] = true; 
      if (e.key.toLowerCase() === 'e') inputRef.current.useAbility = true;
      if (e.key.toLowerCase() === 'r') inputRef.current.useUltimate = true;
    };
    const handleKeyUp = (e: KeyboardEvent) => { 
      keysRef.current[e.key.toLowerCase()] = false; 
    };
    
    const handleMouseDown = (e: MouseEvent) => { if (e.button === 0) inputRef.current.active = true; };
    const handleMouseUp = (e: MouseEvent) => { if (e.button === 0) inputRef.current.active = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (inputRef.current.active) {
        // Calculate vector from player to mouse
        const rect = document.getElementById('root')?.getBoundingClientRect();
        if (!rect) return;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const dx = e.clientX - centerX;
        const dy = e.clientY - centerY;
        const dist = Math.hypot(dx, dy);
        if (dist > 0) {
          inputRef.current.shoot = { x: dx / dist, y: dy / dist };
        } else {
          inputRef.current.shoot = { x: 0, y: 0 };
        }
      } else {
        inputRef.current.shoot = { x: 0, y: 0 };
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Initialize world
  useEffect(() => {
    const hero = HERO_VERSIONS[heroId];
    const prestigeMultiplier = 1 + (prestigeLevel || 0) * 0.05;
    const stats: HeroStats = {
      ...hero.stats,
      health: Math.round((hero.stats.health + (heroLevel - 1) * 200) * prestigeMultiplier),
      maxHealth: Math.round((hero.stats.maxHealth + (heroLevel - 1) * 200) * prestigeMultiplier),
      damage: Math.round((hero.stats.damage + (heroLevel - 1) * 50) * prestigeMultiplier),
      range: hero.stats.range * prestigeMultiplier,
      speed: hero.stats.speed * prestigeMultiplier,
      ammoCapacity: hero.stats.ammoCapacity + (prestigeLevel || 0),
    };

    const spawnPoints = [
      { x: 150, y: 150 },
      { x: ARENA_SIZE.width - 150, y: 150 },
      { x: 150, y: ARENA_SIZE.height - 150 },
      { x: ARENA_SIZE.width - 150, y: ARENA_SIZE.height - 150 },
      { x: ARENA_SIZE.width / 2, y: 150 },
      { x: ARENA_SIZE.width / 2, y: ARENA_SIZE.height - 150 },
    ];
    const shuffledSpawns = [...spawnPoints].sort(() => Math.random() - 0.5);

    let playerSpawn = shuffledSpawns.pop()!;
    if (mode === GameMode.BREAKTHROUGH) {
      playerSpawn = { x: 100, y: ARENA_SIZE.height / 2 };
    }
    const player: Entity = {
      id: 'player',
      name: 'Player',
      x: playerSpawn.x,
      y: playerSpawn.y,
      rotation: 0,
      health: stats.health,
      maxHealth: stats.maxHealth,
      speed: stats.speed,
      isBot: false,
      heroId: heroId,
      ammo: stats.ammoCapacity,
      maxAmmo: stats.ammoCapacity,
      lastReloadProgress: 0,
      ultimateCharge: 0,
      lastShotTime: 0,
      stunnedUntil: 0,
      abilityCooldown: 0,
      lastDamageTime: 0,
      isHidden: false,
      team: 'blue',
      coins: 0,
    };

    const bots: Entity[] = [];
    if (mode === GameMode.BOSS_FIGHT) {
      bots.push({
        id: 'boss',
        name: '🐷 MEGAMIND SVIN BOSS',
        x: ARENA_SIZE.width / 2,
        y: ARENA_SIZE.height / 2,
        rotation: 0,
        health: 75000,
        maxHealth: 75000,
        speed: 2.1,
        isBot: true,
        heroId: 'svin',
        ammo: 10,
        maxAmmo: 10,
        lastReloadProgress: 0,
        ultimateCharge: 0,
        lastShotTime: 0,
        stunnedUntil: 0,
        abilityCooldown: 0,
        lastDamageTime: 0,
        isHidden: false,
        team: 'red',
        coins: 0,
        isBossEntity: true, // Custom identifier
      } as any);
    } else if (mode === GameMode.BREAKTHROUGH) {
      // Starts empty; spawned in waves
    } else {
      const heroIds: HeroId[] = Object.keys(HERO_VERSIONS) as HeroId[];
      const currentMode = GAME_MODES[mode];
      let maxBots = currentMode.maxPlayers - 1;

      if (mode === GameMode.DUO_SHOWDOWN) {
        if (multiplayer?.roomId) {
          maxBots = 6;
        } else {
          maxBots = 7;
        }
      }

      for (let i = 0; i < maxBots; i++) {
         const bHeroId = heroIds[Math.floor(Math.random() * heroIds.length)];
         const bHero = HERO_VERSIONS[bHeroId];
         const bSpawn = shuffledSpawns.length > 0 ? shuffledSpawns.pop()! : { x: Math.random() * ARENA_SIZE.width, y: Math.random() * ARENA_SIZE.height };
         
         // Assign team based on mode and index
         let team: 'blue' | 'red' | 'green' | 'yellow' = 'red';
         let name = `Bot ${i + 1}`;

         if (mode === GameMode.DUO_SHOWDOWN) {
           if (multiplayer?.roomId) {
             if (i < 2) {
               team = 'red';
               name = `Rival A Bot ${i + 1}`;
             } else if (i < 4) {
               team = 'green';
               name = `Rival B Bot ${i - 1}`;
             } else {
               team = 'yellow';
               name = `Rival C Bot ${i - 3}`;
             }
           } else {
             if (i === 0) {
               team = 'blue';
               name = `Ally Bot 🤖`;
             } else if (i < 3) {
               team = 'red';
               name = `Rival A Bot ${i}`;
             } else if (i < 5) {
               team = 'green';
               name = `Rival B Bot ${i - 2}`;
             } else {
               team = 'yellow';
               name = `Rival C Bot ${i - 4}`;
             }
           }
         } else if (mode !== GameMode.SOLO_SHOWDOWN) {
           // In 3v3 modes: player is blue, 2 bots are blue, 3 bots are red
           if (i < 2) team = 'blue';
         }

         bots.push({
           id: `bot-${i}`,
           name: name,
           x: bSpawn.x,
           y: bSpawn.y,
           rotation: Math.random() * 360,
           health: bHero.stats.health,
           maxHealth: bHero.stats.maxHealth,
           speed: bHero.stats.speed * 0.7, // Bots are slower
           isBot: true,
           heroId: bHeroId,
           ammo: bHero.stats.ammoCapacity,
           maxAmmo: bHero.stats.ammoCapacity,
           lastReloadProgress: 0,
           ultimateCharge: 0,
           lastShotTime: 0,
           stunnedUntil: 0,
           abilityCooldown: 0,
           lastDamageTime: 0,
           isHidden: false,
           team: team,
           coins: 0,
         });
      }
    }

    const initialWorld: GameWorld = {
      width: ARENA_SIZE.width,
      height: ARENA_SIZE.height,
      player,
      bots,
      remotePlayers: [],
      projectiles: [],
      bushes: BUSH_LAYOUT,
      destructibles: JSON.parse(JSON.stringify(DESTRUCTIBLES_LAYOUT)),
      coins: [],
      camera: { x: player.x, y: player.y },
      mode: mode,
      timeLeft: mode === GameMode.SOLO_SHOWDOWN || mode === GameMode.BREAKTHROUGH ? undefined : 120, // 2 minutes
      scores: { blue: 0, red: 0 },
      roomId: multiplayer?.roomId,
      isHost: multiplayer?.isHost,
      // Add custom breakthrough state if mode is breakthrough
      wave: mode === GameMode.BREAKTHROUGH ? 0 : undefined,
      waveState: mode === GameMode.BREAKTHROUGH ? 'intro' : undefined,
      waveTimer: mode === GameMode.BREAKTHROUGH ? Date.now() + 4000 : undefined,
      mangoPoints: mode === GameMode.BREAKTHROUGH ? 0 : undefined,
      bargeOpen: mode === GameMode.BREAKTHROUGH ? false : undefined,
    };

    worldRef.current = initialWorld;
    setWorld(initialWorld);
  }, [heroId, heroLevel, multiplayer?.roomId, mode, skinColor]);

  const updateRef = useRef<((time: number) => void) | null>(null);

  // Handle Multiplayer Subscriptions
  useEffect(() => {
    if (!multiplayer?.roomId) return;

    const unsub = subscribeToPlayers(multiplayer.roomId, (players) => {
      remotePlayersRef.current = players.filter(p => p.userId !== multiplayer.userId);
    });

    return () => unsub();
  }, [multiplayer?.roomId, multiplayer?.userId]);

  // Handle Room Subscriptions for Breakthrough
  useEffect(() => {
    if (!multiplayer?.roomId || mode !== GameMode.BREAKTHROUGH || multiplayer.isHost) return;

    const unsub = subscribeToRoom(multiplayer.roomId, (room: any) => {
      const w = worldRef.current;
      if (!w) return;
      
      // Update local state based on host state
      if (room.wave !== undefined) (w as any).wave = room.wave;
      if (room.mangoPoints !== undefined) (w as any).mangoPoints = room.mangoPoints;
      if (room.bargeOpen !== undefined) (w as any).bargeOpen = room.bargeOpen;
      
      if (room.enemiesSync) {
        // Sync enemies mapping
        const syncedBots: Entity[] = [];
        room.enemiesSync.forEach((remoteE: any) => {
          let existing = w.bots.find(b => b.id === remoteE.id);
          if (!existing) {
            existing = {
              id: remoteE.id,
              name: remoteE.id === 'breakthrough-boss' ? '💰 BOSS AURA SCROOGE' : `Wave Enemy`,
              x: remoteE.x,
              y: remoteE.y,
              rotation: remoteE.rot,
              health: remoteE.hp,
              maxHealth: remoteE.maxHp,
              speed: HERO_VERSIONS[remoteE.heroId as HeroId]?.stats.speed * 0.7 || 3.5,
              isBot: true,
              heroId: remoteE.heroId as HeroId,
              ammo: 3,
              maxAmmo: 3,
              lastReloadProgress: 0,
              ultimateCharge: 0,
              lastShotTime: 0,
              stunnedUntil: 0,
              abilityCooldown: 0,
              lastDamageTime: 0,
              isHidden: false,
              team: 'red',
              coins: 0,
            } as any;
          } else {
            existing.health = remoteE.hp;
            existing.rotation = remoteE.rot;
            // Smoothly interpolate position to avoid layout jumps
            if (Math.hypot(existing.x - remoteE.x, existing.y - remoteE.y) > 200) {
              existing.x = remoteE.x;
              existing.y = remoteE.y;
            } else {
              existing.x += (remoteE.x - existing.x) * 0.35;
              existing.y += (remoteE.y - existing.y) * 0.35;
            }
          }
          (existing as any).isParrying = remoteE.isParrying || false;
          if (remoteE.id === 'breakthrough-boss') {
            (existing as any).isBossEntity = true;
          }
          syncedBots.push(existing);
        });
        w.bots = syncedBots;
      }
    });

    return () => unsub();
  }, [multiplayer?.roomId, mode, multiplayer?.isHost]);

  // Define update logic in a ref to keep it stable across renders
  useEffect(() => {
    updateRef.current = (time: number) => {
      if (!worldRef.current || isFinished) return;
      const w = worldRef.current;
      const hero = HERO_VERSIONS[w.player.heroId];
      const prestigeMultiplier = 1 + (prestigeLevelRef.current || 0) * 0.05;
      const playerStats = {
        ...hero.stats,
        health: (hero.stats.health + (heroLevelRef.current - 1) * 200) * prestigeMultiplier,
        maxHealth: (hero.stats.maxHealth + (heroLevelRef.current - 1) * 200) * prestigeMultiplier,
        damage: (hero.stats.damage + (heroLevelRef.current - 1) * 50) * prestigeMultiplier,
        range: hero.stats.range * prestigeMultiplier,
        speed: hero.stats.speed * prestigeMultiplier,
        ammoCapacity: hero.stats.ammoCapacity + (prestigeLevelRef.current || 0),
      };

      if ((w.player as any).isAuraBoosted) {
        playerStats.damage *= 1.3;
        playerStats.fireDelay /= 1.3;
      }

      const now = Date.now();

      // Multiplayer Sync (Inbound)
      if (multiplayer?.roomId) {
        // Sync remote players into world.remotePlayers
        const activeRemotePlayers: Entity[] = remotePlayersRef.current.map(rp => {
          // Check if projectile was newly fired
          const existingRemote = w.remotePlayers.find(e => e.id === rp.userId);
          if (rp.lastShot && (!existingRemote || (existingRemote as any).lastShotId !== rp.lastShot.id)) {
             w.projectiles.push({
               id: rp.lastShot.id,
               ownerId: rp.userId,
               x: rp.lastShot.x,
               y: rp.lastShot.y,
               vx: rp.lastShot.vx,
               vy: rp.lastShot.vy,
               damage: rp.lastShot.damage,
               radius: 10,
               color: HERO_VERSIONS[rp.heroId].color,
               life: HERO_VERSIONS[rp.heroId].stats.range / 12,
             });
          }

          return {
            id: rp.userId,
            name: rp.name,
            x: rp.x,
            y: rp.y,
            rotation: rp.rotation,
            health: rp.health,
            maxHealth: rp.maxHealth,
            speed: HERO_VERSIONS[rp.heroId].stats.speed,
            isBot: false,
            heroId: rp.heroId,
            ammo: rp.ammo,
            maxAmmo: HERO_VERSIONS[rp.heroId].stats.ammoCapacity,
            lastReloadProgress: 0,
            ultimateCharge: 0,
            lastShotTime: 0,
            stunnedUntil: 0,
            abilityCooldown: 0,
            lastDamageTime: 0,
            isHidden: false,
            team: rp.team,
            coins: rp.coins,
            lastShotId: rp.lastShot?.id // Store for comparison
          } as any;
        });
        w.remotePlayers = activeRemotePlayers;
      }
      let dx = inputRef.current.move.x;
      let dy = inputRef.current.move.y;

      // Support keyboard WASD
      if (keysRef.current['w']) dy = -1;
      if (keysRef.current['s']) dy = 1;
      if (keysRef.current['a']) dx = -1;
      if (keysRef.current['d']) dx = 1;

      // Normalize diagonal movement for keyboard
      if (dx !== 0 && dy !== 0 && (keysRef.current['w'] || keysRef.current['s'] || keysRef.current['a'] || keysRef.current['d'])) {
        const mag = Math.hypot(dx, dy);
        dx /= mag;
        dy /= mag;
      }

      const isDead = w.player.health <= 0;
      const isStunned = now < w.player.stunnedUntil || isDead;

      if (!isStunned && (dx !== 0 || dy !== 0)) {
        const potentialX = Math.max(0, Math.min(w.width, w.player.x + dx * w.player.speed));
        const potentialY = Math.max(0, Math.min(w.height, w.player.y + dy * w.player.speed));
        const resolved = resolveDestructibleCollisions(potentialX, potentialY, 25, w.destructibles);
        w.player.x = resolved.x;
        w.player.y = resolved.y;
        w.player.rotation = Math.atan2(dy, dx) * (180 / Math.PI);
      }

      // Seliuk Passive: Prickly - deals 50 damage to any enemy that touches him
      if (w.player.heroId === 'seliuk') {
        w.bots.forEach(bot => {
          const dist = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
          if (dist < 60) {
             bot.health -= 50;
             bot.lastDamageTime = now;
          }
        });
      }

      // Smurfik Passive: Sausage Feast - Heals 5 HP every 2 seconds
      if (w.player.heroId === 'smurfik' && w.player.health > 0) {
        if (!(w.player as any).lastSausageHealTime) {
          (w.player as any).lastSausageHealTime = now;
        }
        if (now - (w.player as any).lastSausageHealTime >= 2000) {
          w.player.health = Math.min(w.player.maxHealth, w.player.health + 5);
          (w.player as any).lastSausageHealTime = now;
        }
      }

      // Smurfik Passive for Bots too
      w.bots.forEach(bot => {
        if (bot.heroId === 'smurfik' && bot.health > 0) {
          if (!(bot as any).lastSausageHealTime) {
            (bot as any).lastSausageHealTime = now;
          }
          if (now - (bot as any).lastSausageHealTime >= 2000) {
            bot.health = Math.min(bot.maxHealth, bot.health + 5);
            (bot as any).lastSausageHealTime = now;
          }
        }
      });

      // Check Stealth (Player + Bots)
      const checkStealth = (entity: Entity) => {
        entity.isHidden = w.bushes.some(b => 
          entity.x > b.x && entity.x < b.x + b.width &&
          entity.y > b.y && entity.y < b.y + b.height
        );
      };
      checkStealth(w.player);
      w.bots.forEach(checkStealth);

      // -------------------------------------------------------------
      // BREAKTHROUGH MODE SYSTEM
      // -------------------------------------------------------------
      if (w.mode === GameMode.BREAKTHROUGH) {
        if (w.wave === undefined) {
          (w as any).wave = 0;
          (w as any).waveState = 'intro';
          (w as any).waveTimer = now + 4000;
          (w as any).mangoPoints = 0;
          (w as any).bargeOpen = false;
        }

        if (multiplayer?.roomId && !multiplayer.isHost) {
          // Guest player is passive, synchronized entirely from room state in the subscription above
        } else {
          // Play execution is on Singleplayer / Multiplayer Host:
          if ((w as any).waveState === 'intro') {
            if (now < (w as any).waveTimer) {
              const insideX = 120;
              const insideY = w.height / 2;
              
              // Smooth gliding of the landing craft from x = -100 to x = 120
              const elapsed = 4000 - ((w as any).waveTimer - now);
              let craftX = -100 + (120 - (-100)) * Math.min(1, elapsed / 3000);
              const insideOfBargeX = craftX - 30; // passenger area
              
              // Lock player inside craft
              w.player.x = insideOfBargeX + (multiplayer?.isHost ? -20 : 0);
              w.player.y = insideY + (multiplayer?.isHost ? -15 : 15);
              
              // Lock any remotePlayers if they are in the lobby
              w.remotePlayers.forEach((rp, idx) => {
                rp.x = insideOfBargeX + 20;
                rp.y = insideY + (idx % 2 === 0 ? -30 : 30);
              });

              if (elapsed >= 3000) {
                (w as any).bargeOpen = true;
              }
            } else {
              // Wave 1 begins!
              (w as any).wave = 1;
              (w as any).waveState = 'fight';
              (w as any).waveTimer = 0;
              (w as any).bargeOpen = true;
              spawnBreakthroughWave(w, 1);
            }
          } else if ((w as any).waveState === 'fight') {
            const aliveBots = w.bots.filter(b => b.health > 0);
            if (aliveBots.length === 0) {
              const currentWave = (w as any).wave;
              if (currentWave === 10) {
                // Defeated Boss Scrooge! Give 500 mango points.
                (w as any).mangoPoints += 500;
                (w as any).waveState = 'victory';
              } else {
                // Normal Wave cleared! +50 Mangoes.
                (w as any).mangoPoints += 50;
                (w as any).waveState = 'cleared';
                (w as any).waveTimer = now + 4000; // 4 seconds before next wave
              }
            }
          } else if ((w as any).waveState === 'cleared') {
            if (now >= (w as any).waveTimer) {
              const nextWave = (w as any).wave + 1;
              (w as any).wave = nextWave;
              (w as any).waveState = 'fight';
              (w as any).waveTimer = 0;
              spawnBreakthroughWave(w, nextWave);
            }
          }
        }
      }

      // Reload Logic (Player)
      if (w.player.ammo < w.player.maxAmmo) {
        w.player.lastReloadProgress += 16.6; // ~60fps
        if (w.player.lastReloadProgress >= playerStats.reloadTime) {
          w.player.ammo++;
          w.player.lastReloadProgress = 0;
        }
      }

      // 2. Player Shooting
      let sx = inputRef.current.shoot.x;
      let sy = inputRef.current.shoot.y;

      if (inputRef.current.autoAim && (sx === 0 && sy === 0)) {
         // Auto-aim at the nearest visible bot
         let nearestBot = null;
         let minDist = Infinity;
         w.bots.forEach(bot => {
           const d = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
           const isEnemy = bot.team !== w.player.team;
           // Enforce bush invisibility for enemy bots
           const canSee = !bot.isHidden || !isEnemy || d < 120;
           if (bot.health > 0 && canSee && d < minDist && d < playerStats.range + 200) {
              minDist = d;
              nearestBot = bot;
           }
         });
         if (nearestBot) {
           const angle = Math.atan2(nearestBot.y - w.player.y, nearestBot.x - w.player.x);
           sx = Math.cos(angle);
           sy = Math.sin(angle);
         }
         inputRef.current.autoAim = false; 
      }

      const canShoot = !isStunned && (sx !== 0 || sy !== 0) && 
                      now - w.player.lastShotTime > playerStats.fireDelay && 
                      w.player.ammo > 0;

      if (canShoot) {
         const aimRotation = Math.atan2(sy, sx);
         let finalDamage = playerStats.damage;
         
         // Svin Passive: +10% damage when below 40% health
         if (w.player.heroId === 'svin' && w.player.health < w.player.maxHealth * 0.4) {
           finalDamage *= 1.1;
         }
         if (w.player.heroId === 'aura-scrooge' && w.player.health < w.player.maxHealth * 0.45) {
            finalDamage *= 1.15;
         }

         const projectileId = `p-${now}-${Math.random().toString(36).substr(2, 9)}`;
         const px = w.player.x;
         const py = w.player.y;
         const pvx = Math.cos(aimRotation) * (w.player.heroId === 'svin' ? 12 : w.player.heroId === 'smurfik' ? 14 : w.player.heroId === 'capybara' ? 18 : 15);
         const pvy = Math.sin(aimRotation) * (w.player.heroId === 'svin' ? 12 : w.player.heroId === 'smurfik' ? 14 : w.player.heroId === 'capybara' ? 18 : 15);

         w.projectiles.push({
           id: projectileId,
           ownerId: 'player',
           x: px,
           y: py,
           vx: pvx,
           vy: pvy,
           damage: finalDamage * (w.player.heroId === 'capybara' && (w.player as any).capybaraUltUntil && now < (w.player as any).capybaraUltUntil ? 1.4 : 1.0),
           radius: w.player.heroId === 'svin' ? 40 : w.player.heroId === 'smurfik' ? 42 : w.player.heroId === 'capybara' ? 14 : 10,
           color: w.player.heroId === 'capybara' ? '#facc15' : skinColor,
           life: playerStats.range / (w.player.heroId === 'svin' ? 12 : w.player.heroId === 'smurfik' ? 14 : w.player.heroId === 'capybara' ? 18 : 15),
            isWindSlash: w.player.heroId === 'smurfik',
            isMangoFlame: w.player.heroId === 'capybara',
         });

         // Push shot to multiplayer
         if (multiplayer?.roomId) {
            updatePlayerState(multiplayer.roomId, multiplayer.userId, {
              lastShot: {
                id: projectileId,
                x: px,
                y: py,
                vx: pvx,
                vy: pvy,
                damage: finalDamage,
                time: now
              }
            });
         }
         
         w.player.lastShotTime = now;
         w.player.ammo--;
         // Optionally reset reload progress to delay reload while firing
         w.player.lastReloadProgress = 0;
      }

      // 3. Ability & Ultimate
      if (inputRef.current.useAbility && now > w.player.abilityCooldown) {
        const heroData = HERO_VERSIONS[w.player.heroId];
        if (w.player.heroId === 'goose-einstein') {
          w.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
            if (dist < 400) bot.speed *= 0.5;
          });
          setTimeout(() => {
            w.bots.forEach(bot => {
              bot.speed = HERO_VERSIONS[bot.heroId].stats.speed * 0.7;
            });
          }, 3000);
        } else if (w.player.heroId === 'svinobomba') {
          // Hide for 4 seconds
          w.player.isHidden = true;
          const originalSpeed = w.player.speed;
          w.player.speed *= 1.2; // Passive speed boost
          setTimeout(() => {
            if (worldRef.current) {
              worldRef.current.player.isHidden = false;
              worldRef.current.player.speed = originalSpeed;
            }
          }, 4000);
        } else if (w.player.heroId === 'alcatrasnic') {
          // Heal for 600
          w.player.health = Math.min(w.player.maxHealth, w.player.health + 600);
        } else if (w.player.heroId === 'bimbolit') {
          // High-Speed Flight: Quick dash
          const originalSpeed = w.player.speed;
          w.player.speed *= 4;
          setTimeout(() => {
            if (worldRef.current) {
              worldRef.current.player.speed = originalSpeed;
            }
          }, 400);
        } else if (w.player.heroId === 'oreshki') {
          // Forest Healing: +1200 HP
          w.player.health = Math.min(w.player.maxHealth, w.player.health + 1200);
        } else if (w.player.heroId === 'svin') {
          // Tough Hide: -60% damage taken for 4s
          (w.player as any).isShielded = true;
          setTimeout(() => {
            if (worldRef.current) {
              (worldRef.current.player as any).isShielded = false;
            }
          }, 4000);
        } else if (w.player.heroId === 'seliuk') {
          // Juice Break: +400 HP + 2 ammo
          w.player.health = Math.min(w.player.maxHealth, w.player.health + 400);
          w.player.ammo = Math.min(w.player.maxAmmo, w.player.ammo + 2);
        } else if (w.player.heroId === 'aura-tom') {
          // Play a phonk to boost his stats by 1.3X for 4 seconds
          (w.player as any).isAuraBoosted = true;
          const originalSpeed = w.player.speed;
          w.player.speed *= 1.3;
          setTimeout(() => {
            if (worldRef.current) {
              (worldRef.current.player as any).isAuraBoosted = false;
              worldRef.current.player.speed = originalSpeed;
            }
          }, 4000);
        } else if (w.player.heroId === 'smurfik') {
          // Spear Dash: lunges forward with 5.5X speed boost to chase down the enemy
          const originalSpeed = w.player.speed;
          w.player.speed *= 5.5;
          setTimeout(() => {
            if (worldRef.current) {
              worldRef.current.player.speed = originalSpeed;
            }
          }, 350);
        } else if (w.player.heroId === 'capybara') {
          // Mango Juice Sip: trade 1 ammo for 300 health, no cooldown
          if (w.player.ammo >= 1) {
            w.player.health = Math.min(w.player.maxHealth, w.player.health + 300);
            w.player.ammo--;
          }
        } else if (w.player.heroId === 'aura-scrooge') {
          // Golden Parry: gains parrying (immunity to projectiles) for 3s
          (w.player as any).isParrying = true;
          setTimeout(() => {
            if (worldRef.current) {
              (worldRef.current.player as any).isParrying = false;
            }
          }, 3000);
        }
        w.player.abilityCooldown = w.player.heroId === 'capybara' ? 0 : now + heroData.ability.cooldown;
        inputRef.current.useAbility = false;
      }

      if (inputRef.current.useUltimate && w.player.ultimateCharge >= 100) {
        const heroData = HERO_VERSIONS[w.player.heroId];
        if (w.player.heroId === 'goose-einstein') {
          w.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
            if (dist < 600) bot.health -= 2000;
          });
        } else if (w.player.heroId === 'svinobomba') {
          // Bacon Rain: 15 explosive bombs in a spiral/spread
          for (let i = 0; i < 15; i++) {
            const angle = (i / 15) * Math.PI * 2;
            const dist = 50 + Math.random() * 200;
            w.projectiles.push({
              id: `bomb-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(angle) * (5 + Math.random() * 5),
              vy: Math.sin(angle) * (5 + Math.random() * 5),
              damage: 3000,
              radius: 25,
              color: '#f472b6',
              life: 40 + Math.random() * 20,
            });
          }
        } else if (w.player.heroId === 'alcatrasnic') {
          // Mashed Pickle Rain: Slow enemies in a massive area
          w.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
            if (dist < 600) {
              const originalBotSpeed = HERO_VERSIONS[bot.heroId].stats.speed * 0.7;
              bot.speed = originalBotSpeed * 0.4; // 60% slow
              setTimeout(() => {
                if (worldRef.current) {
                  const targetBot = worldRef.current.bots.find(b => b.id === bot.id);
                  if (targetBot) targetBot.speed = originalBotSpeed;
                }
              }, 5000);
            }
          });
        } else if (w.player.heroId === 'bimbolit') {
          // Cluster Barrage: Drops 12 bombs in a circle
          for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            const bombSpeed = 2 + Math.random() * 4;
            w.projectiles.push({
              id: `bomb-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(angle) * bombSpeed,
              vy: Math.sin(angle) * bombSpeed,
              damage: 2500,
              radius: 35,
              color: '#fbbf24',
              life: 50,
            });
          }
        } else if (w.player.heroId === 'oreshki') {
          // Acorn Barrage: 3 powerful acorns in a fan
          const aimRotation = Math.atan2(inputRef.current.shoot.y || Math.sin(w.player.rotation * Math.PI / 180), inputRef.current.shoot.x || Math.cos(w.player.rotation * Math.PI / 180));
          const angles = [-0.2, 0, 0.2];
          angles.forEach((angleOffset, i) => {
            w.projectiles.push({
              id: `oreshki-ult-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(aimRotation + angleOffset) * 20,
              vy: Math.sin(aimRotation + angleOffset) * 20,
              damage: 2500,
              radius: 12,
              color: '#a16207',
              life: 40,
            });
          });
        } else if (w.player.heroId === 'svin') {
          // Iron Rush: Dash and deal damage to anyone hit
          const originalSpeed = w.player.speed;
          w.player.speed *= 6;
          
          const dashInterval = setInterval(() => {
            if (!worldRef.current) return;
            const currentW = worldRef.current;
            currentW.bots.forEach(bot => {
              const dist = Math.hypot(bot.x - currentW.player.x, bot.y - currentW.player.y);
              if (dist < 100) {
                bot.health -= 3000;
                bot.lastDamageTime = Date.now();
              }
            });
          }, 50);

          setTimeout(() => {
            clearInterval(dashInterval);
            if (worldRef.current) {
              worldRef.current.player.speed = originalSpeed;
            }
          }, 800);
        } else if (w.player.heroId === 'seliuk') {
          // Sticky Splash: Throw juice that stuns
          const aimRotation = Math.atan2(inputRef.current.shoot.y || Math.sin(w.player.rotation * Math.PI / 180), inputRef.current.shoot.x || Math.cos(w.player.rotation * Math.PI / 180));
          w.projectiles.push({
            id: `seliuk-ult-${now}`,
            ownerId: 'player',
            x: w.player.x,
            y: w.player.y,
            vx: Math.cos(aimRotation) * 12,
            vy: Math.sin(aimRotation) * 12,
            damage: 800, // Direct hit damage
            radius: 50,
            color: '#10b981',
            life: 30, // Mid range
            isStun: true, // Custom flag to handle in collision
          } as any);
        } else if (w.player.heroId === 'aura-tom') {
          // Play ultra loud music stunning enemies in an area for 3 seconds
          w.bots.forEach(bot => {
            const dist = Math.hypot(bot.x - w.player.x, bot.y - w.player.y);
            if (dist < 400) {
              bot.stunnedUntil = now + 3000; // stun for 3 seconds
            }
          });
          w.remotePlayers.forEach(rp => {
            const dist = Math.hypot(rp.x - w.player.x, rp.y - w.player.y);
            if (dist < 400) {
              rp.stunnedUntil = now + 3000;
            }
          });
          // Push expanding audio shockwaves
          for (let i = 0; i < 16; i++) {
            const angle = (i / 16) * Math.PI * 2;
            const velocity = 8;
            w.projectiles.push({
              id: `audioult-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(angle) * velocity,
              vy: Math.sin(angle) * velocity,
              damage: 1500,
              radius: 24,
              color: '#d946ef',
              life: 30,
            });
          }
        } else if (w.player.heroId === 'smurfik') {
          // Piercing Thrust Ultimate
          const aimRotation = Math.atan2(inputRef.current.shoot.y || Math.sin(w.player.rotation * Math.PI / 180), inputRef.current.shoot.x || Math.cos(w.player.rotation * Math.PI / 180));
          w.projectiles.push({
            id: `smurfik-ult-${now}`,
            ownerId: 'player',
            x: w.player.x,
            y: w.player.y,
            vx: Math.cos(aimRotation) * 20,
            vy: Math.sin(aimRotation) * 20,
            damage: playerStats.damage * 2.0, // Deals double damage!
            radius: 45,
            color: '#06b6d4',
            life: 30,
            isPiercingUlt: true,
            hitEntityIds: [],
          });
        } else if (w.player.heroId === 'capybara') {
          // Mega Charged Mangoes: deals 1.4X damage for 6 seconds
          (w.player as any).capybaraUltUntil = now + 6000;
        } else if (w.player.heroId === 'aura-scrooge') {
          // Shotgun blast/spread
          const aimRotation = Math.atan2(inputRef.current.shoot.y || Math.sin(w.player.rotation * Math.PI / 180), inputRef.current.shoot.x || Math.cos(w.player.rotation * Math.PI / 180));
          const numPellets = 12;
          const spreadAngle = 0.5; // spread angle in radians
          for (let i = 0; i < numPellets; i++) {
            const angleOffset = -spreadAngle / 2 + (i / (numPellets - 1)) * spreadAngle;
            w.projectiles.push({
              id: `scrooge-ult-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(aimRotation + angleOffset) * (14 + Math.random() * 4),
              vy: Math.sin(aimRotation + angleOffset) * (14 + Math.random() * 4),
              damage: 1400, // pellets dealing decent damage
              radius: 8,
              color: '#fbbf24', // golden pellets
              life: 25, // mid-short range for shotguns
            });
          }
        } else {
          for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            w.projectiles.push({
              id: `ult-${now}-${i}`,
              ownerId: 'player',
              x: w.player.x,
              y: w.player.y,
              vx: Math.cos(angle) * 10,
              vy: Math.sin(angle) * 10,
              damage: 2000,
              radius: 20,
              color: heroData.color,
              life: 60,
            });
          }
        }
        w.player.ultimateCharge = 0;
        inputRef.current.useUltimate = false;
      }

      // 4. Update Bots
      w.bots.forEach(bot => {
        if (bot.health <= 0) return;
        const bHero = HERO_VERSIONS[bot.heroId];
        
        const isBotStunned = now < bot.stunnedUntil;

        // Reload Logic (Bot)
        if (bot.ammo < bot.maxAmmo) {
          bot.lastReloadProgress += 16.6;
          if (bot.lastReloadProgress >= bHero.stats.reloadTime) {
            bot.ammo++;
            bot.lastReloadProgress = 0;
          }
        }

        // Initialize AI Fields
        if (!(bot as any).aiInitialized) {
          (bot as any).aiInitialized = true;
          (bot as any).behaviorState = 'patrol';
          (bot as any).ambushBoostUntil = 0;
          (bot as any).lastPatrolTime = 0;
          (bot as any).patrolTargetX = bot.x;
          (bot as any).patrolTargetY = bot.y;
        }

        const isAmbushedBoosted = now < (bot as any).ambushBoostUntil;
        const ambushSpeedMult = isAmbushedBoosted ? 1.45 : 1.0;

        // AI: Target detection - find nearest enemy
        const enemies: Entity[] = [...w.bots.filter(b => b.team !== bot.team && b.health > 0), ...w.remotePlayers.filter(p => p.team !== bot.team && p.health > 0)];
        if (w.player.team !== bot.team && w.player.health > 0) enemies.push(w.player);

        let nearestEnemy: Entity | null = null;
        let minDist = Infinity;
        enemies.forEach(enemy => {
          const d = Math.hypot(enemy.x - bot.x, enemy.y - bot.y);
          // Vision detection: is in line-of-sight, OR is close, OR is attacking recently
          let canSee = !enemy.isHidden || d < 120;
          if (canSee && w.destructibles && isLineOfSightBlocked(bot.x, bot.y, enemy.x, enemy.y, w.destructibles)) {
            // Heard shot prediction: can smell bullet discharges if very close
            if (now - enemy.lastShotTime < 1200 && d < 320) {
              canSee = true;
            } else {
              canSee = false;
            }
          }
          if (canSee && d < minDist) {
            minDist = d;
            nearestEnemy = enemy;
          }
        });

        let moveX = 0;
        let moveY = 0;
        let speedFactor = 1.0;

        // STATE SELECTION AND PATHFINDING
        if (!nearestEnemy) {
          // Patrol and look for Bushes to lie in wait for Ambush
          if (bot.health < bot.maxHealth * 0.5) {
            (bot as any).behaviorState = 'retreat';
          } else {
            // Un-engaged healthy bots head towards bushes to setup ambushes
            let nearestBush: any = null;
            let minBushDist = Infinity;
            w.bushes.forEach(b => {
              const bCenterX = b.x + b.width / 2;
              const bCenterY = b.y + b.height / 2;
              const d = Math.hypot(bCenterX - bot.x, bCenterY - bot.y);
              if (d < minBushDist) {
                minBushDist = d;
                nearestBush = b;
              }
            });

            if (nearestBush && minBushDist < 750) {
              const bushCenterX = nearestBush.x + nearestBush.width / 2;
              const bushCenterY = nearestBush.y + nearestBush.height / 2;
              
              if (bot.isHidden) {
                (bot as any).behaviorState = 'ambush'; // Crouch and hide!
                moveX = 0;
                moveY = 0;
              } else {
                (bot as any).behaviorState = 'seeking_bush';
                const distToBush = Math.hypot(bushCenterX - bot.x, bushCenterY - bot.y);
                if (distToBush > 10) {
                  moveX = (bushCenterX - bot.x) / distToBush;
                  moveY = (bushCenterY - bot.y) / distToBush;
                }
              }
            } else {
              // Just patrol around
              (bot as any).behaviorState = 'patrol';
              if (now - (bot as any).lastPatrolTime > 2500 || Math.hypot((bot as any).patrolTargetX - bot.x, (bot as any).patrolTargetY - bot.y) < 30) {
                (bot as any).lastPatrolTime = now;
                (bot as any).patrolTargetX = bot.x + (Math.random() - 0.5) * 400;
                (bot as any).patrolTargetY = bot.y + (Math.random() - 0.5) * 400;
                // keep inside bounds
                (bot as any).patrolTargetX = Math.max(50, Math.min(ARENA_SIZE.width - 50, (bot as any).patrolTargetX));
                (bot as any).patrolTargetY = Math.max(50, Math.min(ARENA_SIZE.height - 50, (bot as any).patrolTargetY));
              }
              const dPatrol = Math.hypot((bot as any).patrolTargetX - bot.x, (bot as any).patrolTargetY - bot.y) || 1;
              moveX = ((bot as any).patrolTargetX - bot.x) / dPatrol;
              moveY = ((bot as any).patrolTargetY - bot.y) / dPatrol;
            }
          }
        } else {
          // We have a targets!
          const dx = nearestEnemy.x - bot.x;
          const dy = nearestEnemy.y - bot.y;

          // Spring an ambush if we were hiding in a bush
          if (bot.isHidden && ((bot as any).behaviorState === 'ambush' || (bot as any).behaviorState === 'patrol' || (bot as any).behaviorState === 'seeking_bush')) {
            (bot as any).ambushBoostUntil = now + 2500;
            (bot as any).behaviorState = 'ambushing'; // visual label AMBUSH
          }

          if (bot.health < bot.maxHealth * 0.42) {
            // RETREAT AND TAKE COVER!
            (bot as any).behaviorState = 'retreat';

            let nearestBush: any = null;
            let minBushDist = Infinity;
            w.bushes.forEach(b => {
              const bCenterX = b.x + b.width / 2;
              const bCenterY = b.y + b.height / 2;
              const d = Math.hypot(bCenterX - bot.x, bCenterY - bot.y);
              if (d < minBushDist) {
                minBushDist = d;
                nearestBush = b;
              }
            });

            if (nearestBush && minBushDist < 450) {
              const bushCenterX = nearestBush.x + nearestBush.width / 2;
              const bushCenterY = nearestBush.y + nearestBush.height / 2;
              
              if (bot.isHidden) {
                (bot as any).behaviorState = 'cover'; // Safe in cover, hold still and recover
                moveX = 0;
                moveY = 0;
              } else {
                const distToBush = Math.hypot(bushCenterX - bot.x, bushCenterY - bot.y);
                moveX = (bushCenterX - bot.x) / distToBush;
                moveY = (bushCenterY - bot.y) / distToBush;
                speedFactor = 1.15; // run fast
              }
            } else {
              // Direct kiting away
              moveX = -dx / minDist;
              moveY = -dy / minDist;
              speedFactor = 1.1;
            }
          } else {
            // Normal Pursuit & smart flanking orbit state
            (bot as any).behaviorState = isAmbushedBoosted ? 'ambush' : 'pursuit';

            const runTargetRange = bHero.stats.range;
            
            if (minDist > runTargetRange * 0.85) {
              // Move towards them
              moveX = dx / minDist;
              moveY = dy / minDist;
            } else if (minDist < 180) {
              // Too close, push back
              moveX = -dx / minDist;
              moveY = -dy / minDist;
              speedFactor = 0.9;
            } else {
              // Orbit sidebar with sway
              const perpX = -dy / minDist;
              const perpY = dx / minDist;
              
              const isEvenBot = bot.id.charCodeAt(bot.id.length - 1) % 2 === 0;
              const perpDirection = isEvenBot ? 1 : -1;
              const waveSway = Math.sin(now / 220) * 0.25;

              const sweetSpotRatio = (minDist - runTargetRange * 0.6) / runTargetRange;
              
              moveX = perpX * perpDirection * 0.75 + (dx / minDist) * sweetSpotRatio + perpX * waveSway;
              moveY = perpY * perpDirection * 0.75 + (dy / minDist) * sweetSpotRatio + perpY * waveSway;
            }

            // Seek walls for reloading if empty clip
            if (bot.ammo === 0) {
              let nearestWall: any = null;
              let wallMinD = Infinity;
              w.destructibles?.forEach(d => {
                if (d.health > 0) {
                  const dCenterX = d.x + d.width / 2;
                  const dCenterY = d.y + d.height / 2;
                  const dist = Math.hypot(dCenterX - bot.x, dCenterY - bot.y);
                  if (dist < wallMinD) {
                    wallMinD = dist;
                    nearestWall = d;
                  }
                }
              });

              if (nearestWall && wallMinD < 220) {
                (bot as any).behaviorState = 'cover';
                const wallCenterX = nearestWall.x + nearestWall.width / 2;
                const wallCenterY = nearestWall.y + nearestWall.height / 2;
                const dWall = Math.hypot(wallCenterX - bot.x, wallCenterY - bot.y) || 1;
                moveX = moveX * 0.4 + ((wallCenterX - bot.x) / dWall) * 0.6;
                moveY = moveY * 0.4 + ((wallCenterY - bot.y) / dWall) * 0.6;
              }
            }
          }
        }

        // ACTIVE PROJECTILE DODGE ENGINE (Balanced reflexes)
        let dodgeX = 0;
        let dodgeY = 0;
        let activeDodges = 0;
        w.projectiles.forEach(p => {
          if (p.ownerId !== bot.id) {
            const distToProj = Math.hypot(p.x - bot.x, p.y - bot.y);
            if (distToProj < 240) {
              const pSpeed = Math.hypot(p.vx, p.vy) || 1;
              const pDirX = p.vx / pSpeed;
              const pDirY = p.vy / pSpeed;

              const projToBotX = bot.x - p.x;
              const projToBotY = bot.y - p.y;

              const dotToBot = projToBotX * pDirX + projToBotY * pDirY;
              if (dotToBot > 0) {
                // Balance check: Dodge 55% of the time deterministically
                const charCodeSum = bot.id.charCodeAt(bot.id.length - 1) + p.id.charCodeAt(p.id.length - 1);
                if (charCodeSum % 10 < 5.5) {
                  // Perpendicular side-stepping force
                  const perpX = -pDirY;
                  const perpY = pDirX;

                  const sideDot = projToBotX * perpX + projToBotY * perpY;
                  const sideSign = sideDot >= 0 ? 1 : -1;

                  // Softened dodge strength (0.45 instead of 1.85)
                  const dodgeStrength = ((240 - distToProj) / 240) * 0.45;
                  dodgeX += perpX * sideSign * dodgeStrength;
                  dodgeY += perpY * sideSign * dodgeStrength;
                  activeDodges++;
                }
              }
            }
          }
        });

        if (activeDodges > 0) {
          // Weighted drift blend instead of absolute hijacking
          moveX = moveX * 0.75 + dodgeX * 0.25;
          moveY = moveY * 0.75 + dodgeY * 0.25;
          if ((bot as any).behaviorState !== 'retreat' && (bot as any).behaviorState !== 'cover') {
            (bot as any).behaviorState = 'dodge';
          }
        }

        // Normalize steering movement
        const finalMoveLength = Math.hypot(moveX, moveY);
        if (finalMoveLength > 0.05) {
          moveX /= finalMoveLength;
          moveY /= finalMoveLength;
        } else {
          moveX = 0;
          moveY = 0;
        }

        // Apply movement physics and resolve collisions
        if (!isBotStunned && (moveX !== 0 || moveY !== 0)) {
          const baseBotSpeed = (bot as any).isBossEntity ? (minDist > 300 ? 2.4 : 1.5) : bot.speed;
          const actualSpeed = baseBotSpeed * speedFactor * ambushSpeedMult;
          
          const potentialX = bot.x + moveX * actualSpeed;
          const potentialY = bot.y + moveY * actualSpeed;
          const size = (bot as any).isBossEntity ? 50 : 25;
          const resolved = resolveDestructibleCollisions(potentialX, potentialY, size, w.destructibles);
          
          bot.x = resolved.x;
          bot.y = resolved.y;
          
          if (nearestEnemy) {
            const rotDx = nearestEnemy.x - bot.x;
            const rotDy = nearestEnemy.y - bot.y;
            bot.rotation = Math.atan2(rotDx === 0 ? moveY : rotDy, rotDx === 0 ? moveX : rotDx) * (180 / Math.PI);
          } else if (moveX !== 0 || moveY !== 0) {
            bot.rotation = Math.atan2(moveY, moveX) * (180 / Math.PI);
          }
        }

        // Boss Scrooge Golden Parry Ability scheduler
        if (bot.heroId === 'aura-scrooge' && !isBotStunned && bot.health > 0) {
          if (!(bot as any).isParrying && (now - ((bot as any).lastParryTime || 0)) > 11000) {
            // Activate parry!
            (bot as any).isParrying = true;
            (bot as any).lastParryTime = now;
            setTimeout(() => {
              if (worldRef.current) {
                const targetBot = worldRef.current.bots.find(b => b.id === bot.id);
                if (targetBot) {
                  (targetBot as any).isParrying = false;
                }
              }
            }, 3000);
          }
        }

        // SHOOTING & FIRING SCHEDULER
        if ((bot as any).isBossEntity) {
          if (!isBotStunned && nearestEnemy && minDist < 900 && now - bot.lastShotTime > 1200 && bot.ammo > 0) {
            const baseAngle = Math.atan2(nearestEnemy.y - bot.y, nearestEnemy.x - bot.x);
            if (bot.heroId === 'aura-scrooge') {
              // Boss Scrooge Golden Shotgun Blast! (12 small projectiles)
              const numPellets = 12;
              const spreadAngle = 0.6; // wide cone
              const damageMult = bot.health < bot.maxHealth * 0.45 ? 1.15 : 1.0;
              for (let i = 0; i < numPellets; i++) {
                const angleOffset = -spreadAngle / 2 + (i / (numPellets - 1)) * spreadAngle;
                const angle = baseAngle + angleOffset;
                w.projectiles.push({
                  id: `p-boss-${bot.id}-${now}-${i}`,
                  ownerId: bot.id,
                  x: bot.x,
                  y: bot.y,
                  vx: Math.cos(angle) * (14 + Math.random() * 3),
                  vy: Math.sin(angle) * (14 + Math.random() * 3),
                  damage: Math.round(1100 * damageMult),
                  radius: 8,
                  color: '#fbbf24', // golden pellets
                  life: 30, // medium short range
                  isBossShot: true,
                } as any);
              }
            } else {
              const angles = [-0.25, 0, 0.25];
              angles.forEach((offset, idx) => {
                const angle = baseAngle + offset;
                w.projectiles.push({
                  id: `p-boss-${bot.id}-${now}-${idx}`,
                  ownerId: bot.id,
                  x: bot.x,
                  y: bot.y,
                  vx: Math.cos(angle) * 15,
                  vy: Math.sin(angle) * 15,
                  damage: 1200,
                  radius: 30,
                  color: '#f43f5e',
                  life: 60,
                  isBossShot: true,
                } as any);
              });
            }
            bot.lastShotTime = now;
            bot.ammo--;
            bot.lastReloadProgress = 0;
          }
        } else {
          // Regular intelligent bot fire
          const fireDelayMult = isAmbushedBoosted ? 0.45 : 1.0; // Fires 2.2x faster during Ambush!
          const canFire = !isBotStunned && nearestEnemy && minDist < bHero.stats.range;
          const fireAllowedByPhase = ((bot as any).behaviorState !== 'retreat' && (bot as any).behaviorState !== 'cover') || minDist < 340;

          if (canFire && fireAllowedByPhase && now - bot.lastShotTime > bHero.stats.fireDelay * fireDelayMult && bot.ammo > 0) {
            // Predictive tracking: lead the shot relative to target speed
            let targetX = nearestEnemy.x;
            let targetY = nearestEnemy.y;

            if ((nearestEnemy as any).vx || (nearestEnemy as any).vy) {
              const bulletVelocity = bot.heroId === 'smurfik' ? 14 : bot.heroId === 'capybara' ? 18 : 12;
              const bulletTime = minDist / bulletVelocity;
              targetX += ((nearestEnemy as any).vx || 0) * bulletTime * 0.15; // 15% look-ahead predictive leading
              targetY += ((nearestEnemy as any).vy || 0) * bulletTime * 0.15;
            }

            const predDx = targetX - bot.x;
            const predDy = targetY - bot.y;
            const predDist = Math.hypot(predDx, predDy) || 1;
            
            const fireDx = predDx / predDist;
            const fireDy = predDy / predDist;

            const bDam = bHero.stats.damage * (isAmbushedBoosted ? 1.25 : 1.0) * (bot.heroId === 'capybara' && (bot as any).capybaraUltUntil && now < (bot as any).capybaraUltUntil ? 1.4 : 1.0);
            
            w.projectiles.push({
              id: `p-${bot.id}-${now}`,
              ownerId: bot.id,
              x: bot.x,
              y: bot.y,
              vx: fireDx * (bot.heroId === 'smurfik' ? 14 : bot.heroId === 'capybara' ? 18 : 12),
              vy: fireDy * (bot.heroId === 'smurfik' ? 14 : bot.heroId === 'capybara' ? 18 : 12),
              damage: bDam,
              radius: bot.heroId === 'smurfik' ? 35 : bot.heroId === 'capybara' ? 14 : 10,
              color: bot.heroId === 'capybara' ? '#facc15' : bHero.color,
              life: bHero.stats.range / (bot.heroId === 'smurfik' ? 14 : bot.heroId === 'capybara' ? 18 : 12),
              isWindSlash: bot.heroId === 'smurfik',
              isMangoFlame: bot.heroId === 'capybara',
            });
            bot.lastShotTime = now;
            bot.ammo--;
            bot.lastReloadProgress = 0;
          }
        }
      });

      // 4.5 Mode Specific Updates (Coins)
      if (w.mode === GameMode.COIN_RUSH) {
        if (now % 100 === 0 && w.coins.length < 10) { // Spawn coin every few frames
          w.coins.push({
            id: `coin-${now}`,
            x: ARENA_SIZE.width / 2 + (Math.random() - 0.5) * 400,
            y: ARENA_SIZE.height / 2 + (Math.random() - 0.5) * 400,
          });
        }
        
        // Update team scores for Coin Rush
        if (w.scores) {
          w.scores.blue = [w.player, ...w.bots, ...w.remotePlayers].filter(e => e.team === 'blue').reduce((sum, e) => sum + e.coins, 0);
          w.scores.red = [...w.bots, ...w.remotePlayers].filter(e => e.team === 'red').reduce((sum, e) => sum + e.coins, 0);
        }
      }

      // Host Updates Room State
      const syncInterval = w.mode === GameMode.BREAKTHROUGH ? 150 : 1000;
      if (multiplayer?.isHost && now - lastRoomSyncRef.current > syncInterval) {
        const updatePayload: any = {
          scores: w.scores || { blue: 0, red: 0 },
          timeLeft: w.timeLeft,
        };
        
        if (w.mode === GameMode.BREAKTHROUGH) {
          updatePayload.wave = (w as any).wave || 0;
          updatePayload.mangoPoints = (w as any).mangoPoints || 0;
          updatePayload.bargeOpen = (w as any).bargeOpen || false;
          updatePayload.enemiesSync = w.bots.map(b => ({
            id: b.id,
            x: Math.round(b.x),
            y: Math.round(b.y),
            hp: b.health,
            maxHp: b.maxHealth,
            heroId: b.heroId,
            rot: Math.round(b.rotation),
            isParrying: (b as any).isParrying || false,
          }));
        }
        
        updateRoomState(multiplayer.roomId, updatePayload);
        lastRoomSyncRef.current = now;
      }

      // Player Sync (Outbound)
      if (multiplayer?.roomId && now - lastPlayerSyncRef.current > 100) {
         updatePlayerState(multiplayer.roomId, multiplayer.userId, {
            x: w.player.x,
            y: w.player.y,
            rotation: w.player.rotation,
            health: w.player.health,
            maxHealth: w.player.maxHealth,
            ammo: w.player.ammo,
            coins: w.player.coins,
            team: w.player.team
         });
         lastPlayerSyncRef.current = now;
      }

      // Update Timer
      if (w.timeLeft !== undefined && w.timeLeft > 0) {
        if (Math.floor(time / 1000) !== Math.floor((time - 16) / 1000)) {
           w.timeLeft -= 1;
        }
      }

      // Coin Collection
      const allEntities = [w.player, ...w.bots, ...w.remotePlayers];
      w.coins = w.coins.filter(coin => {
        for (const entity of allEntities) {
          if (entity.health <= 0) continue;
          const dist = Math.hypot(entity.x - coin.x, entity.y - coin.y);
          if (dist < 50) {
            entity.coins++;
            // Passive for Sigeon
            if (entity.heroId === 'sigeon') {
              entity.health = Math.min(entity.maxHealth, entity.health + 200);
            }
            return false;
          }
        }
        return true;
      });

      // 5. Update Projectiles
      w.projectiles = w.projectiles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life--;
        if (p.life <= 0) return false;

        if (w.destructibles) {
          for (const d of w.destructibles) {
            if (d.health <= 0) continue;
            const closestX = Math.max(d.x, Math.min(p.x, d.x + d.width));
            const closestY = Math.max(d.y, Math.min(p.y, d.y + d.height));
            const distX = p.x - closestX;
            const distY = p.y - closestY;
            const dist = Math.hypot(distX, distY);
            if (dist < p.radius + 15) {
              d.health -= p.damage;
              return false;
            }
          }
        }
        
        const owner = allEntities.find(e => e.id === p.ownerId);
        if (!owner) return false;

        const targets = allEntities.filter(e => e.team !== owner.team && e.health > 0);
        
        for (const target of targets) {
          if (p.isPiercingUlt) {
            if (!p.hitEntityIds) {
              p.hitEntityIds = [];
            }
            if (p.hitEntityIds.includes(target.id)) {
              continue;
            }
          }
          const dist = Math.hypot(p.x - target.x, p.y - target.y);
          const hitRange = (p.radius || 10) + 18;
          if (dist < hitRange) {
            if (p.isPiercingUlt) {
              p.hitEntityIds?.push(target.id);
            }
            let finalDamage = p.damage;
            if (target.heroId === 'alcatrasnic') {
              finalDamage *= 0.9;
            }
            if ((target as any).isParrying) {
              // Parried! Destroy the projectile and take zero damage.
              return false;
            }
            if (target === w.player && (target as any).isShielded) {
              finalDamage *= 0.4;
            }
            target.health -= finalDamage;
            target.lastDamageTime = now;

            // Passive of Mango Phonk: +3 HP per hit landed
            if (owner && owner.heroId === 'capybara') {
              owner.health = Math.min(owner.maxHealth, owner.health + 3);
            }

            // Seliuk Stun Logic
            if ((p as any).isStun) {
              target.stunnedUntil = now + 2000; // 2 second stun
            }

            // Seliuk Explosive Logic (Juice Boxes)
            const projectileOwner = allEntities.find(e => e.id === p.ownerId);
            if (projectileOwner?.heroId === 'seliuk' && !(p as any).isExploded) {
              (p as any).isExploded = true; // Prevent recursive explosion if we used a loop
              allEntities.forEach(e => {
                if (e.team !== projectileOwner.team && e !== target) {
                  const eDist = Math.hypot(e.x - p.x, e.y - p.y);
                  if (eDist < 120) { // AoE Radius
                    e.health -= finalDamage * 0.5; // Splash damage is 50%
                    e.lastDamageTime = now;
                    if ((p as any).isStun) e.stunnedUntil = now + 2000;
                  }
                }
              });
            }
            
            if (target.health <= 0) {
               if (w.mode === GameMode.BOUNTY && w.scores) {
                 w.scores[owner.team] += 1;
               } else if (w.mode === GameMode.COIN_RUSH && target.coins > 0) {
                 // Drop coins where they died
                 for (let i = 0; i < target.coins; i++) {
                   w.coins.push({
                     id: `coin-drop-${now}-${target.id}-${i}`,
                     x: target.x + (Math.random() - 0.5) * 60,
                     y: target.y + (Math.random() - 0.5) * 60,
                   });
                 }
                 target.coins = 0;
               }
            }

            if (p.ownerId === 'player') {
              w.player.ultimateCharge = Math.min(100, w.player.ultimateCharge + HERO_VERSIONS[w.player.heroId].stats.ultimateChargeRate);
            }
            if (p.isPiercingUlt) {
              continue;
            }
            return false;
          }
        }
        return true;
      });

      w.bots = w.bots.filter(b => b.health > 0);
      
      if (w.mode === GameMode.BOSS_FIGHT && w.player.health <= 0) {
        const aliveAlly = w.remotePlayers.find(p => p.health > 0);
        if (aliveAlly) {
          w.camera.x = aliveAlly.x;
          w.camera.y = aliveAlly.y;
        } else {
          w.camera.x = w.player.x;
          w.camera.y = w.player.y;
        }
      } else {
        w.camera.x = w.player.x;
        w.camera.y = w.player.y;
      }

      setWorld({ ...w });
      requestRef.current = requestAnimationFrame(updateRef.current!);
    };
  }, [isFinished, skinColor]); // Redefine only when essential

  useEffect(() => {
    if (updateRef.current) {
      requestRef.current = requestAnimationFrame(updateRef.current);
    }
    return () => cancelAnimationFrame(requestRef.current);
  }, [isFinished]);

  return { world, inputRef };
}
