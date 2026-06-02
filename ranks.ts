/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Coins, 
  Sparkles, 
  ArrowLeft, 
  Check, 
  Lock, 
  Gift, 
  Trophy, 
  Star, 
  Award,
  ChevronRight
} from 'lucide-react';
import { UserData, HeroId } from '../../types';
import { HERO_VERSIONS, HERO_SKINS } from '../../constants';
import { TROPHY_ROAD, TrophyMilestone, getRank, getNextRank, RANKS } from '../../utils/ranks';

interface TrophyRoadProps {
  userData: UserData;
  updateUserData: (data: Partial<UserData> | ((prev: UserData) => UserData)) => void;
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

const HERO_EMOJIS: Record<HeroId, string> = {
  'goose-einstein': '🦢',
  'chicken': '🐔',
  'sigeon': '🐦',
  'svinobomba': '🐷',
  'alcatrasnic': '🐹',
  'bimbolit': '💣',
  'oreshki': '🐿️',
  'svin': '🐗',
  'seliuk': '🦔',
  'aura-tom': '🎻',
  'smurfik': '🧚‍♂️',
  'capybara': '🍊',
  'pes-patron': '🐶',
  'aura-scrooge': '💰',
};

export default function TrophyRoad({ userData, updateUserData, onBack }: TrophyRoadProps) {
  const [activeTab, setActiveTab] = useState<'road' | 'ranks' | 'next-reward'>('road');
  const [unboxingState, setUnboxingState] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [revealedDrop, setRevealedDrop] = useState<DropResult | null>(null);
  const [claimingMilestone, setClaimingMilestone] = useState<number | null>(null);

  const currentTrophies = userData.trophies || 0;
  const currentRank = getRank(currentTrophies);
  const nextRank = getNextRank(currentTrophies);

  // Calculate distance to next rank
  const rankProgressPercent = nextRank 
    ? Math.min(100, Math.max(0, ((currentTrophies - currentRank.minTrophies) / (nextRank.minTrophies - currentRank.minTrophies)) * 100))
    : 100;

  // Identify next un-claimed milestone
  const nextMilestone = TROPHY_ROAD.find(m => !userData.claimedTrophyMilestones?.includes(m.trophies));

  // Claim a direct milestone reward (Coins, Crate, or Hero)
  const handleClaimMilestone = (milestone: TrophyMilestone) => {
    if (currentTrophies < milestone.trophies) return;
    if (userData.claimedTrophyMilestones?.includes(milestone.trophies)) return;

    if (milestone.rewardType === 'hero' && milestone.heroId) {
      // Direct Hero Unlock!
      const hero = HERO_VERSIONS[milestone.heroId];
      const selectedDrop: DropResult = {
        type: 'hero',
        heroId: milestone.heroId,
        id: milestone.heroId,
        name: hero.name,
        image: hero.image,
        emoji: HERO_EMOJIS[milestone.heroId] || '🧚‍♂️'
      };

      setRevealedDrop(selectedDrop);
      setUnboxingState('opening');

      setTimeout(() => {
        setUnboxingState('revealed');

        updateUserData(prev => {
          const next = { ...prev };
          const claimed = prev.claimedTrophyMilestones || [];
          next.claimedTrophyMilestones = [...claimed, milestone.trophies];

          if (!next.unlockedHeroIds.includes(milestone.heroId!)) {
            next.unlockedHeroIds = [...next.unlockedHeroIds, milestone.heroId!];
          }

          localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
          return next;
        });
      }, 1800);

    } else if (milestone.rewardType === 'coins') {
      // 1) Direct Coins Unlock
      updateUserData(prev => {
        const claimed = prev.claimedTrophyMilestones || [];
        return {
          ...prev,
          coins: prev.coins + milestone.rewardValue,
          claimedTrophyMilestones: [...claimed, milestone.trophies],
        };
      });
      
      // Temporary animation state
      setClaimingMilestone(milestone.trophies);
      setTimeout(() => setClaimingMilestone(null), 1500);

    } else if (milestone.rewardType === 'crate') {
      // 2) Free Aura Crate unboxing unrolled logic with zero cost
      const r = Math.random();
      let selectedDrop: DropResult | null = null;

      // Identify candidates for rolls
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

      // 15% Character unlock
      if (r < 0.15 && lockedHeroIds.length > 0) {
        const targetId = lockedHeroIds[Math.floor(Math.random() * lockedHeroIds.length)];
        const hero = HERO_VERSIONS[targetId];
        selectedDrop = {
          type: 'hero',
          heroId: targetId,
          id: targetId,
          name: hero.name,
          image: hero.image,
          emoji: HERO_EMOJIS[targetId] || '👾'
        };
      }

      // 15% Skin unlock
      if (!selectedDrop && r < 0.30 && unownedSkins.length > 0) {
        const targetSkin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
        selectedDrop = {
          type: 'skin',
          heroId: targetSkin.heroId,
          id: targetSkin.id,
          name: targetSkin.name,
          image: targetSkin.image,
          emoji: '✨'
        };
      }

      // 35% Level Upgrade
      if (!selectedDrop && r < 0.65 && userData.unlockedHeroIds.length > 0) {
        const targetId = userData.unlockedHeroIds[Math.floor(Math.random() * userData.unlockedHeroIds.length)];
        const curLvl = userData.heroLevels[targetId] || 1;
        selectedDrop = {
          type: 'upgrade',
          heroId: targetId,
          id: targetId,
          name: HERO_VERSIONS[targetId]?.name || targetId,
          image: HERO_VERSIONS[targetId]?.image,
          emoji: HERO_EMOJIS[targetId] || '💪',
          levelFrom: curLvl,
          levelTo: curLvl + 1
        };
      }

      // 35% Coins Return (Fallback)
      if (!selectedDrop) {
        const coinRoll = Math.random();
        let coinsRefunded = 350;
        let title = 'Bronze Coin Stash';

        if (coinRoll < 0.50) {
          coinsRefunded = 300;
          title = 'Trophy Stash Purse';
        } else if (coinRoll < 0.80) {
          coinsRefunded = 600;
          title = 'Brawler Silver Cache';
        } else if (coinRoll < 0.95) {
          coinsRefunded = 1000;
          title = 'Golden Trophy Jar';
        } else {
          coinsRefunded = 2000;
          title = 'Jackpot Trophy Vault!';
        }

        selectedDrop = {
          type: 'coins',
          amount: coinsRefunded,
          name: title,
          emoji: '🪙'
        };
      }

      // Open unboxing states inside the Trophy Road modal
      setRevealedDrop(selectedDrop);
      setUnboxingState('opening');

      setTimeout(() => {
        setUnboxingState('revealed');

        // Apply reward to user state and record milestone claim
        updateUserData(prev => {
          const next = { ...prev };
          const claimed = prev.claimedTrophyMilestones || [];
          next.claimedTrophyMilestones = [...claimed, milestone.trophies];

          if (selectedDrop) {
            if (selectedDrop.type === 'hero' && selectedDrop.heroId) {
              if (!next.unlockedHeroIds.includes(selectedDrop.heroId)) {
                next.unlockedHeroIds = [...next.unlockedHeroIds, selectedDrop.heroId];
              }
            } else if (selectedDrop.type === 'skin' && selectedDrop.heroId && selectedDrop.id) {
              const owned = next.ownedSkinIds[selectedDrop.heroId] || [];
              if (!owned.includes(selectedDrop.id)) {
                next.ownedSkinIds = {
                  ...next.ownedSkinIds,
                  [selectedDrop.heroId]: [...owned, selectedDrop.id]
                };
              }
            } else if (selectedDrop.type === 'upgrade' && selectedDrop.heroId) {
              const curLvl = next.heroLevels[selectedDrop.heroId] || 1;
              next.heroLevels = {
                ...next.heroLevels,
                [selectedDrop.heroId]: curLvl + 1
              };
            } else if (selectedDrop.type === 'coins' && selectedDrop.amount) {
              next.coins += selectedDrop.amount;
            }
          }

          localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
          return next;
        });
      }, 1800);

    } else if (milestone.rewardType === 'crate_pearl') {
      const r = Math.random();
      let selectedDrop: DropResult | null = null;

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

      if (r < 0.35 && lockedHeroIds.length > 0) {
        const targetId = lockedHeroIds[Math.floor(Math.random() * lockedHeroIds.length)];
        const hero = HERO_VERSIONS[targetId];
        selectedDrop = {
          type: 'hero',
          heroId: targetId,
          id: targetId,
          name: hero.name,
          image: hero.image,
          emoji: '🔥'
        };
      }

      if (!selectedDrop && r < 0.70 && unownedSkins.length > 0) {
        const targetSkin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
        selectedDrop = {
          type: 'skin',
          heroId: targetSkin.heroId,
          id: targetSkin.id,
          name: targetSkin.name,
          image: targetSkin.image,
          emoji: '👑'
        };
      }

      if (!selectedDrop && r < 0.90 && userData.unlockedHeroIds.length > 0) {
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
          levelTo: curLvl + 1
        };
      }

      if (!selectedDrop) {
        const coinRefund = Math.floor(Math.random() * 1000) + 1500;
        selectedDrop = {
          type: 'coins',
          amount: coinRefund,
          name: `${coinRefund} Pearl Gold Coins`,
          emoji: '🪙'
        };
      }

      setRevealedDrop(selectedDrop);
      setUnboxingState('opening');

      setTimeout(() => {
        setUnboxingState('revealed');

        updateUserData(prev => {
          const next = { ...prev };
          const claimed = prev.claimedTrophyMilestones || [];
          next.claimedTrophyMilestones = [...claimed, milestone.trophies];

          if (selectedDrop) {
            if (selectedDrop.type === 'hero' && selectedDrop.heroId) {
              if (!next.unlockedHeroIds.includes(selectedDrop.heroId)) {
                next.unlockedHeroIds = [...next.unlockedHeroIds, selectedDrop.heroId];
              }
            } else if (selectedDrop.type === 'skin' && selectedDrop.heroId && selectedDrop.id) {
              const owned = next.ownedSkinIds[selectedDrop.heroId] || [];
              if (!owned.includes(selectedDrop.id)) {
                next.ownedSkinIds = {
                  ...next.ownedSkinIds,
                  [selectedDrop.heroId]: [...owned, selectedDrop.id]
                };
              }
            } else if (selectedDrop.type === 'upgrade' && selectedDrop.heroId) {
              const curLvl = next.heroLevels[selectedDrop.heroId] || 1;
              next.heroLevels = {
                ...next.heroLevels,
                [selectedDrop.heroId]: curLvl + 1
              };
            } else if (selectedDrop.type === 'coins' && selectedDrop.amount) {
              next.coins += selectedDrop.amount;
            }
          }

          localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
          return next;
        });
      }, 1800);
    }
  };

