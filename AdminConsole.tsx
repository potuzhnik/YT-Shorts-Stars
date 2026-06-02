import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft, 
  Sparkles, 
  Coins, 
  Gift, 
  Star, 
  Lock, 
  CheckCircle, 
  Award, 
  Loader2 
} from 'lucide-react';
import { UserData, HeroId } from '../../types';
import { HERO_VERSIONS, HERO_SKINS } from '../../constants';
import { BATTLEPASS_LEVELS, BATTLEPASS_S2_LEVELS, getBattlepassLevel, getMarksForNextLevel, BattlepassLevelInfo } from '../../utils/battlepass';

interface BattlePassProps {
  userData: UserData;
  updateUserData: (updater: (prev: UserData) => UserData) => void;
  onBack: () => void;
}

interface DropResult {
  type: 'hero' | 'skin' | 'upgrade' | 'coins';
  heroId?: HeroId;
  id?: string;
  name: string;
  image?: string;
  emoji: string;
  amount?: number;
  levelFrom?: number;
  levelTo?: number;
}

export default function BattlePass({ userData, updateUserData, onBack }: BattlePassProps) {
  const [selectedSeason, setSelectedSeason] = useState<1 | 2>(2);
  const [unboxingState, setUnboxingState] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [revealedDrop, setRevealedDrop] = useState<DropResult | null>(null);
  const [claimingLevel, setClaimingLevel] = useState<number | null>(null);

  const isSeason2 = selectedSeason === 2;
  const activeLevels = isSeason2 ? BATTLEPASS_S2_LEVELS : BATTLEPASS_LEVELS;
  const currentPoints = isSeason2 ? (userData.mangoPoints || 0) : (userData.svinemarks || 0);
  const currentBPLevel = getBattlepassLevel(currentPoints, activeLevels);
  const claimedLevels = isSeason2 ? (userData.claimedBattlepassSeason2Levels || []) : (userData.claimedBattlepassLevels || []);

  const { currentMarksInLevel, totalNeededForLevel, nextLevel } = getMarksForNextLevel(currentPoints, activeLevels);
  
  // Percent through current level (or 100% if fully complete)
  const progressPercent = nextLevel 
    ? Math.min(100, Math.max(0, (currentMarksInLevel / totalNeededForLevel) * 100))
    : 100;

  const handleClaim = (lvl: BattlepassLevelInfo) => {
    if (claimedLevels.includes(lvl.level)) return; // Already claimed
    if (currentPoints < lvl.svinemarksRequired) return; // Locked

    setClaimingLevel(lvl.level);
    setUnboxingState('opening');

    const claimField = isSeason2 ? 'claimedBattlepassSeason2Levels' : 'claimedBattlepassLevels';

    setTimeout(() => {
      let selectedDrop: DropResult | null = null;

      if (lvl.rewardType === 'coins') {
        const val = lvl.rewardValue as number;
        selectedDrop = {
          type: 'coins',
          name: `${val} Gold Coins`,
          emoji: '🪙',
          amount: val,
        };

        // Update user state
        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          return {
            ...prev,
            coins: prev.coins + val,
            [claimField]: [...claimed, lvl.level],
          };
        });

      } else if (lvl.rewardType === 'hero') {
        const hId = lvl.rewardValue as HeroId;
        const hero = HERO_VERSIONS[hId];
        selectedDrop = {
          type: 'hero',
          heroId: hId,
          name: hero.name,
          emoji: '🍊',
          image: hero.image,
        };

        // Update user state
        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          const unlocked = prev.unlockedHeroIds.includes(hId)
            ? prev.unlockedHeroIds
            : [...prev.unlockedHeroIds, hId];
          return {
            ...prev,
            unlockedHeroIds: unlocked,
            [claimField]: [...claimed, lvl.level],
          };
        });

      } else if (lvl.rewardType === 'crate') {
        // Roll standard crate rewards
        const r = Math.random();
        const lockedHeroIds = (Object.keys(HERO_VERSIONS) as HeroId[]).filter(
          id => !userData.unlockedHeroIds.includes(id) && id !== 'smurfik' && id !== 'capybara' && id !== 'pes-patron'
        );

        const unownedSkins: { heroId: HeroId; id: string; name: string; image: string }[] = [];
        Object.entries(HERO_SKINS).forEach(([heroId, skins]) => {
          skins.forEach(skin => {
            const isOwned = userData.ownedSkinIds[heroId as HeroId]?.includes(skin.id);
            if (!isOwned) {
              unownedSkins.push({
                heroId: heroId as HeroId,
                id: skin.id,
                name: skin.name,
                image: skin.image
              });
            }
          });
        });

        // 15% Hero, 40% Skin, otherwise Coins
        if (r < 0.15 && lockedHeroIds.length > 0) {
          const targetId = lockedHeroIds[Math.floor(Math.random() * lockedHeroIds.length)];
          const hero = HERO_VERSIONS[targetId];
          selectedDrop = {
            type: 'hero',
            heroId: targetId,
            id: targetId,
            name: hero.name,
            image: hero.image,
            emoji: '🔥',
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            return {
              ...prev,
              unlockedHeroIds: prev.unlockedHeroIds.includes(targetId) ? prev.unlockedHeroIds : [...prev.unlockedHeroIds, targetId],
              [claimField]: [...claimed, lvl.level],
            };
          });

        } else if (r < 0.55 && unownedSkins.length > 0) {
          const skin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
          selectedDrop = {
            type: 'skin',
            heroId: skin.heroId,
            id: skin.id,
            name: skin.name,
            image: skin.image,
            emoji: '✨',
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            const prevOwned = prev.ownedSkinIds[skin.heroId] || [];
            const updatedSkins = prevOwned.includes(skin.id) ? prevOwned : [...prevOwned, skin.id];
            return {
              ...prev,
              ownedSkinIds: {
                ...prev.ownedSkinIds,
                [skin.heroId]: updatedSkins,
              },
              [claimField]: [...claimed, lvl.level],
            };
          });

        } else {
          // Coins drop
          const goldAmount = Math.floor(Math.random() * 200) + 100;
          selectedDrop = {
            type: 'coins',
            name: `${goldAmount} Gold Coins`,
            emoji: '🪙',
            amount: goldAmount,
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            return {
              ...prev,
              coins: prev.coins + goldAmount,
              [claimField]: [...claimed, lvl.level],
            };
          });
        }
      } else if (lvl.rewardType === 'crate_pearl') {
        const r = Math.random();
        const lockedHeroIds = (Object.keys(HERO_VERSIONS) as HeroId[]).filter(
          id => !userData.unlockedHeroIds.includes(id) && id !== 'smurfik' && id !== 'capybara' && id !== 'pes-patron'
        );

        const unownedSkins: { heroId: HeroId; id: string; name: string; image: string }[] = [];
        Object.entries(HERO_SKINS).forEach(([heroId, skins]) => {
          skins.forEach(skin => {
            const isOwned = userData.ownedSkinIds[heroId as HeroId]?.includes(skin.id);
            if (!isOwned) {
              unownedSkins.push({
                heroId: heroId as HeroId,
                id: skin.id,
                name: skin.name,
                image: skin.image
              });
            }
          });
        });

        // Boosted Pearl Crate drops inside BP: 35% hero, 35% skin, 20% upgrade, 10% coins
        if (r < 0.35 && lockedHeroIds.length > 0) {
          const targetId = lockedHeroIds[Math.floor(Math.random() * lockedHeroIds.length)];
          const hero = HERO_VERSIONS[targetId];
          selectedDrop = {
            type: 'hero',
            heroId: targetId,
            id: targetId,
            name: hero.name,
            image: hero.image,
            emoji: '🔥',
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            return {
              ...prev,
              unlockedHeroIds: prev.unlockedHeroIds.includes(targetId) ? prev.unlockedHeroIds : [...prev.unlockedHeroIds, targetId],
              [claimField]: [...claimed, lvl.level],
            };
          });
        } else if (r < 0.70 && unownedSkins.length > 0) {
          const skin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
          selectedDrop = {
            type: 'skin',
            heroId: skin.heroId,
            id: skin.id,
            name: skin.name,
            image: skin.image,
            emoji: '✨',
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            const prevOwned = prev.ownedSkinIds[skin.heroId] || [];
            const updatedSkins = prevOwned.includes(skin.id) ? prevOwned : [...prevOwned, skin.id];
            return {
              ...prev,
              ownedSkinIds: {
                ...prev.ownedSkinIds,
                [skin.heroId]: updatedSkins,
              },
              [claimField]: [...claimed, lvl.level],
            };
          });
        } else if (r < 0.90 && userData.unlockedHeroIds.length > 0) {
          const targetId = userData.unlockedHeroIds[Math.floor(Math.random() * userData.unlockedHeroIds.length)];
          const curLvl = userData.heroLevels[targetId] || 1;
          selectedDrop = {
            type: 'upgrade',
            heroId: targetId,
            id: targetId,
            name: HERO_VERSIONS[targetId]?.name || targetId,
            image: HERO_VERSIONS[targetId]?.image,
            emoji: '💪',
            levelFrom: curLvl,
            levelTo: curLvl + 1,
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            const curLvl = prev.heroLevels[targetId] || 1;
            return {
              ...prev,
              heroLevels: {
                ...prev.heroLevels,
                [targetId]: curLvl + 1,
              },
              [claimField]: [...claimed, lvl.level],
            };
          });
        } else {
          const goldAmount = Math.floor(Math.random() * 1000) + 1500;
          selectedDrop = {
            type: 'coins',
            name: `${goldAmount} Gold Coins`,
            emoji: '🪙',
            amount: goldAmount,
          };

          updateUserData(prev => {
            const claimed = (prev[claimField] || []) as number[];
            return {
              ...prev,
              coins: prev.coins + goldAmount,
              [claimField]: [...claimed, lvl.level],
            };
          });
        }
      } else if (lvl.rewardType === 'skin') {
        const skinId = lvl.rewardValue as string;
        let targetHeroId: HeroId = 'aura-tom';
        let skinName = 'Royal Tom';
        let skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(30).png?raw=true';
        let skinEmoji = '👑';

        if (skinId === 'dino-alcatrasnic') {
          targetHeroId = 'alcatrasnic';
          skinName = 'Dino alcatrasnic';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(37).png?raw=true';
          skinEmoji = '🦖';
        } else if (skinId === 'explorer-patron') {
          targetHeroId = 'pes-patron';
          skinName = 'Explorer Patron';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(38).png?raw=true';
          skinEmoji = '🧭';
        } else if (skinId === 'hunter-tom') {
          targetHeroId = 'aura-tom';
          skinName = 'Hunter Tom';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(32).png?raw=true';
          skinEmoji = '🏹';
        } else if (skinId === 'tropical-tom') {
          targetHeroId = 'aura-tom';
          skinName = 'Tropical Tom';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(36).png?raw=true';
          skinEmoji = '🌴';
        } else if (skinId === 'divesuit-goose') {
          targetHeroId = 'goose-einstein';
          skinName = 'Divesuit goose';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(40).png?raw=true';
          skinEmoji = '🤿';
        } else if (skinId === 'tropical-svin') {
          targetHeroId = 'svin';
          skinName = 'Tropical svin';
          skinImage = 'https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(39).png?raw=true';
          skinEmoji = '🌴';
        }

        selectedDrop = {
          type: 'skin',
          heroId: targetHeroId,
          id: skinId,
          name: skinName,
          image: skinImage,
          emoji: skinEmoji,
        };

        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          const prevOwned = prev.ownedSkinIds[targetHeroId] || [];
          const updatedSkins = prevOwned.includes(skinId) ? prevOwned : [...prevOwned, skinId];
          return {
            ...prev,
            ownedSkinIds: {
              ...prev.ownedSkinIds,
              [targetHeroId]: updatedSkins,
            },
            [claimField]: [...claimed, lvl.level],
          };
        });
      } else if (lvl.rewardType === 'crate_pearl_item') {
        const count = lvl.rewardValue as number;
        selectedDrop = {
          type: 'coins',
          name: `${count} Pearl Crate Roll${count > 1 ? 's' : ''}`,
          emoji: '🐚',
          amount: count,
        };

        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          return {
            ...prev,
            tomPearlCrates: (prev.tomPearlCrates || 0) + count,
            [claimField]: [...claimed, lvl.level],
          };
        });
      } else if (lvl.rewardType === 'crate_mango_item') {
        const count = lvl.rewardValue as number;
        selectedDrop = {
          type: 'coins',
          name: `${count} Mango Crate Roll${count > 1 ? 's' : ''}`,
          emoji: '🥭',
          amount: count,
        };

        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          return {
            ...prev,
            mangoCrates: (prev.mangoCrates || 0) + count,
            [claimField]: [...claimed, lvl.level],
          };
        });
      } else if (lvl.rewardType === 'capybara_prestige') {
        const count = lvl.rewardValue as number;
        selectedDrop = {
          type: 'coins',
          name: `${count} Capybara Prestige Token${count > 1 ? 's' : ''}`,
          emoji: '👑',
          amount: count,
        };

        updateUserData(prev => {
          const claimed = (prev[claimField] || []) as number[];
          return {
            ...prev,
            capybaraPrestigeTokens: (prev.capybaraPrestigeTokens || 0) + count,
            [claimField]: [...claimed, lvl.level],
          };
        });
      }

      if (selectedDrop) {
        setRevealedDrop(selectedDrop);
        setUnboxingState('revealed');
      } else {
        setUnboxingState('idle');
        setClaimingLevel(null);
      }
    }, 1500);
  };

  const handleCloseUnboxing = () => {
    setUnboxingState('idle');
    setRevealedDrop(null);
    setClaimingLevel(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 md:p-8 flex flex-col relative select-none overflow-x-hidden animate-fade-in">
      {/* Background Decorative Highlights */}
      <div className={`absolute top-0 right-0 w-80 h-80 ${isSeason2 ? 'bg-orange-600/10' : 'bg-cyan-600/10'} rounded-full blur-[120px] pointer-events-none -mr-32 -mt-32`} />
      <div className={`absolute bottom-0 left-0 w-80 h-80 ${isSeason2 ? 'bg-amber-600/10' : 'bg-purple-600/10'} rounded-full blur-[120px] pointer-events-none -ml-32 -mb-32`} />

      {/* Header Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10 mb-4 animate-slide-down">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-white/5 hover:border-white/10 active:scale-95 transition-all text-sm font-bold text-gray-300 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Leave Battlepass</span>
        </button>

        <div className="flex items-center gap-2 bg-slate-900 px-4 py-2 rounded-xl border border-white/5 font-extrabold text-sm">
          <span className="text-yellow-400">🪙</span>
          <span className="text-yellow-400">{userData.coins}</span>
        </div>
      </div>

      {/* Season Selector Tabs */}
      <div className="w-full max-w-5xl mx-auto flex gap-3 mb-6 z-10 animate-fade-in-delayed">
        <button
          onClick={() => setSelectedSeason(1)}
          className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-wider text-xs md:text-sm transition-all border ${
            !isSeason2
              ? 'bg-gradient-to-r from-cyan-600 to-teal-700 text-white border-cyan-400 shadow-lg shadow-cyan-950/20'
              : 'bg-slate-900/40 text-gray-400 border-white/5 hover:bg-slate-900 hover:text-gray-200'
          }`}
        >
          Season 1: Svinemarks
        </button>
        <button
          onClick={() => setSelectedSeason(2)}
          className={`flex-1 py-3 px-4 rounded-xl font-black uppercase tracking-wider text-xs md:text-sm transition-all border ${
            isSeason2
              ? 'bg-gradient-to-r from-amber-600 to-orange-700 text-white border-orange-400 shadow-lg shadow-orange-950/20 animate-pulse'
              : 'bg-slate-900/40 text-gray-400 border-white/5 hover:bg-slate-900 hover:text-gray-200'
          }`}
        >
          🥭 Season 2: Mango Points
        </button>
      </div>

      {/* Warning message about Season 1 disappearing in 1 week */}
      <div className="w-full max-w-5xl mx-auto z-10 mb-6 bg-red-950/40 border border-red-500/30 rounded-2xl py-3.5 px-4 flex items-center justify-center gap-2 hover:bg-red-950/55 transition-colors animate-pulse text-xs md:text-sm text-red-200 font-extrabold shadow-lg shadow-red-950/20">
        <span className="text-base">⚠️</span>
        <span>Notice: <span className="text-yellow-400 font-black uppercase tracking-wider">Season 1 battlepass disappearing in 1 week!</span> Be sure to claim your rewards!</span>
      </div>

      {/* Hero Banner Banner Section */}
      <div className={`w-full max-w-5xl mx-auto z-10 mb-8 bg-gradient-to-r ${
        isSeason2 
          ? 'from-amber-600 via-orange-700 to-yellow-800 border-orange-400/20' 
          : 'from-cyan-600 via-teal-700 to-emerald-800 border-cyan-400/20'
      } rounded-[2rem] p-6 md:p-10 relative overflow-hidden shadow-2xl border`}>
        <div className="absolute inset-0 bg-transparent flex justify-end items-center opacity-30 select-none pointer-events-none">
          <Award className="w-96 h-96 text-white scale-125 translate-x-24 rotate-12" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6 justify-between">
          <div className="text-center md:text-left">
            <div className={`bg-white/10 mt-1 border border-white/20 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest ${
              isSeason2 ? 'text-amber-200' : 'text-cyan-200'
            } mb-4`}>
              <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
              <span>{isSeason2 ? 'Mango Arena Pass (Season 2)' : 'Svinemark Arena Pass (Season 1)'}</span>
            </div>
            <h1 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter leading-none mb-2">
              {isSeason2 ? 'Hunter Tom Mango Season' : 'Mark Capybara Seasons'}
            </h1>
            <p className="text-amber-50 text-xs md:text-sm max-w-md font-medium text-balance opacity-85">
              {isSeason2 ? (
                <span>
                  Battle in brawler arenas to earn <strong className="text-yellow-300 font-extrabold">Mango points</strong>! Earn mango points alongside Svinemarks. Reach level 10 to unlock the majestic <strong className="text-yellow-300 font-black">Hunter Tom</strong> skin!
                </span>
              ) : (
                <span>
                  Battle in the arenas to gain <strong className="text-yellow-300 font-extrabold">Svinemarks</strong>. Defeating enemies gets Svinemarks! Claim crates, coins, and unlock the legendary <strong className="text-yellow-300">Mark Capybara</strong>.
                </span>
              )}
            </p>
          </div>

          {/* Svinemarks Summary Counter badge Card */}
          <div className="bg-slate-950/60 border border-white/10 backdrop-blur rounded-2xl p-5 flex flex-col items-center min-w-48 text-center animate-pulse">
            <span className="text-3xl">{isSeason2 ? '🥭' : '🎫'}</span>
            <span className={`text-2xl font-black ${isSeason2 ? 'text-orange-400' : 'text-cyan-300'} mt-1`}>{currentPoints}</span>
            <span className="text-[10px] uppercase font-black tracking-wider text-gray-400">{isSeason2 ? 'Total Mango Points' : 'Total Svinemarks'}</span>
            <span className={`text-xs ${
              isSeason2 
                ? 'bg-orange-500/20 text-orange-300 border-orange-500/30' 
                : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
            } border font-extrabold px-3 py-0.5 rounded-full mt-3`}>
              Season Level {currentBPLevel}
            </span>
          </div>
        </div>

        {/* Global Season Progress Slider bar */}
        <div className="mt-8 relative z-10">
          <div className={`flex items-center justify-between text-xs font-bold ${isSeason2 ? 'text-orange-200' : 'text-cyan-200'} mb-2`}>
            <span>Level {currentBPLevel} Progress</span>
            {nextLevel ? (
              <span>{currentMarksInLevel} / {totalNeededForLevel} {isSeason2 ? 'Mango points' : 'Svinemarks'} to Level {currentBPLevel + 1}</span>
            ) : (
              <span className="text-yellow-400 font-black animate-pulse">🎉 Ultimate Level Reached!</span>
            )}
          </div>
          <div className="w-full bg-slate-950/90 h-4 rounded-full p-0.5 border border-white/10">
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8 }}
              className={`bg-gradient-to-r ${
                isSeason2 
                  ? 'from-orange-400 via-amber-400 to-yellow-400' 
                  : 'from-cyan-400 via-teal-400 to-emerald-400'
              } h-full rounded-full`}
            />
          </div>
        </div>
      </div>

      {/* Main Levels Grid list */}
      <div className="w-full max-w-5xl mx-auto z-10 flex-grow grid grid-flow-row gap-4 mb-20">
        <h2 className={`text-xl font-extrabold ${isSeason2 ? 'text-orange-400' : 'text-cyan-400'} uppercase tracking-widest pl-2 mb-2 flex items-center gap-2`}>
          <Award className={`w-5 h-5 ${isSeason2 ? 'text-orange-400' : 'text-cyan-400'}`} />
          <span>{isSeason2 ? 'Season 2 Mango Leaderboard Rewards' : 'Seasonal Progression Rewards'}</span>
        </h2>

        {activeLevels.map((lvl) => {
          const isUnlocked = currentPoints >= lvl.svinemarksRequired;
          const isClaimed = claimedLevels.includes(lvl.level);
          const isLocked = !isUnlocked;
          const isClaimable = isUnlocked && !isClaimed;

          // Special card styles for grand rewards
          const isCapyPrestige = !isSeason2 && (lvl.level === 26 || lvl.level === 28 || lvl.level === 30);
          const isSpecialLevel = isSeason2
            ? (lvl.level === 30 || lvl.level === 29 || lvl.level === 27 || lvl.level === 25 || lvl.level === 24 || lvl.level === 22 || lvl.level === 20 || lvl.level === 19 || lvl.level === 18 || lvl.level === 16 || lvl.level === 15 || lvl.level === 14 || lvl.level === 12 || lvl.level === 10 || lvl.level === 9 || lvl.level === 8 || lvl.level === 5)
            : (lvl.level === 10 || lvl.level === 14 || lvl.level === 15 || lvl.level === 17 || lvl.level === 19 || lvl.level === 21 || lvl.level === 23 || lvl.level === 25 || isCapyPrestige);
          
          const specialColor = isSeason2
            ? (lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 15 || lvl.level === 5
                ? 'text-yellow-300 font-extrabold animate-pulse'
                : lvl.level === 10 
                ? 'text-yellow-300 font-black animate-pulse' 
                : (lvl.level === 9 || lvl.level === 19 || lvl.level === 16 || lvl.level === 29 || lvl.level === 27 || lvl.level === 22)
                ? 'text-orange-400' 
                : 'text-amber-400')
            : lvl.level === 15 
            ? 'text-fuchsia-400' 
            : isCapyPrestige 
            ? 'text-yellow-300 font-black animate-pulse'
            : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) 
            ? 'text-amber-400' 
            : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) 
            ? 'text-cyan-400' 
            : 'text-yellow-400';

          const specialBorder = isSeason2
            ? (lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 15 || lvl.level === 5
                ? 'border-yellow-400/70 shadow-[0_0_30px_rgba(234,179,8,0.35)] shadow-yellow-500/25'
                : lvl.level === 10
                ? 'border-yellow-400/60 shadow-[0_0_25px_rgba(234,179,8,0.25)] shadow-yellow-500/20'
                : (lvl.level === 9 || lvl.level === 19 || lvl.level === 16 || lvl.level === 29 || lvl.level === 27 || lvl.level === 22)
                ? 'border-orange-500/50 shadow-[0_0_20px_rgba(249,115,22,0.15)] shadow-orange-500/10'
                : 'border-amber-500/30')
            : lvl.level === 15 
            ? 'border-fuchsia-500/50 shadow-[0_0_20px_rgba(217,70,239,0.15)] shadow-fuchsia-500/10' 
            : isCapyPrestige
            ? 'border-yellow-400/60 shadow-[0_0_25px_rgba(234,179,8,0.25)] shadow-yellow-500/20'
            : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) 
            ? 'border-amber-500/50 shadow-[0_0_20px_rgba(245,158,11,0.15)] shadow-amber-500/10' 
            : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21)
            ? 'border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.15)] shadow-cyan-500/10' 
            : 'border-yellow-500/50 shadow-[0_0_20px_rgba(234,179,8,0.15)] shadow-yellow-500/10';

          const specialBg = isSeason2
            ? (lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 10 || lvl.level === 15 || lvl.level === 5
                ? 'bg-gradient-to-r from-yellow-950/40 via-orange-950/20 to-slate-900/40'
                : 'bg-gradient-to-r from-orange-950/30 via-slate-900/20 to-slate-900/35')
            : lvl.level === 15 
            ? 'bg-gradient-to-r from-fuchsia-950/30 via-purple-950/20 to-slate-900/35' 
            : isCapyPrestige
            ? 'bg-gradient-to-r from-yellow-950/40 via-amber-950/20 to-slate-900/40'
            : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) 
            ? 'bg-gradient-to-r from-amber-950/30 via-orange-950/20 to-slate-900/35' 
            : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) 
            ? 'bg-gradient-to-r from-cyan-950/30 via-teal-950/20 to-slate-900/35' 
            : 'bg-gradient-to-r from-yellow-950/30 via-cyan-950/20 to-slate-900/35';

          const tagLabel = isSeason2
            ? (lvl.level === 30
                ? '👑 SEASON GRAND PRIZE'
                : lvl.level === 25
                ? '🤿 DIVESUIT GOOSE'
                : lvl.level === 20
                ? '🌴 TROPICAL TOM'
                : lvl.level === 15
                ? '🧭 EXPLORER SKIN'
                : lvl.level === 10
                ? '🏹 LEGENDARY HUNTER'
                : lvl.level === 5
                ? '🦖 DINO SKIN'
                : (lvl.level === 9 || lvl.level === 19 || lvl.level === 16 || lvl.level === 27 || lvl.level === 22)
                ? '🥭 MANGO CRATE'
                : (lvl.level === 29 || lvl.level === 24 || lvl.level === 18 || lvl.level === 14)
                ? '🦪 PEARL CRATE'
                : '🌟 EPIC REWARD')
            : lvl.level === 15 
            ? 'ROYAL SKIN' 
            : isCapyPrestige
            ? 'MANGO PRESTIGE'
            : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) 
            ? 'MANGO CRATE' 
            : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) 
            ? 'PEARL CRATE' 
            : 'GRAND REWARD';

          const tagBadgeStyle = isSeason2
            ? (lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 10 || lvl.level === 15 || lvl.level === 5
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40 animate-pulse'
                : 'bg-orange-500/10 text-orange-400 border-orange-500/30')
            : lvl.level === 15 
            ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30' 
            : isCapyPrestige
            ? 'bg-yellow-500/20 text-yellow-300 border-yellow-400/40 shadow-[0_0_10px_rgba(234,179,8,0.1)]'
            : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) 
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/30' 
            : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) 
            ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' 
            : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';

          return (
            <motion.div
              key={lvl.level}
              whileHover={isClaimable ? { scale: 1.01, x: 4 } : {}}
              className={`border rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4 transition-all relative overflow-hidden ${
                isClaimed
                  ? 'bg-slate-900/30 border-white/5 opacity-60'
                  : isSpecialLevel
                  ? `${specialBg} ${specialBorder}`
                  : isClaimable
                  ? `bg-slate-900 ${isSeason2 ? 'border-orange-500/40 shadow-orange-950/20' : 'border-cyan-500/40 shadow-cyan-950/20'} border shadow-lg cursor-pointer hover:border-orange-400/80`
                  : 'bg-slate-950/60 border-white/5'
              }`}
              onClick={() => isClaimable && handleClaim(lvl)}
            >
              {/* Highlight ribbon backdrops for special levels */}
              {isSpecialLevel && (
                <div className={`absolute top-0 left-0 w-32 h-32 rounded-full blur-[40px] pointer-events-none opacity-40 ${
                  isSeason2 
                    ? ((lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 15 || lvl.level === 10 || lvl.level === 5) ? 'bg-yellow-400/30' : 'bg-orange-500/20')
                    : (lvl.level === 15 ? 'bg-fuchsia-500/20' : isCapyPrestige ? 'bg-yellow-400/30' : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19) ? 'bg-amber-500/25' : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) ? 'bg-cyan-500/20' : 'bg-yellow-500/25')
                }`} />
              )}

              {/* Left Details block */}
              <div className="flex flex-col md:flex-row items-center gap-4 text-center md:text-left">
                {/* Level Tag circle Badge */}
                <div className={`w-14 h-14 rounded-full flex flex-col items-center justify-center font-black select-none ${
                  isClaimed 
                    ? 'bg-slate-800 text-gray-500 border border-white/5' 
                    : isSpecialLevel
                    ? isSeason2
                      ? (lvl.level === 30 || lvl.level === 25 || lvl.level === 20 || lvl.level === 15 || lvl.level === 10 || lvl.level === 5)
                        ? 'bg-gradient-to-b from-yellow-400 to-amber-500 text-slate-950 border border-yellow-300 animate-pulse font-black'
                        : 'bg-orange-500 text-white border border-orange-400 animate-pulse'
                      : lvl.level === 15 
                      ? 'bg-fuchsia-600 text-white border border-fuchsia-400 animate-pulse' 
                      : (lvl.level === 25 || lvl.level === 23 || lvl.level === 19)
                      ? 'bg-amber-500 text-slate-950 border border-amber-400 animate-pulse'
                      : (lvl.level === 14 || lvl.level === 17 || lvl.level === 21) 
                      ? 'bg-cyan-500 text-slate-950 border border-cyan-400 animate-pulse'
                      : 'bg-yellow-500 text-slate-950 border border-yellow-400 animate-pulse'
                    : isUnlocked 
                    ? (isSeason2 ? 'bg-orange-500 text-white' : 'bg-cyan-500 text-white')
                    : 'bg-slate-900 text-gray-500 border border-white/5'
                }`}>
                  <span className="text-[10px] uppercase tracking-tighter leading-none">LVL</span>
                  <span className="text-xl leading-none font-extrabold">{lvl.level}</span>
                </div>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2 justify-center md:justify-start">
                    <span className={`text-base font-black uppercase ${isSpecialLevel ? specialColor : 'text-white'}`}>
                      {lvl.label}
                    </span>
                    {isSpecialLevel && (
                      <span className={`${tagBadgeStyle} border text-[9px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full`}>
                        {tagLabel}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400 mt-0.5">{lvl.sublabel}</span>
                  <span className="text-[10px] text-gray-500 font-extrabold uppercase mt-1">
                    Requirements: <strong className="text-gray-300 font-black">{lvl.svinemarksRequired}</strong> {isSeason2 ? 'Mango points' : 'Svinemarks'}
                  </span>
                </div>
              </div>

              {/* Middle preview icon rendering */}
              <div className="flex items-center justify-center min-w-24 relative">
                {lvl.rewardType === 'coins' ? (
                  <span className="text-4xl filter drop-shadow">🪙</span>
                ) : lvl.rewardType === 'hero' ? (
                  <span className="text-4xl filter drop-shadow animate-bounce" style={{ animationDuration: '4s' }}>🍊</span>
                ) : lvl.rewardType === 'crate_pearl' || lvl.rewardType === 'crate_pearl_item' ? (
                  <span className="text-4xl filter drop-shadow animate-pulse">🐚</span>
                ) : lvl.rewardType === 'crate_mango_item' ? (
                  <span className="text-4xl filter drop-shadow animate-pulse">🥭</span>
                ) : lvl.rewardType === 'skin' ? (
                  lvl.rewardValue === 'hunter-tom' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(32).png?raw=true"
                      alt="Hunter Tom preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : lvl.rewardValue === 'tropical-tom' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(36).png?raw=true"
                      alt="Tropical Tom preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : lvl.rewardValue === 'dino-alcatrasnic' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(37).png?raw=true"
                      alt="Dino Alcatrasnic preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : lvl.rewardValue === 'explorer-patron' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(38).png?raw=true"
                      alt="Explorer Patron preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : lvl.rewardValue === 'divesuit-goose' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(40).png?raw=true"
                      alt="Divesuit Goose preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : lvl.rewardValue === 'tropical-svin' ? (
                    <img
                      src="https://github.com/potuzhnik/njhjhjj/blob/main/image-removebg-preview%20(39).png?raw=true"
                      alt="Tropical Svin preview"
                      className="w-16 h-16 object-contain filter drop-shadow-lg scale-110 z-10 hover:scale-125 transition-transform"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-4xl filter drop-shadow animate-pulse">👑</span>
                  )
                ) : lvl.rewardType === 'capybara_prestige' ? (
                  <span className="text-4xl filter drop-shadow animate-bounce" style={{ animationDuration: '3s' }}>🍊👑</span>
                ) : (
                  <span className="text-4xl filter drop-shadow">🔮</span>
                )}
                {(lvl.rewardType === 'crate_pearl_item' || lvl.rewardType === 'crate_mango_item') && (
                  <span className="absolute -bottom-1 -right-1 bg-slate-900 border border-white/10 text-[10px] font-black px-1.5 py-0.5 rounded-full text-yellow-400">
                    x{lvl.rewardValue}
                  </span>
                )}
              </div>

              {/* Right Side Status / Trigger claims button */}
              <div className="min-w-36 flex justify-center md:justify-end">
                {isClaimed ? (
                  <div className="flex items-center gap-1.5 text-emerald-400 font-extrabold text-xs uppercase bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span>Claimed</span>
                  </div>
                ) : isClaimable ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClaim(lvl);
                    }}
                    className="w-full md:w-auto bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 border border-cyan-400/30 text-white font-black uppercase italic tracking-wider text-xs px-6 py-2.5 rounded-xl transition-all hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95"
                  >
                    Claim Reward
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5 text-gray-500 font-extrabold text-xs uppercase bg-slate-900 border border-white/5 px-4 py-2 rounded-xl">
                    <Lock className="w-3.5 h-3.5 text-gray-500" />
                    <span>Locked</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Claim / Unboxing Overlay Animation Modal */}
      <AnimatePresence>
        {unboxingState !== 'idle' && (
          <div className="fixed inset-0 z-50 bg-slate-950/95 flex items-center justify-center p-4">
            
            {/* 1. Opening Loop state spinner */}
            {unboxingState === 'opening' && (
              <div className="flex flex-col items-center text-center">
                <Loader2 className="w-16 h-16 text-cyan-400 animate-spin mb-4" />
                <h3 className="text-2xl font-black italic uppercase tracking-wider text-cyan-400">
                  Unboxing Reward Item...
                </h3>
                <p className="text-xs text-gray-500 max-w-xs mt-1 leading-normal uppercase font-bold tracking-widest leading-relaxed">
                  Extracting loot configurations in real-time
                </p>
              </div>
            )}

            {/* 2. Revealed drop success visual details */}
            {unboxingState === 'revealed' && revealedDrop && (
              <motion.div
                initial={{ scale: 0.8, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                exit={{ scale: 0.8, y: 50, opacity: 0 }}
                className="max-w-md w-full bg-slate-900 border border-cyan-500/30 p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col items-center text-center"
              >
                {/* Back sparkling stars gradient highlights */}
                <div className="absolute top-0 w-full h-48 bg-gradient-to-b from-cyan-600/10 to-transparent -z-10 pointer-events-none" />
                
                {/* Glowing Ribbon */}
                <div className="mb-4 bg-cyan-500/10 border border-cyan-500/20 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">
                    {revealedDrop.type === 'hero' ? 'BP Character Unlock' : 
                     revealedDrop.type === 'skin' ? 'Legendary Skin Unlock' : 
                     revealedDrop.type === 'upgrade' ? 'Brawler Upgrade Drop' : 'Pass Treasury Cargo claimed'}
                  </span>
                </div>

                {/* Main Asset Render */}
                <div className="w-56 h-56 flex items-center justify-center relative my-6">
                  {/* Decorative backing circles */}
                  <div className="absolute inset-0 bg-cyan-600/10 rounded-full blur-xl scale-95 pointer-events-none animate-pulse" />
                  
                  {revealedDrop.image ? (
                    <img
                      src={revealedDrop.image}
                      alt={revealedDrop.name}
                      className="w-full h-full object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)] scale-110"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-9xl filter drop-shadow-lg animate-bounce select-none">
                      {revealedDrop.emoji}
                    </span>
                  )}
                </div>

                {/* Drop Details content */}
                <h2 className="text-3xl font-black italic uppercase tracking-normal text-white">
                  {revealedDrop.name}
                </h2>

                {revealedDrop.name.includes('Prestige') ? (
                  <p className="text-yellow-400 font-extrabold text-xs uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center">
                    <span>A rare upgrade token specifically for Mark Capybara!</span>
                  </p>
                ) : revealedDrop.name.includes('Crate') ? (
                  <p className="text-cyan-400 font-extrabold text-xs uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center">
                    <span>Added to your main inventory! Use them in the Shop.</span>
                  </p>
                ) : (
                  revealedDrop.type === 'coins' && revealedDrop.amount && (
                    <p className="text-yellow-400 font-extrabold text-sm uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center">
                      <Coins className="w-4 h-4 text-yellow-400" />
                      <span>+{revealedDrop.amount} Coins Received</span>
                    </p>
                  )
                )}

                <p className="text-gray-400 text-xs leading-relaxed mt-4 max-w-xs font-medium">
                  {revealedDrop.heroId === 'capybara' ? 'The legendary Mark Capybara from the final tier of the Battlepass is yours! Shake up the mango juice flame and dominate!' :
                   revealedDrop.name.includes('Mango Crate') ? 'Sweet Mango Crates have been safely stored in your inventory! Open them anytime from the Shop.' :
                   revealedDrop.name.includes('Pearl Crate') ? 'High-tier Tom Pearl Crates have been delivered! Head to the Shop to claim your rewards.' :
                   revealedDrop.name.includes('Prestige') ? 'Go to the Collection tab, select Mark Capybara, and upgrade his star rating to gain massive stat increases!' :
                   revealedDrop.type === 'hero' ? 'A brand shiny new character has been recruited to your team lineup!' :
                   revealedDrop.type === 'skin' ? 'A beautiful legendary cosmetic style has unlocked for your brawlers!' :
                   'Coins have been directly deposited to your main ledger.'}
                </p>

                {/* Claim action button */}
                <button
                  onClick={handleCloseUnboxing}
                  className="mt-8 w-full bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white py-4 rounded-2xl font-black italic text-lg uppercase tracking-wider transition-all shadow-[0_5px_0_rgb(8,145,178)] active:translate-y-1 active:shadow-none"
                >
                  Confirm Claim
                </button>

              </motion.div>
            )}

          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
