/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserData } from '../../types';
import { HERO_VERSIONS } from '../../constants';
import { ArrowLeft, TrendingUp, Coins, Heart, Sword, Zap, Clock } from 'lucide-react';
import { motion } from 'motion/react';

interface UpgradeProps {
  userData: UserData;
  updateUserData: (updater: (prev: UserData) => UserData) => void;
  onBack: () => void;
}

export default function Upgrade({ userData, updateUserData, onBack }: UpgradeProps) {
  const currentHero = HERO_VERSIONS[userData.selectedHeroId] || HERO_VERSIONS['goose-einstein'];
  const currentLevel = userData.heroLevels?.[userData.selectedHeroId] || 1;
  const upgradeCost = 100 * currentLevel;

  const handleUpgrade = () => {
    if (userData.coins >= upgradeCost) {
      updateUserData(prev => ({
        ...prev,
        coins: prev.coins - upgradeCost,
        heroLevels: {
          ...prev.heroLevels,
          [userData.selectedHeroId]: currentLevel + 1,
        },
      }));
    }
  };

  // Scaling factors
  const health = currentHero.stats.health + (currentLevel - 1) * 200;
  const nextHealth = health + 200;
  const damage = currentHero.stats.damage + (currentLevel - 1) * 50;
  const nextDamage = damage + 50;

  return (
    <div className="w-full h-full bg-[#0f172a] p-8 overflow-y-auto">
      <div className="max-w-4xl mx-auto h-full flex flex-col">
        <div className="flex items-center gap-6 mb-12">
          <button
            onClick={onBack}
            className="w-16 h-16 bg-black/40 rounded-2xl flex items-center justify-center hover:bg-black/60 transition-colors border border-white/10"
          >
            <ArrowLeft className="w-8 h-8" />
          </button>
          <div>
            <h1 className="text-5xl font-black italic uppercase tracking-tighter">Level Up</h1>
            <p className="text-yellow-500 font-bold uppercase tracking-widest">Strengthen your {currentHero.name}</p>
          </div>
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          {/* Character Render */}
          <div className="flex flex-col items-center">
            <motion.div
               animate={{ y: [0, -20, 0] }}
               transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
               className="relative flex items-center justify-center min-h-[250px]"
            >
               {currentHero.image ? (
                 <img 
                   src={currentHero.image} 
                   alt={currentHero.name} 
                   className="w-64 h-64 md:w-80 md:h-80 object-contain filter drop-shadow-2xl scale-125"
                   referrerPolicy="no-referrer"
                 />
               ) : (
                 <div className="text-[12rem] filter drop-shadow-2xl">
                    {userData.selectedHeroId === 'goose-einstein' ? '🦢' : userData.selectedHeroId === 'chicken' ? '🐔' : userData.selectedHeroId === 'svinobomba' ? '🐷' : userData.selectedHeroId === 'alcatrasnic' ? '🐹' : '🐦'}
                 </div>
               )}
               <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 w-48 h-12 bg-black/40 blur-xl rounded-[100%] -z-10" />
            </motion.div>
            
            <div className="mt-12 bg-blue-600 px-8 py-3 rounded-2xl font-black italic text-3xl uppercase border-4 border-white/20 shadow-xl">
              Level {currentLevel}
            </div>
          </div>

          {/* Stats & Upgrade Button */}
          <div className="space-y-6">
            <StatRow 
               icon={<Heart className="w-6 h-6 text-red-500" />} 
               label="Health" 
               current={health} 
               next={nextHealth} 
               color="text-red-500"
            />
            <StatRow 
               icon={<Sword className="w-6 h-6 text-orange-500" />} 
               label="Damage" 
               current={damage} 
               next={nextDamage} 
               color="text-orange-500"
            />
            
            <div className="pt-8">
              <button
                onClick={handleUpgrade}
                disabled={userData.coins < upgradeCost}
                className="w-full group relative bg-yellow-500 disabled:opacity-50 disabled:grayscale hover:bg-yellow-400 text-black py-8 rounded-[2rem] font-black italic text-4xl uppercase tracking-widest shadow-[0_12px_0_rgb(202,138,4)] active:translate-y-2 active:shadow-none transition-all flex flex-col items-center justify-center overflow-hidden"
              >
                <div className="flex items-center gap-4">
                  <TrendingUp className="w-8 h-8" />
                  Upgrade
                </div>
                <div className="flex items-center gap-2 text-xl mt-2 opacity-80">
                  <Coins className="w-5 h-5" />
                  {upgradeCost}
                </div>
              </button>
              
              {userData.coins < upgradeCost && (
                <p className="text-center text-red-400 font-bold uppercase text-sm mt-6 animate-pulse">
                  Not enough coins! Go battle some bots!
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Hero Info */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfoCard title="Ability" desc={currentHero.ability.name} detail={currentHero.ability.description} icon={<Zap className="text-blue-400" />} />
          <InfoCard title="Ultimate" desc={currentHero.ultimate.name} detail={currentHero.ultimate.description} icon={<Clock className="text-purple-400" />} />
          <InfoCard title="Passive" desc="Signature Skill" detail={currentHero.passive} icon={<TrendingUp className="text-green-400" />} />
        </div>
      </div>
    </div>
  );
}

function StatRow({ icon, label, current, next, color }: { 
  icon: React.ReactNode; 
  label: string; 
  current: number; 
  next: number;
  color: string;
}) {
  return (
    <div className="bg-white/5 p-6 rounded-3xl border border-white/10 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {icon}
        <span className="font-bold uppercase tracking-wider text-gray-400">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-black italic">{current}</span>
        <div className="w-8 h-4 flex items-center justify-center">
          <div className="w-full h-[2px] bg-white/20" />
        </div>
        <span className={`text-2xl font-black italic ${color}`}>{next}</span>
      </div>
    </div>
  );
}

function InfoCard({ title, desc, detail, icon }: { title: string; desc: string; detail: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-black uppercase tracking-widest text-gray-400">{title}</span>
      </div>
      <h4 className="text-lg font-black italic uppercase text-white truncate">{desc}</h4>
      <p className="text-sm text-gray-400 mt-2 line-clamp-2">{detail}</p>
    </div>
  );
}
