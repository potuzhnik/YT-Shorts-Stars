import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  CheckCircle2, 
  Zap, 
  Sparkles, 
  Coins, 
  Award, 
  Trophy, 
  Gift, 
  RefreshCw 
} from 'lucide-react';
import { UserData, DailyQuest } from '../../types';
import { generateDailyQuests, getTodayDateString } from '../../utils/quests';

interface DailyQuestsDialogProps {
  userData: UserData;
  updateUserData: (updater: (prev: UserData) => UserData) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function DailyQuestsDialog({ userData, updateUserData, isOpen, onClose }: DailyQuestsDialogProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const quests = userData.dailyQuests || [];

  // For developer-friendly manual refresh
  const handleForceRefresh = () => {
    setRefreshing(true);
    setTimeout(() => {
      const newQuests = generateDailyQuests();
      updateUserData(prev => ({
        ...prev,
        dailyQuests: newQuests,
        lastQuestsRefresh: getTodayDateString(),
      }));
      setRefreshing(false);
      triggerCelebration('Quests refreshed successfully!');
    }, 600);
  };

  const triggerCelebration = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => {
      setSuccessMessage(null);
    }, 3000);
  };

  const handleClaimReward = (questId: string) => {
    const quest = quests.find(q => q.id === questId);
    if (!quest || quest.claimed || quest.progress < quest.target) return;

    updateUserData(prev => {
      const next = { ...prev };
      
      // Mark as claimed
      if (next.dailyQuests) {
        next.dailyQuests = next.dailyQuests.map(q => 
          q.id === questId ? { ...q, claimed: true } : q
        );
      }

      const reward = quest.reward;
      let claimedString = '';

      switch (reward.type) {
        case 'coins':
          next.coins += reward.amount;
          claimedString = `+${reward.amount} Gold Coins!`;
          break;
        case 'trophies':
          next.trophies = (prev.trophies || 0) + reward.amount;
          claimedString = `+${reward.amount} Trophies!`;
          break;
        case 'svinemarks':
          next.svinemarks = (prev.svinemarks || 0) + reward.amount;
          claimedString = `+${reward.amount} Svinemarks!`;
          break;
        case 'crate_aura':
          next.auraCrates = (prev.auraCrates || 0) + reward.amount;
          claimedString = `+${reward.amount} Aura Crate!`;
          break;
        case 'crate_pearl':
          next.tomPearlCrates = (prev.tomPearlCrates || 0) + reward.amount;
          claimedString = `+${reward.amount} Pearl Crate!`;
          break;
        case 'crate_mango':
          next.mangoCrates = (prev.mangoCrates || 0) + reward.amount;
          claimedString = `+${reward.amount} Mango Crate!`;
          break;
        case 'crate_potuzhno':
          next.potuzhnoCrates = (prev.potuzhnoCrates || 0) + reward.amount;
          claimedString = `+${reward.amount} Potuzhno Crate!`;
          break;
      }

      localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
      
      // Delay because we want it to run after returning the next state
      setTimeout(() => {
        triggerCelebration(`Claimed Reward: ${claimedString}`);
      }, 50);

      return next;
    });
  };

  const getRewardInfo = (reward: DailyQuest['reward']) => {
    switch (reward.type) {
      case 'coins':
        return { label: 'Coins', color: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', emoji: '🪙', icon: <Coins className="w-4 h-4 text-yellow-400" /> };
      case 'trophies':
        return { label: 'Trophies', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20', emoji: '🏆', icon: <Trophy className="w-4 h-4 text-orange-400" /> };
      case 'svinemarks':
        return { label: 'Svinemarks', color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/20', emoji: '🐷', icon: <Award className="w-4 h-4 text-pink-400" /> };
      case 'crate_aura':
        return { label: 'Aura Crate', color: 'text-indigo-400', bg: 'bg-indigo-500/10 border-indigo-500/30', emoji: '🔮', icon: <Gift className="w-4 h-4 text-indigo-400" /> };
      case 'crate_pearl':
        return { label: 'Pearl Crate', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/30', emoji: '🐚', icon: <Gift className="w-4 h-4 text-blue-400" /> };
      case 'crate_mango':
        return { label: 'Mango Crate', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', emoji: '🥭', icon: <Gift className="w-4 h-4 text-amber-400" /> };
      case 'crate_potuzhno':
        return { label: 'Potuzhno Crate', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', emoji: '💪', icon: <Gift className="w-4 h-4 text-red-500" /> };
    }
  };

  const activeQuests = quests.filter(q => !q.claimed);
  const claimedQuests = quests.filter(q => q.claimed);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Blurred Background Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
          />

          {/* Dialog Card Container */}
          <motion.div
            initial={{ scale: 0.95, y: 15, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            className="relative w-full max-w-2xl bg-[#1e293b]/95 border-2 border-yellow-500/30 rounded-[2.5rem] p-6 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden z-10 flex flex-col"
          >
            {/* Ambient Background Glow decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-yellow-500/5 rounded-full blur-[120px] pointer-events-none -z-10" />

            {/* Header Area */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl md:text-4xl">⚡</span>
                <div>
                  <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tight bg-gradient-to-r from-yellow-400 to-amber-500 bg-clip-text text-transparent flex items-center gap-2">
                    Daily Quests
                  </h3>
                  <p className="text-xs text-slate-400 font-medium">Refreshes every 24 hours. Gear up for action!</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {/* Manual Force-Refresh Developer action */}
                <button
                  onClick={handleForceRefresh}
                  disabled={refreshing}
                  title="Reroll Quests"
                  className="bg-slate-800 hover:bg-slate-700 disabled:opacity-50 p-2.5 rounded-full border border-slate-700/60 transition-colors cursor-pointer group flex items-center justify-center"
                >
                  <RefreshCw className={`w-4 h-4 text-slate-300 group-hover:text-yellow-400 ${refreshing ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={onClose}
                  className="bg-slate-800 hover:bg-slate-700 p-2.5 rounded-full border border-slate-700/60 transition-colors"
                >
                  <X className="w-4 h-4 text-slate-300" />
                </button>
              </div>
            </div>

            {/* Notification/Success banner */}
            <AnimatePresence>
              {successMessage && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-4 py-3 rounded-2xl mb-4 font-bold text-xs md:text-sm text-center flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 animate-spin shrink-0 text-emerald-400" />
                  <span>{successMessage}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Quest Lists Scrollable Area */}
            <div className="flex-1 space-y-4 max-h-[60vh] overflow-y-auto pr-1 select-none scrollbar-thin scrollbar-thumb-slate-800">
              
              {quests.length === 0 && (
                <div className="text-center py-12 px-4 border-2 border-dashed border-slate-800 rounded-[2rem] bg-slate-900/40">
                  <p className="text-gray-400 text-sm font-bold">No quests yet! Tap refresh to active quests.</p>
                  <button
                    onClick={handleForceRefresh}
                    disabled={refreshing}
                    className="mt-4 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black italic px-6 py-2.5 rounded-xl text-xs uppercase"
                  >
                    Generate Daily Quests
                  </button>
                </div>
              )}

              {/* Active Quests */}
              {activeQuests.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-yellow-500/80 mb-1 px-1">Active Quests</h4>
                  {activeQuests.map((quest) => {
                    const progressPercent = Math.min(100, (quest.progress / quest.target) * 100);
                    const isCompleted = quest.progress >= quest.target;
                    const meta = getRewardInfo(quest.reward);

                    return (
                      <motion.div
                        key={quest.id}
                        layout
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`p-4 md:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all relative overflow-hidden backdrop-blur-sm ${
                          quest.isHardcore
                            ? 'bg-[#291316]/50 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.06)]'
                            : 'bg-slate-900/50 border-slate-850'
                        }`}
                      >
                        {/* Shimmer element for hardcore */}
                        {quest.isHardcore && (
                          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl pointer-events-none" />
                        )}

                        <div className="flex-1 space-y-2 w-full">
                          {/* Top row description + difficulty */}
                          <div className="flex flex-wrap items-center gap-2">
                            {quest.isHardcore && (
                              <span className="bg-red-500/15 border border-red-500/30 text-red-400 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider animate-pulse flex items-center gap-0.5">
                                <Zap className="w-3 h-3 text-red-500 shrink-0" />
                                Hardcore (5X)
                              </span>
                            )}
                            <p className="text-white text-xs md:text-sm font-black tracking-tight leading-tight">
                              {quest.description}
                            </p>
                          </div>

                          {/* Progress Section */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] font-bold text-slate-400 font-mono">
                              <span>Progress</span>
                              <span className={isCompleted ? 'text-emerald-400 font-extrabold' : 'text-slate-300'}>
                                {quest.progress} / {quest.target} {isCompleted && '✓'}
                              </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700/30 p-[1px]">
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${
                                  isCompleted 
                                    ? 'bg-gradient-to-r from-emerald-400 to-green-500 shadow-[0_0_8px_rgba(52,211,153,0.4)]'
                                    : quest.isHardcore
                                    ? 'bg-gradient-to-r from-red-500 to-orange-400'
                                    : 'bg-gradient-to-r from-yellow-400 to-amber-500'
                                }`}
                                style={{ width: `${progressPercent}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Reward + CTA element */}
                        <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center w-full sm:w-auto shrink-0 border-t sm:border-t-0 border-slate-800 sm:pt-0 pt-3 gap-3">
                          <div className={`flex items-center gap-2 border px-3 py-1.5 rounded-xl leading-none font-black text-xs ${meta.bg}`}>
                            <span className="text-sm shrink-0">{meta.emoji}</span>
                            <span className={meta.color}>{quest.reward.amount} {meta.label}</span>
                          </div>

                          {/* Button Claim or Locked indicator */}
                          {isCompleted ? (
                            <button
                              onClick={() => handleClaimReward(quest.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-[#091a14] font-black italic px-5 py-2 rounded-xl text-xs uppercase tracking-wider shadow-[0_4px_0_theme(colors.emerald.700)] hover:shadow-none hover:translate-y-1 transition-all flex items-center gap-1.5 select-none"
                            >
                              CLAIM!
                            </button>
                          ) : (
                            <div className="text-[10px] font-bold text-slate-500 uppercase px-3 py-2 bg-slate-800/40 rounded-xl border border-slate-800 text-center flex items-center justify-center gap-1">
                              <span>IP: In Progress</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}

              {/* Claimed Quests */}
              {claimedQuests.length > 0 && (
                <div className="space-y-3 pt-2">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 px-1">Completed & Claimed</h4>
                  <div className="space-y-2 opacity-55">
                    {claimedQuests.map((quest) => {
                      const meta = getRewardInfo(quest.reward);
                      return (
                        <div key={quest.id} className="p-3 md:p-4 rounded-xl border border-dashed border-slate-800 bg-slate-900/30 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                            <p className="line-through text-slate-400 text-xs font-bold leading-tight">{quest.description}</p>
                          </div>
                          <span className="text-[10px] uppercase font-black text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border border-emerald-500/10 select-none">Claimed ({quest.reward.amount}{meta.emoji})</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