  const handleCloseUnboxing = () => {
    setUnboxingState('idle');
    setRevealedDrop(null);
  };

  return (
    <div className="w-full h-full bg-[#0a0f1d] text-white p-4 md:p-8 overflow-y-auto flex flex-col relative select-none">
      
      {/* HEADER SECTION */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-4 border-b border-white/10 pb-6 mb-6 shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10 hover:bg-white/10 transition-all active:scale-95 animate-pulse"
          >
            <ArrowLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div>
            <h1 className="text-3xl md:text-4xl font-black italic uppercase tracking-tighter bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 bg-clip-text text-transparent">
              Trophy Road
            </h1>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mt-1">
              Advance your Rank to claim rewards!
            </p>
          </div>
        </div>

        {/* Current Total Badges */}
        <div className="flex items-center gap-3 bg-yellow-500/10 border border-yellow-500/25 px-5 py-2.5 rounded-2xl shadow-lg">
          <span className="text-2xl">🏆</span>
          <div className="text-left">
            <div className="text-[9px] font-black uppercase text-yellow-500/70 tracking-widest leading-none">Your Trophies</div>
            <div className="font-sans font-black text-xl text-yellow-400">{currentTrophies}</div>
          </div>
        </div>
      </div>

      {/* TABS SELECTOR (Trophy Road style) */}
      <div className="max-w-4xl w-full mx-auto flex bg-slate-900/80 p-1.5 rounded-2xl border border-white/5 mb-6 shrink-0 shadow-2xl">
        <button
          onClick={() => setActiveTab('road')}
          className={`flex-1 py-3 px-2 rounded-xl font-black italic uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'road'
              ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-black shadow-lg shadow-orange-500/20 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🏆</span>
          <span>Reward Road</span>
        </button>
        <button
          onClick={() => setActiveTab('ranks')}
          className={`flex-1 py-3 px-2 rounded-xl font-black italic uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'ranks'
              ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-black shadow-lg shadow-orange-500/20 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>👑</span>
          <span>Rank Standings</span>
        </button>
        <button
          onClick={() => setActiveTab('next-reward')}
          className={`flex-1 py-3 px-2 rounded-xl font-black italic uppercase text-xs tracking-wider transition-all flex items-center justify-center gap-2 relative ${
            activeTab === 'next-reward'
              ? 'bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-black shadow-lg shadow-orange-500/20 scale-[1.02]'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>🎁</span>
          <span>Next Reward</span>
          {TROPHY_ROAD.some(m => currentTrophies >= m.trophies && !userData.claimedTrophyMilestones?.includes(m.trophies)) && (
            <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full animate-ping" />
          )}
        </button>
      </div>

      {/* RENDER ACTIVE TAB */}
      <AnimatePresence mode="wait">
        
        {/* TAB 1: VERTICAL ROAD TIMELINE */}
        {activeTab === 'road' && (
          <motion.div
            key="road"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col"
          >
            {/* PROGRESS OVERVIEW MINI CARD */}
            <div className="max-w-4xl w-full mx-auto mb-6 bg-slate-900/60 border border-white/5 rounded-3xl p-5 relative overflow-hidden shrink-0">
              <div className="absolute top-0 right-0 w-80 h-80 bg-orange-600/5 rounded-full blur-3xl pointer-events-none" />
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-b ${currentRank.bgGradient} border-2 border-white/10 flex items-center justify-center text-3xl shadow-xl shadow-black/40`}>
                    {currentRank.icon}
                  </div>
                  <div>
                    <div className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Current Rank</div>
                    <div className="text-xl font-black italic uppercase text-white tracking-tight">{currentRank.name}</div>
                    <div className="text-[9px] text-gray-400 font-bold mt-0.5 uppercase">Unlocked at {currentRank.minTrophies} Trophies</div>
                  </div>
                </div>

                {nextRank && (
                  <div className="flex-1 md:max-w-md w-full">
                    <div className="flex justify-between items-end mb-1 text-xs font-bold uppercase tracking-wider text-gray-400">
                      <span>Next Rank: <strong className="text-yellow-400 font-black">{nextRank.name}</strong></span>
                      <span>{currentTrophies} / {nextRank.minTrophies} {nextRank.icon}</span>
                    </div>
                    {/* Custom Track */}
                    <div className="w-full h-3.5 bg-black/40 rounded-full border border-white/5 overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full transition-all duration-1000"
                        style={{ width: `${rankProgressPercent}%` }}
                      />
                    </div>
                    <div className="text-[9px] text-gray-500 text-right mt-1 font-bold uppercase tracking-widest">
                      {nextRank.minTrophies - currentTrophies} Trophies left to level up!
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* SCROLLABLE PROGRESS TIMELINE */}
            <div className="max-w-4xl w-full mx-auto flex-1 overflow-y-auto pr-2 scrollbar-thin">
              <div className="relative pl-6 md:pl-24 py-4">
                {/* Center progression rod */}
                <div className="absolute left-[39px] md:left-[111px] top-0 bottom-0 w-2 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
                  <div 
                    className="w-full bg-gradient-to-b from-yellow-400 via-orange-500 to-purple-600 transition-all duration-1000"
                    style={{ 
                      height: `${Math.min(100, Math.max(0, (currentTrophies / 3500) * 100))}%`
                    }}
                  />
                </div>

                <div className="space-y-8 relative">
                  {TROPHY_ROAD.map((milestone, idx) => {
                    const isLocked = currentTrophies < milestone.trophies;
                    const isClaimed = userData.claimedTrophyMilestones?.includes(milestone.trophies);
                    const isClaimable = !isLocked && !isClaimed;

                    return (
                      <div 
                        key={milestone.trophies}
                        className={`flex items-center gap-6 md:gap-12 relative transition-all duration-300 ${
                          isLocked ? 'opacity-50' : 'opacity-100'
                        }`}
                      >
                        <div className="absolute left-[5px] md:left-[77px] z-10">
                          <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center font-black text-xs shadow-lg transition-transform ${
                            isClaimed 
                              ? 'bg-emerald-500 border-white/20 text-white' 
                              : isClaimable 
                                ? 'bg-yellow-400 border-yellow-250 text-black scale-110 animate-pulse' 
                                : 'bg-slate-800 border-white/5 text-gray-400'
                          }`}>
                            {isClaimed ? <Check className="w-4 h-4" /> : idx + 1}
                          </div>
                        </div>

                        <div className="pl-10 md:pl-20 flex-1 flex flex-col md:flex-row md:items-center justify-between bg-slate-900/55 border border-white/5 rounded-2xl p-4 md:p-5 gap-4 hover:bg-slate-900/80 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl border ${
                              milestone.rewardType === 'coins' 
                                ? 'bg-yellow-500/10 border-yellow-500/20 text-yellow-500' 
                                : milestone.rewardType === 'hero'
                                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 font-extrabold'
                                  : milestone.rewardType === 'crate_pearl'
                                    ? 'bg-cyan-500/15 border-cyan-400/30 text-cyan-400 animate-pulse'
                                    : 'bg-violet-500/10 border-violet-500/20 text-violet-400'
                            }`}>
                              {milestone.rewardType === 'coins' ? '🪙' : milestone.rewardType === 'hero' ? '🧚‍♂️' : milestone.rewardType === 'crate_pearl' ? '🐚' : '🔮'}
                            </div>
                            <div>
                              <div className="text-[10px] font-black uppercase text-orange-400 tracking-wider">Milestone {idx + 1}</div>
                              <h4 className="text-base font-black uppercase italic tracking-tight text-white mt-0.5">
                                {milestone.rewardType === 'coins' ? `${milestone.rewardValue} Coins` : milestone.rewardType === 'hero' ? `UNLOCKED FIGHTER: ${milestone.label}` : milestone.label}
                              </h4>
                              <div className="flex items-center gap-1 text-[11px] text-gray-400 font-bold mt-0.5">
                                <Trophy className="w-3.5 h-3.5 text-yellow-500" />
                                <span>{milestone.trophies} Trophies</span>
                              </div>
                            </div>
                          </div>

                          <div>
                            {isClaimed ? (
                              <div className="px-4 py-2 bg-emerald-500/10 text-emerald-400 font-extrabold uppercase tracking-widest text-[10px] rounded-xl border border-emerald-500/20 flex items-center gap-1.5 justify-center md:w-36">
                                <Check className="w-3.5 h-3.5" />
                                <span>Claimed</span>
                              </div>
                            ) : isClaimable ? (
                              <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => handleClaimMilestone(milestone)}
                                className={`px-4 py-2 rounded-xl font-black italic uppercase text-xs tracking-wider md:w-36 transition-all border shadow-lg ${
                                  claimingMilestone === milestone.trophies
                                    ? 'bg-emerald-500 border-white/20 text-white animate-ping'
                                    : 'bg-gradient-to-r from-yellow-400 to-orange-500 border-yellow-300 text-black shadow-orange-500/20'
                                }`}
                              >
                                Claim Reward
                              </motion.button>
                            ) : (
                              <div className="px-4 py-2 bg-slate-800/80 text-gray-400 font-extrabold uppercase tracking-widest text-[10px] rounded-xl border border-white/5 flex items-center gap-1.5 justify-center md:w-36">
                                <Lock className="w-3.5 h-3.5 text-gray-500" />
                                <span>Locked</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* TAB 2: RANKS & LADDER LISTINGS */}
        {activeTab === 'ranks' && (
          <motion.div
            key="ranks"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="flex-1 flex flex-col pr-2"
          >
            <div className="max-w-4xl w-full mx-auto mb-4 text-center shrink-0">
              <h2 className="text-xl md:text-2xl font-black uppercase italic tracking-tight text-white">
                Brawler Division Hierarchy
              </h2>
              <p className="text-xs text-gray-400 font-bold mt-1 uppercase tracking-wider">
                Compare your current standing with all ranks from Wood up to Masters!
              </p>
            </div>

            {/* GRID OF RANKS */}
            <div className="max-w-4xl w-full mx-auto grid grid-cols-1 md:grid-cols-2 gap-4 pb-8 overflow-y-auto pr-2 scrollbar-thin">
              {RANKS.map((rank) => {
                const isUnlocked = currentTrophies >= rank.minTrophies;
                const isCurrent = currentRank.name === rank.name;
                const progressToRankPercent = Math.min(100, Math.max(0, (currentTrophies / rank.minTrophies) * 100));

                return (
                  <div
                    key={rank.name}
                    className={`relative p-5 rounded-3xl border-2 transition-all duration-300 ${
                      isCurrent
                        ? `bg-slate-900 border-yellow-400 shadow-[0_0_25px_rgba(234,179,8,0.25)] scale-[1.01]`
                        : isUnlocked
                          ? 'bg-slate-900/60 border-emerald-500/30'
                          : 'bg-slate-950/40 border-white/5 opacity-60'
                    }`}
                  >
                    {/* Badge Indicator */}
                    {isCurrent && (
                      <span className="absolute top-3 right-3 bg-gradient-to-r from-yellow-400 and-orange-500 to-amber-500 text-black text-[9px] uppercase font-black px-2.5 py-1 rounded-full shadow-lg border border-yellow-300 animate-pulse">
                        Your Division ⭐
                      </span>
                    )}

                    <div className="flex items-center gap-4">
                      {/* Rank icon / Emblem */}
                      <div className={`w-14 h-14 rounded-2xl bg-gradient-to-b ${rank.bgGradient} border-2 border-white/10 flex items-center justify-center text-3xl shadow-lg shrink-0`}>
                        {rank.icon}
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-lg font-black uppercase italic tracking-tight text-white flex items-center gap-2">
                          <span>{rank.name}</span>
                          {isUnlocked && <Check className="w-4 h-4 text-emerald-400 shrink-0" />}
                        </h4>
                        
                        <div className="flex items-center gap-1.5 mt-1">
                          <Trophy className="w-3.5 h-3.5 text-yellow-500 shrink-0" />
                          <span className="text-xs font-black text-amber-500 uppercase">
                            {rank.minTrophies} Trophies
                          </span>
                        </div>

                        {/* Rank progressive status meters */}
                        {!isUnlocked && rank.minTrophies > 0 && (
                          <div className="mt-3.5">
                            <div className="flex justify-between items-center text-[9px] font-extrabold uppercase tracking-widest text-slate-500 mb-1">
                              <span>Locked</span>
                              <span>{currentTrophies} / {rank.minTrophies}</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden p-px">
                              <div 
                                className="h-full bg-slate-600 rounded-full" 
                                style={{ width: `${progressToRankPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isCurrent && nextRank && (
                          <div className="mt-3.5">
                            <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-yellow-500 mb-1">
                              <span>Next rank in {nextRank.minTrophies - currentTrophies} trophies</span>
                              <span>{Math.round(rankProgressPercent)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-black/60 rounded-full overflow-hidden p-px">
                              <div 
                                className="h-full bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full animate-pulse" 
                                style={{ width: `${rankProgressPercent}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {isUnlocked && !isCurrent && (
                          <p className="text-[10px] text-emerald-400 font-extrabold uppercase tracking-widest mt-3">
                            ✓ Division Conquered!
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* TAB 3: SPARKLY NEXT REWARD SPOTLIGHT */}
        {activeTab === 'next-reward' && (
          <motion.div
            key="next-reward"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.2 }}
            className="max-w-xl w-full mx-auto flex flex-col items-center justify-center p-4 text-center shrink-0"
          >
            {nextMilestone ? (
              <motion.div
                initial={{ scale: 0.95 }}
                animate={{ scale: 1 }}
                className="w-full bg-slate-900/85 border-2 border-orange-500/30 p-8 rounded-[2.5rem] relative shadow-2xl flex flex-col items-center select-none overflow-hidden"
              >
                {/* Floating ambient spotlight color spheres */}
                <div className="absolute top-0 w-full h-40 bg-gradient-to-b from-orange-500/10 to-transparent -z-10 pointer-events-none" />
                
                <div className="mb-4 bg-orange-500/10 border border-orange-500/20 px-3 py-1 rounded-full flex items-center gap-1.5 animate-pulse">
                  <Star className="w-3.5 h-3.5 text-orange-400" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-orange-400">
                    Next Road Target 🎯
                  </span>
                </div>

                <div className="w-44 h-44 flex items-center justify-center relative my-4">
                  <div className="absolute inset-0 bg-orange-500/10 rounded-full blur-xl scale-95 pointer-events-none animate-pulse" />
                  <span className="text-8xl select-none filter drop-shadow-[0_10px_20px_rgba(249,115,22,0.3)] hover:scale-110 transition-transform cursor-pointer">
                    {nextMilestone.rewardType === 'coins' ? '🪙' : nextMilestone.rewardType === 'hero' ? '🧚‍♂️' : nextMilestone.rewardType === 'crate_pearl' ? '🐚' : '🔮'}
                  </span>
                </div>

                <h3 className="text-2xl font-black italic uppercase tracking-normal text-white">
                  {nextMilestone.rewardType === 'coins' ? `${nextMilestone.rewardValue} Coins` : nextMilestone.rewardType === 'hero' ? `Unlock Fighter: ${nextMilestone.label}` : nextMilestone.label}
                </h3>
                
                <div className="flex items-center gap-1.5 text-xs text-amber-500 mt-1 font-bold uppercase tracking-wide">
                  <Trophy className="w-4 h-4 text-yellow-500" />
                  <span>Unlocks at {nextMilestone.trophies} total trophies</span>
                </div>

                {/* Progress calculation */}
                {currentTrophies >= nextMilestone.trophies ? (
                  <div className="w-full mt-6">
                    <p className="text-emerald-400 font-extrabold text-sm uppercase mb-4 animate-bounce">
                      🚀 Ready to Claim! You have reached this milestone.
                    </p>
                    <button
                      onClick={() => handleClaimMilestone(nextMilestone)}
                      className="w-full bg-gradient-to-r from-yellow-400 via-orange-400 to-amber-500 text-black font-black py-4 rounded-2xl text-base uppercase tracking-wider transition-all hover:brightness-110 scale-102 active:scale-95 shadow-[0_5px_0_rgba(194,65,12,1)]"
                    >
                      Claim Reward Now!
                    </button>
                  </div>
                ) : (
                  <div className="w-full mt-6">
                    <div className="mb-2 flex justify-between items-center text-xs font-bold text-gray-400 uppercase">
                      <span>Progress</span>
                      <span>{currentTrophies} / {nextMilestone.trophies}  ({Math.round((currentTrophies / nextMilestone.trophies) * 100)}%)</span>
                    </div>
                    {/* Progress tracking rod */}
                    <div className="w-full h-3 bg-black/60 rounded-full border border-white/5 overflow-hidden p-0.5">
                      <div 
                        className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full" 
                        style={{ width: `${Math.min(100, (currentTrophies / nextMilestone.trophies) * 100)}%` }}
                      />
                    </div>
                    <p className="text-gray-400 text-xs leading-relaxed mt-4 max-w-xs mx-auto">
                      You need <strong className="text-yellow-400 font-black">{nextMilestone.trophies - currentTrophies} more trophies</strong> from Solo Showdown or Online Play to unbox this reward!
                    </p>
                    {/* Direct Play trigger Button */}
                    <button
                      onClick={onBack}
                      className="mt-6 w-full bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white py-3 px-6 rounded-2xl font-black italic text-sm uppercase tracking-wider transition-all scale-100 flex items-center justify-center gap-2 shadow-lg"
                    >
                      <Trophy className="w-4 h-4 text-white" />
                      <span>Battle to Earn!</span>
                    </button>
                  </div>
                )}
              </motion.div>
            ) : (
              <div className="p-8 text-center bg-slate-900/60 border border-white/5 rounded-3xl w-full">
                <span className="text-7xl block mb-4">👑</span>
                <h3 className="text-2xl font-black italic uppercase text-yellow-400">All Rewards Claimed!</h3>
                <p className="text-xs text-gray-400 font-bold mt-2 uppercase tracking-wide">
                  You have conquered every milestone on the Trophy Road! Keep compiling victories to preserve your Master status.
                </p>
                <button
                  onClick={onBack}
                  className="mt-6 bg-slate-800 hover:bg-slate-700 px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider"
                >
                  Return to Lobby
                </button>
              </div>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* OVERLAY: Interactive unboxing flow inside Trophy Road */}
      <AnimatePresence>
        {unboxingState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 bg-[#070b19]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-4 text-center overflow-y-auto"
          >
            
            {/* 1. Opening Shaking Suspense */}
            {unboxingState === 'opening' && (
              <div className="flex flex-col items-center max-w-sm">
                
                {/* Visual back aura */}
                <div className="absolute w-80 h-80 bg-violet-600/20 rounded-full blur-[120px] -z-10 pointer-events-none" />
                
                <motion.div
                  animate={{ 
                    scale: [1, 1.2, 1.1, 1.3, 1],
                    rotate: [0, -15, 15, -25, 25, 0]
                  }}
                  transition={{ 
                    duration: 1.6, 
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                  className="text-9xl filter drop-shadow-[0_0_60px_rgba(139,92,246,0.5)] select-none my-8"
                >
                  🔮
                </motion.div>
                
                <h3 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter text-white animate-pulse">
                  Unlocking Reward Container...
                </h3>
                <p className="text-gray-400 text-sm mt-3 font-bold uppercase tracking-widest">
                  Let the aura organize your cosmic drop!
                </p>
                <div className="flex items-center gap-1 text-xs text-violet-400 mt-6 font-extrabold uppercase tracking-widest animate-bounce">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  <span>Mystical Alignment Live</span>
                </div>
              </div>
            )}

            {/* 2. Revealed drop success visual details */}
            {unboxingState === 'revealed' && revealedDrop && (
              <motion.div
                initial={{ scale: 0.8, y: 50, opacity: 0 }}
                animate={{ scale: 1, y: 0, opacity: 1 }}
                className="max-w-md w-full bg-slate-900/80 border-2 border-violet-500/30 p-8 rounded-[2.5rem] relative overflow-hidden shadow-2xl flex flex-col items-center text-center"
              >
                {/* Back sparkling stars gradient highlights */}
                <div className="absolute top-0 w-full h-48 bg-gradient-to-b from-violet-600/10 to-transparent -z-10 pointer-events-none" />
                
                {/* Glowing Ribbon */}
                <div className="mb-4 bg-violet-500/10 border border-violet-500/20 px-4 py-1.5 rounded-full flex items-center gap-1.5">
                  <Star className="w-3.5 h-3.5 text-violet-400 animate-spin-slow" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-violet-400">
                    {revealedDrop.type === 'hero' ? 'Cosmic Character Unlock' : 
                     revealedDrop.type === 'skin' ? 'Legendary Skin Unlock' : 
                     revealedDrop.type === 'upgrade' ? 'Brawler Upgrade Drop' : 'Treasury Cargo Unboxed'}
                  </span>
                </div>

                {/* Main Asset Render */}
                <div className="w-56 h-56 flex items-center justify-center relative my-6">
                  {/* Decorative backing circles */}
                  <div className="absolute inset-0 bg-violet-600/10 rounded-full blur-xl scale-95 pointer-events-none animate-pulse" />
                  
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
                </h2 >

                {revealedDrop.type === 'upgrade' && revealedDrop.levelFrom && revealedDrop.levelTo && (
                  <p className="text-orange-400 font-extrabold text-sm uppercase tracking-widest mt-2">
                    Level Increase: {revealedDrop.levelFrom} ➔ {revealedDrop.levelTo}
                  </p>
                )}

                {revealedDrop.type === 'coins' && revealedDrop.amount && (
                  <p className="text-yellow-400 font-extrabold text-sm uppercase tracking-widest mt-2 flex items-center gap-1.5 justify-center">
                    <Coins className="w-4 h-4 text-yellow-400" />
                    <span>+{revealedDrop.amount} Coins Received</span>
                  </p>
                )}

                <p className="text-gray-400 text-xs leading-relaxed mt-4 max-w-xs">
                  {revealedDrop.type === 'hero' ? 'A brand shiny new character has been recruited to your team lineup!' :
                   revealedDrop.type === 'skin' ? 'A beautiful legendary cosmetic style has unlocked for your brawlers!' :
                   revealedDrop.type === 'upgrade' ? 'This character immediately obtains power point training bonuses!' :
                   'Coins have been directly deposited to your main ledger.'}
                </p>

                {/* Claim action button */}
                <button
                  onClick={handleCloseUnboxing}
                  className="mt-8 w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white py-4 rounded-2xl font-black italic text-lg uppercase tracking-wider transition-all shadow-[0_5px_0_rgb(109,40,217)] active:translate-y-1 active:shadow-none"
                >
                  Confirm Claim
                </button>

              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
