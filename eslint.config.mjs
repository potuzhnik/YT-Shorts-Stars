/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { HeroId } from '../types';

export interface RankInfo {
  name: string;
  minTrophies: number;
  color: string; // CSS styling helper classes (text/border/bg)
  bgGradient: string; // Tailwind bg-gradient classes
  icon: string; // Emoji representing rank
}

export const RANKS: RankInfo[] = [
  { name: 'Wood I', minTrophies: 0, color: 'text-amber-800 border-amber-800/20 bg-amber-800/10', bgGradient: 'from-amber-900 to-yellow-950', icon: '🪵' },
  { name: 'Wood II', minTrophies: 100, color: 'text-amber-700 border-amber-700/20 bg-amber-700/10', bgGradient: 'from-amber-800 to-yellow-900', icon: '🪵' },
  { name: 'Bronze I', minTrophies: 200, color: 'text-amber-600 border-amber-600/20 bg-amber-600/10', bgGradient: 'from-amber-600 to-amber-950', icon: '🥉' },
  { name: 'Bronze II', minTrophies: 350, color: 'text-amber-400 border-amber-400/20 bg-amber-400/10', bgGradient: 'from-amber-500 to-amber-900', icon: '🥉' },
  { name: 'Silver I', minTrophies: 500, color: 'text-slate-300 border-slate-300/20 bg-slate-300/10', bgGradient: 'from-slate-500 to-slate-950', icon: '🥈' },
  { name: 'Silver II', minTrophies: 700, color: 'text-slate-200 border-slate-200/20 bg-slate-200/10', bgGradient: 'from-slate-400 to-slate-900', icon: '🥈' },
  { name: 'Gold I', minTrophies: 900, color: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10', bgGradient: 'from-yellow-500 to-yellow-950', icon: '🥇' },
  { name: 'Gold II', minTrophies: 1200, color: 'text-yellow-300 border-yellow-300/20 bg-yellow-300/10', bgGradient: 'from-yellow-400 to-yellow-900', icon: '🥇' },
  { name: 'Diamond I', minTrophies: 1500, color: 'text-cyan-400 border-cyan-400/20 bg-cyan-400/10', bgGradient: 'from-cyan-500 to-blue-950', icon: '💎' },
  { name: 'Diamond II', minTrophies: 1900, color: 'text-cyan-300 border-cyan-300/20 bg-cyan-300/10', bgGradient: 'from-cyan-400 to-blue-900', icon: '💎' },
  { name: 'Mythic I', minTrophies: 2300, color: 'text-purple-400 border-purple-400/20 bg-purple-400/10', bgGradient: 'from-purple-500 to-indigo-950', icon: '🔮' },
  { name: 'Mythic II', minTrophies: 2800, color: 'text-pink-400 border-pink-400/20 bg-pink-400/10', bgGradient: 'from-pink-500 to-rose-950', icon: '🔮' },
  { name: 'Masters', minTrophies: 3500, color: 'text-rose-400 border-rose-400/20 bg-rose-400/10 animate-pulse', bgGradient: 'from-rose-500 via-pink-600 to-violet-950', icon: '👑' },
];

export function getRank(trophies: number): RankInfo {
  let matched = RANKS[0];
  for (const rank of RANKS) {
    if (trophies >= rank.minTrophies) {
      matched = rank;
    } else {
      break;
    }
  }
  return matched;
}

export function getNextRank(trophies: number): RankInfo | null {
  for (const rank of RANKS) {
    if (rank.minTrophies > trophies) {
      return rank;
    }
  }
  return null;
}

export interface TrophyMilestone {
  trophies: number;
  rewardType: 'coins' | 'crate' | 'hero' | 'crate_pearl';
  rewardValue: number;
  label: string;
  heroId?: HeroId;
}

export const TROPHY_ROAD: TrophyMilestone[] = [
  { trophies: 50, rewardType: 'coins', rewardValue: 150, label: 'Starter Cache' },
  { trophies: 150, rewardType: 'crate', rewardValue: 1, label: 'Aura Crate Reward' },
  { trophies: 300, rewardType: 'coins', rewardValue: 300, label: 'Trophy Purse' },
  { trophies: 500, rewardType: 'crate', rewardValue: 1, label: 'Aura Crate Reward' },
  { trophies: 750, rewardType: 'coins', rewardValue: 500, label: 'Fighter Stash' },
  { trophies: 1000, rewardType: 'crate', rewardValue: 1, label: 'Victory Aura Box' },
  { trophies: 1300, rewardType: 'coins', rewardValue: 750, label: 'Elite Bundle' },
  { trophies: 1600, rewardType: 'crate', rewardValue: 1, label: 'Legendary Mystic Crate' },
  { trophies: 2000, rewardType: 'coins', rewardValue: 1200, label: 'Championship Vault' },
  { trophies: 2500, rewardType: 'hero', rewardValue: 1, label: 'Smurfik', heroId: 'smurfik' },
  { trophies: 3000, rewardType: 'coins', rewardValue: 2000, label: 'Godlike Treasury' },
  { trophies: 3500, rewardType: 'crate_pearl', rewardValue: 2, label: 'Masters Pearl Box (x2)' },
  { trophies: 4000, rewardType: 'coins', rewardValue: 3000, label: 'Ultimate Golden Cache' },
  { trophies: 4500, rewardType: 'crate_pearl', rewardValue: 2, label: 'Prestige Pearl Crate (x2)' },
  { trophies: 5000, rewardType: 'hero', rewardValue: 1, label: 'Pes Patron', heroId: 'pes-patron' },
];

