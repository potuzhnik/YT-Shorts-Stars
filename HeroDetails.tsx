/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserData, HeroId } from '../../types';
import { HERO_VERSIONS, HERO_SKINS } from '../../constants';
import { ArrowLeft, CheckCircle2, Lock, Coins, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface CollectionProps {
  userData: UserData;
  updateUserData: (updater: (prev: UserData) => UserData) => void;
  onBack: () => void;
  onShowDetails: (id: HeroId) => void;
}

export default function Collection({ userData, updateUserData, onBack, onShowDetails }: CollectionProps) {
  const allHeroes = Object.values(HERO_VERSIONS);

  const selectHero = (id: HeroId) => {
    if (userData.unlockedHeroIds.includes(id)) {
      updateUserData(prev => ({ ...prev, selectedHeroId: id }));
    }
  };

  const unlockHero = (id: HeroId, cost: number) => {
    if (userData.coins >= cost) {
      updateUserData(prev => ({
        ...prev,
        coins: prev.coins - cost,
        unlockedHeroIds: [...prev.unlockedHeroIds, id],
      }));
    }
  };

  const changeSkin = (id: HeroId, color: string) => {
    updateUserData(prev => ({
      ...prev,
      heroSkins: { ...prev.heroSkins, [id]: color }
    }));
  };

  const COLORS = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'];

  return (
    <div className="w-full h-full bg-[#1e293b] p-8 overflow-y-auto">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-6 mb-12">
          <button
            onClick={onBack}
            className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter">My Team</h1>
            <p className="text-blue-400 font-bold uppercase tracking-widest">Collect and select your fighters</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {allHeroes.map(hero => {
            const isUnlocked = userData.unlockedHeroIds.includes(hero.id);
            const isSelected = userData.selectedHeroId === hero.id;
            const skins = HERO_SKINS[hero.id] || [];
            const selectedSkinId = userData.selectedSkinId?.[hero.id];
            const selectedSkin = skins.find(s => s.id === selectedSkinId);
            const currentDisplayImage = selectedSkin?.image || hero.image;

            return (
              <motion.div
                key={hero.id}
                whileHover={{ y: -5 }}
                className={`relative rounded-[2.5rem] overflow-hidden border-4 transition-all ${
                  isSelected ? 'border-yellow-400 shadow-[0_0_40px_rgba(250,204,21,0.2)]' : 'border-white/10'
                }`}
              >
                <div className="aspect-[4/5] relative bg-[#334155] p-6 flex flex-col justify-between">
                  {/* Hero Gradient Background */}
                  <div 
                    className="absolute inset-0 opacity-20"
                    style={{ backgroundColor: userData.heroSkins?.[hero.id] || '#334155' }}
                  />

                  {/* Top Info */}
                  <div className="flex justify-between items-start z-10 w-full">
                    <div className="bg-black/40 px-3 py-1 rounded-lg text-xs font-black uppercase italic border border-white/10 flex items-center gap-1.5">
                      <span>LEVL {userData.heroLevels?.[hero.id] || 1}</span>
                      {userData.heroPrestige?.[hero.id] ? (
                        <span className="text-yellow-400 font-extrabold text-xs" title="Prestige Level">
                          {"👑".repeat(userData.heroPrestige[hero.id])}
                        </span>
                      ) : null}
                    </div>
                    {isSelected && (
                      <div className="bg-yellow-400 text-black px-3 py-1 rounded-lg text-xs font-black uppercase italic">
                        In Use
                      </div>
                    )}
                  </div>

                  {/* Character Vis */}
                  <div className="flex-1 flex items-center justify-center relative z-10">
                    {currentDisplayImage ? (
                      <img 
                        src={currentDisplayImage} 
                        alt={hero.name} 
                        className="w-full h-full object-contain filter drop-shadow-2xl scale-125"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="text-9xl filter drop-shadow-2xl">
                        {hero.id === 'goose-einstein' ? '🦢' : hero.id === 'chicken' ? '🐔' : hero.id === 'svinobomba' ? '🐷' : hero.id === 'alcatrasnic' ? '🐹' : hero.id === 'sigeon' ? '🐦' : hero.id === 'bimbolit' ? '💣' : hero.id === 'oreshki' ? '🐿️' : hero.id === 'svin' ? '🐗' : hero.id === 'aura-tom' ? '🎧' : hero.id === 'smurfik' ? '🧚‍♂️' : hero.id === 'pes-patron' ? '🐶' : '👾'}
                      </div>
                    )}
                    {!isUnlocked && (
                       <div className="absolute inset-0 flex items-center justify-center">
                          <Lock className="w-20 h-20 text-white/20" />
                       </div>
                    )}
                  </div>

                  {/* Bottom Stats */}
                  <div className="z-10 bg-black/40 -mx-6 -mb-6 p-6 backdrop-blur-md">
                    {isUnlocked && (
                      <div className="flex gap-2 mb-4 justify-center">
                        {COLORS.map(color => (
                          <button
                            key={color}
                            onClick={(e) => { e.stopPropagation(); changeSkin(hero.id, color); }}
                            className={`w-6 h-6 rounded-full border-2 ${userData.heroSkins?.[hero.id] === color ? 'border-white' : 'border-transparent'}`}
                            style={{ backgroundColor: color || '#334155' }}
                          />
                        ))}
                      </div>
                    )}
                    <h3 className="text-2xl font-black italic uppercase tracking-tight truncate">
                      {hero.name}
                    </h3>
                    <div className="flex gap-4 mt-2 mb-4 h-1 bg-white/10 rounded-full overflow-hidden">
                       <div className="h-full bg-red-500" style={{ width: `${(hero.stats.health / 4000) * 100}%` }} />
                       <div className="h-full bg-blue-500" style={{ width: `${(hero.stats.damage / 2000) * 100}%` }} />
                    </div>

                    {!isUnlocked ? (
                      <div className="flex gap-4">
                        <button
                          onClick={() => onShowDetails(hero.id)}
                          className="flex-1 bg-white/10 hover:bg-white/20 text-white py-4 rounded-2xl font-black italic uppercase transition-all transform active:scale-95"
                        >
                          Info
                        </button>
                        {hero.id === 'smurfik' ? (
                          <div className="flex-[2] bg-slate-800 text-gray-400 py-4 px-2 rounded-2xl font-black italic uppercase text-xs flex items-center justify-center gap-1.5 border border-white/5 shadow-inner">
                            <Lock className="w-4 h-4 shrink-0 text-red-400 animate-pulse" />
                            <span className="truncate">Unlock in Milestone 10</span>
                          </div>
                        ) : hero.id === 'pes-patron' ? (
                          <div className="flex-[2] bg-slate-800 text-gray-400 py-4 px-2 rounded-2xl font-black italic uppercase text-xs flex items-center justify-center gap-1.5 border border-white/5 shadow-inner">
                            <Lock className="w-4 h-4 shrink-0 text-red-400 animate-pulse" />
                            <span className="truncate">Unlock in Milestone 15</span>
                          </div>
                        ) : hero.id === 'capybara' ? (
                          <div className="flex-[2] bg-slate-800 text-cyan-400 py-4 px-2 rounded-2xl font-black italic uppercase text-[10px] flex items-center justify-center gap-1 border border-cyan-500/20 shadow-inner">
                            <Lock className="w-4 h-4 shrink-0 text-cyan-400 animate-pulse" />
                            <span className="truncate">Unlock in Battlepass 10</span>
                          </div>
                        ) : (
                          <button
                            onClick={() => unlockHero(hero.id, hero.coinsToUnlock)}
                            className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-black py-4 rounded-2xl font-black italic uppercase flex items-center justify-center gap-2 transition-all transform active:scale-95 disabled:opacity-50 disabled:grayscale"
                            disabled={userData.coins < hero.coinsToUnlock}
                          >
                            <Coins className="w-5 h-5" />
                            {hero.coinsToUnlock}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="flex gap-4">
                        <button
                          onClick={() => onShowDetails(hero.id)}
                          className="flex-shrink-0 aspect-square w-14 bg-white/10 hover:bg-white/20 text-white rounded-2xl flex items-center justify-center transition-all transform active:scale-95"
                        >
                          <Sparkles className="w-6 h-6" />
                        </button>
                        <button
                          onClick={() => selectHero(hero.id)}
                          className={`flex-1 py-4 rounded-2xl font-black italic uppercase flex items-center justify-center gap-2 transition-all transform active:scale-95 ${
                            isSelected ? 'bg-white/10 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'
                          }`}
                        >
                          {isSelected ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : null}
                          {isSelected ? 'Selected' : 'Select Hero'}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
