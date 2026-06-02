/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserData, HeroId } from '../../types';
import { HERO_VERSIONS, HERO_SKINS } from '../../constants';
import { ArrowLeft, Zap, Shield, Sword, Gauge, Sparkles, Wand2, Paintbrush, Timer, Battery } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HeroDetailsProps {
  heroId: HeroId;
  userData: UserData;
  updateUserData: (updater: (prev: UserData) => UserData) => void;
  onBack: () => void;
}

export default function HeroDetails({ heroId, userData, updateUserData, onBack }: HeroDetailsProps) {
  const hero = HERO_VERSIONS[heroId] || HERO_VERSIONS['goose-einstein'];
  const level = userData.heroLevels[heroId] || 1;

  const availableSkins = HERO_SKINS[heroId] || [];
  const ownedSkins = availableSkins.filter(s => userData.ownedSkinIds?.[heroId]?.includes(s.id));
  const selectedSkinId = userData.selectedSkinId?.[heroId];
  const selectedSkin = ownedSkins.find(s => s.id === selectedSkinId);
  const currentImage = selectedSkin?.image || hero.image;

  const handleSelectSkin = (skinId: string | null) => {
    updateUserData(prev => ({
      ...prev,
      selectedSkinId: {
        ...prev.selectedSkinId,
        [heroId]: skinId
      }
    }));
  };

  // Calculated stats based on level + prestige
  const prestigeLevel = userData.heroPrestige?.[heroId] || 0;
  const prestigeMultiplier = 1 + prestigeLevel * 0.05;
  const health = Math.round((hero.stats.health + (level - 1) * 200) * prestigeMultiplier);
  const damage = Math.round((hero.stats.damage + (level - 1) * 50) * prestigeMultiplier);
  const ammoCapacity = hero.stats.ammoCapacity + prestigeLevel;

  const handleApplyPrestige = () => {
    if (heroId !== 'aura-tom' && heroId !== 'capybara') return;
    if (prestigeLevel >= 3) return;

    if (heroId === 'aura-tom') {
      if ((userData.prestigeTokens || 0) <= 0) return;

      updateUserData((prev: UserData): UserData => {
        const currentTokens = prev.prestigeTokens || 0;
        const currentPrestigeMap = prev.heroPrestige || {};
        const nextPrestigeMap: Partial<Record<HeroId, number>> = {
          ...currentPrestigeMap,
          'aura-tom': (currentPrestigeMap['aura-tom'] || 0) + 1
        };

        const result: UserData = {
          ...prev,
          prestigeTokens: currentTokens - 1,
          heroPrestige: nextPrestigeMap
        };
        localStorage.setItem('meme_brawlers_data', JSON.stringify(result));
        return result;
      });
    } else if (heroId === 'capybara') {
      if ((userData.capybaraPrestigeTokens || 0) <= 0) return;

      updateUserData((prev: UserData): UserData => {
        const currentTokens = prev.capybaraPrestigeTokens || 0;
        const currentPrestigeMap = prev.heroPrestige || {};
        const nextPrestigeMap: Partial<Record<HeroId, number>> = {
          ...currentPrestigeMap,
          'capybara': (currentPrestigeMap['capybara'] || 0) + 1
        };

        const result: UserData = {
          ...prev,
          capybaraPrestigeTokens: currentTokens - 1,
          heroPrestige: nextPrestigeMap
        };
        localStorage.setItem('meme_brawlers_data', JSON.stringify(result));
        return result;
      });
    }
  };

  return (
    <div className="w-full h-full bg-[#0f172a] overflow-y-auto">
      <div className="relative w-full h-[300px] flex items-center justify-center overflow-hidden">
        {/* Background Decorative Elements */}
        {currentImage ? (
          <div 
            className="absolute inset-0 opacity-20 blur-3xl rounded-full scale-150"
            style={{ backgroundColor: hero.color }}
          />
        ) : (
          <div 
            className="absolute inset-0 opacity-10"
            style={{ backgroundColor: hero.color }}
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] to-transparent" />
        
        <motion.div
          key={currentImage}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', damping: 15 }}
          className="relative z-10 w-full h-full flex items-center justify-center"
        >
          {currentImage ? (
            <img 
              src={currentImage} 
              alt={hero.name} 
              className="w-auto h-[250px] object-contain filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="text-[12rem] filter drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
               {hero.id === 'goose-einstein' ? '🦢' : hero.id === 'chicken' ? '🐔' : hero.id === 'svinobomba' ? '🐷' : hero.id === 'alcatrasnic' ? '🐹' : hero.id === 'sigeon' ? '🐦' : hero.id === 'bimbolit' ? '💣' : hero.id === 'oreshki' ? '🐿️' : hero.id === 'svin' ? '🐗' : hero.id === 'smurfik' ? '🧚‍♂️' : hero.id === 'pes-patron' ? '🐶' : '👾'}
            </div>
          )}
        </motion.div>
      </div>

      <div className="max-w-5xl mx-auto px-8 pb-20 -mt-12 relative z-20">
        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
          {/* Header Section */}
          <div className="flex-1">
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-blue-400 font-bold uppercase tracking-widest mb-6 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Collection
            </button>
            <h1 className="text-7xl font-black italic uppercase tracking-tighter text-white">
              {hero.name}
            </h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-yellow-500 font-black italic text-2xl uppercase">{hero.title}</span>
              <div className="bg-blue-600 px-3 py-1 rounded text-sm font-black italic">LEVEL {level}</div>
            </div>

            {/* Skin Selector */}
            {ownedSkins.length > 0 && (
              <div className="mt-8">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-gray-500 mb-4">
                  <Paintbrush className="w-4 h-4" />
                  Select Skin
                </div>
                <div className="flex flex-wrap gap-4">
                   <button 
                    onClick={() => handleSelectSkin(null)}
                    className={`w-16 h-16 rounded-xl border-4 transition-all overflow-hidden flex items-center justify-center p-2 ${!selectedSkinId ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 opacity-50'}`}
                   >
                     <div className="text-2xl">{hero.id === 'goose-einstein' ? '🦢' : hero.id === 'chicken' ? '🐔' : hero.id === 'svinobomba' ? '🐷' : hero.id === 'alcatrasnic' ? '🐹' : hero.id === 'sigeon' ? '🐦' : hero.id === 'bimbolit' ? '💣' : hero.id === 'oreshki' ? '🐿️' : hero.id === 'svin' ? '🐗' : hero.id === 'smurfik' ? '🧚‍♂️' : hero.id === 'pes-patron' ? '🐶' : '👾'}</div>
                   </button>
                   {ownedSkins.map(skin => (
                     <button 
                      key={skin.id}
                      onClick={() => handleSelectSkin(skin.id)}
                      className={`w-16 h-16 rounded-xl border-4 transition-all overflow-hidden flex items-center justify-center p-2 ${selectedSkinId === skin.id ? 'border-blue-500 bg-blue-500/10' : 'border-white/10 bg-white/5 opacity-50'}`}
                     >
                       <img src={skin.image} alt={skin.name} className="w-full h-full object-contain" />
                     </button>
                   ))}
                </div>
              </div>
            )}
            
            <p className="text-gray-400 mt-8 text-lg leading-relaxed max-w-2xl">
              {hero.id === 'goose-einstein' && "After finding a pair of abandoned spectacles in a university pond, this goose mastered quantum honking. Now he bends time and space to his will."}
              {hero.id === 'chicken' && "Tired of crossing roads for no reason, this chicken took up martial arts. Fast, aggressive, and highly flammable."}
              {hero.id === 'sigeon' && "A street-smart pigeon who runs the city rooftops. He doesn't just poop—he delivers tactical air strikes."}
              {hero.id === 'svinobomba' && "A farm animal that stumbled into a munitions crate. He is extremely fast, volatile, and has a very suspicious amount of gunpowder in his snout."}
              {hero.id === 'alcatrasnic' && "Don't let the chill attitude fool you. This capybara runs the underworld. He uses his pickle-SMG to maintain order and his medical degree to keep the family alive."}
              {hero.id === 'bimbolit' && "A compact but highly energetic brawler who thrives on chaos. Bimbolit can fly out of danger in a second and leave a circle of devastating bombs for anyone brave enough to follow."}
              {hero.id === 'oreshki' && "A high-precision squirrel with a serious chip (or nut) on his shoulder. With long-range acorn shots and forest-sourced healing, Oreshki is a tough nut to crack."}
              {hero.id === 'svin' && "A massive, battle-hardened boar that excels in close-quarters combat. With his Tough Hide and Iron Rush, Svin is an unstoppable force of nature on the battlefield."}
              {hero.id === 'smurfik' && "A mythical helper holding a mighty spear and a resilience sausage. Smurfik sweeps enemies away with a mid-range gust of wind, heals constantly, and pierces through target packs with dual force."}
              {hero.id === 'pes-patron' && "The legendary Ukrainian mine-sniffing Jack Russell Terrier. Quick, smart, and armed with state-of-the-art tech like invisible mines, automated Bayraktar drones, and directional signal jammers."}
            </p>

            {/* Prestige Section */}
            <div className="mt-8 p-6 rounded-3xl border-2 border-yellow-500/20 bg-gradient-to-br from-slate-900/90 to-amber-950/15 backdrop-blur-md relative overflow-hidden ring-1 ring-yellow-500/10">
              <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 rounded-full blur-2xl pointer-events-none" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">👑</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500">Prestige System</span>
                  </div>
                  <h3 className="text-2xl font-black italic uppercase text-white mt-1">
                    {heroId === 'aura-tom' 
                      ? 'Aura Tom prestige' 
                      : heroId === 'capybara'
                      ? 'Mark Capybara prestige'
                      : 'Prestige locked'}
                  </h3>
                  <div className="flex gap-1.5 mt-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <span key={i} className={`text-lg filter ${i < prestigeLevel ? 'drop-shadow-[0_0_5px_rgba(234,179,8,0.8)]' : 'opacity-20 grayscale'}`}>
                        👑
                      </span>
                    ))}
                    <span className="text-xs font-bold text-gray-400 ml-2 self-center">({prestigeLevel}/3 times)</span>
                  </div>
                </div>

                {(heroId === 'aura-tom' || heroId === 'capybara') ? (
                  prestigeLevel >= 3 ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-black px-4 py-2.5 rounded-2xl text-xs uppercase tracking-wider">
                      ★ Max Prestige reached
                    </div>
                  ) : (
                    <button
                      onClick={handleApplyPrestige}
                      disabled={heroId === 'aura-tom' ? ((userData.prestigeTokens || 0) <= 0) : ((userData.capybaraPrestigeTokens || 0) <= 0)}
                      className={`px-6 py-3 rounded-2xl font-black italic text-sm uppercase tracking-wider border-2 transition-all flex items-center gap-2 shadow-md hover:scale-[1.03] active:scale-[0.98] ${
                        (heroId === 'aura-tom' ? (userData.prestigeTokens || 0) > 0 : (userData.capybaraPrestigeTokens || 0) > 0)
                          ? 'bg-gradient-to-r from-yellow-500 to-amber-600 border-yellow-400 text-slate-950 shadow-[0_4px_0_rgba(180,83,9,0.5)] cursor-pointer'
                          : 'bg-slate-800 border-white/5 text-gray-500 grayscale cursor-not-allowed'
                      }`}
                    >
                      <span>Upgrade Prestige</span>
                      <div className="w-[1px] h-4 bg-slate-950/20" />
                      <span className="text-xs font-black bg-slate-950/10 px-2 py-0.5 rounded-full">
                        Cost: 1 Token
                      </span>
                    </button>
                  )
                ) : (
                  <div className="bg-slate-950/40 text-gray-400/80 font-bold px-4 py-2.5 rounded-2xl text-xs uppercase text-center border border-white/5">
                    No prestige yet
                  </div>
                )}
              </div>

              {heroId === 'aura-tom' ? (
                <div className="mt-4 text-xs text-slate-400 border-t border-white/5 pt-3 leading-relaxed">
                  Consumes 1 <strong className="text-yellow-500">Prestige Token</strong> (Available: {userData.prestigeTokens || 0}). Gives <strong className="text-yellow-400">+5%</strong> health, damage, range, speed, and <strong className="text-orange-400">+1 ammo slot</strong> per prestige stage!
                </div>
              ) : heroId === 'capybara' ? (
                <div className="mt-4 text-xs text-slate-400 border-t border-white/5 pt-3 leading-relaxed">
                  Consumes 1 <strong className="text-yellow-500">Capybara Prestige Token</strong> (Available: {userData.capybaraPrestigeTokens || 0}). Gives <strong className="text-yellow-400">+5%</strong> health, damage, range, speed, and <strong className="text-orange-400">+1 ammo slot</strong> per prestige stage!
                </div>
              ) : (
                <div className="mt-4 text-xs text-slate-500 border-t border-white/5 pt-3">
                  Only <strong className="text-yellow-500">Aura Tom</strong> and <strong className="text-yellow-500">Mark Capybara</strong> have prestige upgrade pathways. Hold onto your tokens! (Standard: {userData.prestigeTokens || 0}, Capybara: {userData.capybaraPrestigeTokens || 0})
                </div>
              )}
            </div>
          </div>

          {/* Stats Box */}
          <div className="w-full md:w-80 bg-white/5 border border-white/10 rounded-3xl p-8 backdrop-blur-md">
            <h3 className="text-xl font-black italic uppercase tracking-wider mb-6 text-gray-400">Core Stats</h3>
            <div className="space-y-6">
              <StatBar icon={<Shield className="text-blue-400" />} label="Survivability" value={Math.min(100, (health / 4000) * 100)} />
              <StatBar icon={<Sword className="text-red-400" />} label="Offense" value={Math.min(100, (damage / 2000) * 100)} />
              <StatBar icon={<Gauge className="text-green-400" />} label="Speed" value={Math.min(100, ((hero.stats.speed * prestigeMultiplier) / 10) * 100)} />
              <StatBar icon={<Battery className="text-emerald-400" />} label="Ammo" value={(ammoCapacity / 12) * 100} />
              <StatBar icon={<Timer className="text-yellow-400" />} label="Reload Speed" value={(1 - (hero.stats.reloadTime / 3000)) * 100} />
            </div>
          </div>
        </div>

        {/* Abilities Grid */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           <AbilityCard 
             type="Main Attack"
             name="Standard Fire"
             desc={`Deals ${damage} damage per hit. Ammo: ${ammoCapacity}. Reload: ${hero.stats.reloadTime}ms.`}
             icon={<Sword className="w-6 h-6" />}
             color="bg-red-500"
           />
           <AbilityCard 
             type="Active Ability"
             name={hero.ability.name}
             desc={hero.ability.description}
             icon={<Zap className="w-6 h-6" />}
             color="bg-blue-600"
             cooldown={`${hero.ability.cooldown / 1000}s`}
           />
           <AbilityCard 
             type="Ultimate Move"
             name={hero.ultimate.name}
             desc={hero.ultimate.description}
             icon={<Wand2 className="w-6 h-6" />}
             color="bg-yellow-500 text-black"
             ultimate
           />
        </div>
        
        {/* Passive Section */}
        <div className="mt-8 bg-gradient-to-r from-purple-900/20 to-transparent p-8 rounded-3xl border border-purple-500/20">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-600 rounded-xl flex items-center justify-center border border-white/20">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <span className="text-xs font-black uppercase tracking-widest text-purple-400">Passive Ability</span>
                <h4 className="text-2xl font-black italic uppercase text-white">{hero.passive}</h4>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatBar({ icon, label, value }: { icon: React.ReactNode, label: string, value: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider">
        <div className="flex items-center gap-2">{icon} {label}</div>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full bg-white/20"
          style={{ 
            backgroundColor: 
              (icon as any).props.className.includes('blue') ? '#3b82f6' : 
              (icon as any).props.className.includes('red') ? '#ef4444' : 
              (icon as any).props.className.includes('green') || (icon as any).props.className.includes('emerald') ? '#10b981' : 
              '#eab308' 
          }}
        />
      </div>
    </div>
  );
}

function AbilityCard({ type, name, desc, icon, color, cooldown, ultimate }: { 
  type: string; 
  name: string; 
  desc: string; 
  icon: React.ReactNode; 
  color: string;
  cooldown?: string;
  ultimate?: boolean;
}) {
  return (
    <div className="bg-white/5 border border-white/10 p-8 rounded-[2rem] flex flex-col items-center text-center group hover:bg-white/10 transition-colors">
      <div className={`w-16 h-16 ${color} rounded-2xl flex items-center justify-center mb-6 shadow-xl border border-white/20 transform group-hover:rotate-12 transition-transform`}>
        {icon}
      </div>
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">{type}</span>
      <h4 className="text-2xl font-black italic uppercase mb-4 text-white line-clamp-1">{name}</h4>
      <p className="text-gray-400 text-sm leading-relaxed mb-6 h-12 line-clamp-2">{desc}</p>
      
      {cooldown && (
        <div className="mt-auto bg-black/40 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest text-blue-400">
          Cooldown: {cooldown}
        </div>
      )}
      
      {ultimate && (
        <div className="mt-auto bg-yellow-500/20 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest text-yellow-500 border border-yellow-500/20 animate-pulse">
          Ultimate Ready
        </div>
      )}
    </div>
  );
}
