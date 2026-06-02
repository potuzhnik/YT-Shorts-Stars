/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export enum GameState {
  MENU = 'MENU',
  COLLECTION = 'COLLECTION',
  BATTLE = 'BATTLE',
  UPGRADE = 'UPGRADE',
  TUTORIAL = 'TUTORIAL',
  SHOP = 'SHOP',
  DETAILS = 'DETAILS',
  TROPHY_ROAD = 'TROPHY_ROAD',
  BATTLE_PASS = 'BATTLE_PASS',
}

export enum GameMode {
  SOLO_SHOWDOWN = 'SOLO_SHOWDOWN',
  COIN_RUSH = 'COIN_RUSH',
  BOUNTY = 'BOUNTY',
  BOSS_FIGHT = 'BOSS_FIGHT',
  DUO_SHOWDOWN = 'DUO_SHOWDOWN',
  BREAKTHROUGH = 'BREAKTHROUGH',
}

export type HeroId = 'goose-einstein' | 'chicken' | 'sigeon' | 'svinobomba' | 'alcatrasnic' | 'bimbolit' | 'oreshki' | 'svin' | 'seliuk' | 'aura-tom' | 'smurfik' | 'capybara' | 'pes-patron' | 'aura-scrooge';

export interface HeroStats {
  health: number;
  maxHealth: number;
  damage: number;
  speed: number;
  range: number;
  fireDelay: number; // ms between individual shots
  reloadTime: number; // ms to refill one ammo slot
  ammoCapacity: number;
  ultimateChargeRate: number; // percentage per hit
}

export interface HeroAbility {
  name: string;
  description: string;
  cooldown: number; // ms
}

export interface Skin {
  id: string;
  name: string;
  image: string;
  cost: number;
}

export interface Hero {
  id: HeroId;
  name: string;
  title: string;
  level: number;
  coinsToUpgrade: number;
  coinsToUnlock: number;
  stats: HeroStats;
  ability: HeroAbility;
  ultimate: HeroAbility;
  passive: string;
  color: string;
  image?: string;
  unlocked: boolean;
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  radius: number;
  color: string;
  life: number; // time remaining
  isWindSlash?: boolean;
  isMangoFlame?: boolean;
  isPiercingUlt?: boolean;
  hitEntityIds?: string[];
}

export interface Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  rotation: number;
  health: number;
  maxHealth: number;
  speed: number;
  isBot: boolean;
  heroId: HeroId;
  ammo: number;
  maxAmmo: number;
  lastReloadProgress: number; // ms since last ammo refill started
  ultimateCharge: number; // 0 to 100
  lastShotTime: number;
  stunnedUntil: number; // timestamp
  abilityCooldown: number;
  lastDamageTime: number;
  isHidden: boolean;
  team: 'blue' | 'red' | 'green' | 'yellow';
  coins: number;
}

export interface Bush {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Destructible {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  health: number;
  maxHealth: number;
  type: 'crate' | 'ruins';
}

export interface GameCoin {
  id: string;
  x: number;
  y: number;
}

export interface GameWorld {
  width: number;
  height: number;
  player: Entity;
  bots: Entity[];
  remotePlayers: Entity[];
  projectiles: Projectile[];
  bushes: Bush[];
  destructibles?: Destructible[];
  coins: GameCoin[];
  camera: { x: number; y: number };
  mode: GameMode;
  timeLeft?: number;
  scores?: { blue: number; red: number };
  roomId?: string;
  isHost?: boolean;
  wave?: number;
  waveState?: string;
  waveTimer?: number;
  mangoPoints?: number;
  bargeOpen?: boolean;
}

export interface UserData {
  coins: number;
  unlockedHeroIds: HeroId[];
  heroLevels: Record<HeroId, number>;
  heroSkins: Record<HeroId, string>; // color hex
  ownedSkinIds: Record<HeroId, string[]>;
  selectedSkinId: Record<HeroId, string | null>;
  selectedHeroId: HeroId;
  hasSeenTutorial: boolean;
  trophies: number;
  claimedTrophyMilestones: number[];
  svinemarks?: number;
  claimedBattlepassLevels?: number[];
  mangoPoints?: number;
  claimedBattlepassSeason2Levels?: number[];
  auraCrates?: number;
  tomPearlCrates?: number;
  mangoCrates?: number;
  potuzhnoCrates?: number;
  prestigeTokens?: number;
  capybaraPrestigeTokens?: number;
  heroPrestige?: Partial<Record<HeroId, number>>;
  dailyQuests?: DailyQuest[];
  lastQuestsRefresh?: string;
  adminCoinMultiplier?: number;
  adminCoinExpr?: number;
  adminLuckMultiplier?: number;
  adminLuckExpr?: number;
}

export interface DailyQuest {
  id: string;
  description: string;
  type: 'wins' | 'kills';
  target: number;
  progress: number;
  claimed: boolean;
  reward: {
    type: 'coins' | 'trophies' | 'svinemarks' | 'crate_aura' | 'crate_pearl' | 'crate_mango' | 'crate_potuzhno';
    amount: number;
  };
  isHardcore: boolean;
}
