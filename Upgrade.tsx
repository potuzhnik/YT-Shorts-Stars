/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { motion } from 'motion/react';
import { MousePointer2, Move, Target, Zap } from 'lucide-react';

interface TutorialProps {
  onComplete: () => void;
  onCancel: () => void;
}

export default function Tutorial({ onComplete, onCancel }: TutorialProps) {
  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 md:p-6 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-2xl w-full bg-[#1e293b] border-4 border-yellow-500 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 overflow-hidden relative my-auto"
      >
        <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
           <Zap className="w-48 h-48 md:w-64 md:h-64 text-yellow-500 rotate-12" />
        </div>

        <h2 className="text-3xl md:text-5xl font-black italic uppercase tracking-tighter mb-6 md:mb-12 relative">
          How to brawl
        </h2>

        <div className="space-y-4 md:space-y-8 relative">
          <InstructionRow 
            icon={<Move className="w-6 h-6 md:w-8 md:h-8 text-blue-500" />}
            title="Movement"
            desc="Use the LEFT joystick to move your brawler around the arena."
          />
          <InstructionRow 
            icon={<Target className="w-6 h-6 md:w-8 md:h-8 text-orange-500" />}
            title="Attack"
            desc="Use the RIGHT joystick to aim and shoot. Tap it to auto-aim!"
          />
          <InstructionRow 
            icon={<Zap className="w-6 h-6 md:w-8 md:h-8 text-yellow-500" />}
            title="Ultimate"
            desc="Deal damage to charge your super move. Tap the yellow button!"
          />
          <InstructionRow 
            icon={<MousePointer2 className="w-6 h-6 md:w-8 md:h-8 text-purple-500" />}
            title="Desktop"
            desc="Use WASD to move and MOUSE to aim/shoot."
          />
        </div>

        <div className="mt-8 md:mt-16 flex gap-3 md:gap-4 relative">
          <button
            onClick={onCancel}
            className="flex-1 bg-white/5 hover:bg-white/10 text-white py-4 md:py-6 rounded-xl md:rounded-2xl font-black italic uppercase transition-all text-sm md:text-base"
          >
            Go Back
          </button>
          <button
            onClick={onComplete}
            className="flex-[2] bg-yellow-500 hover:bg-yellow-400 text-black py-4 md:py-6 rounded-xl md:rounded-2xl font-black italic uppercase text-lg md:text-2xl tracking-widest shadow-[0_6px_0_rgb(202,138,4)] md:shadow-[0_8px_0_rgb(202,138,4)] active:translate-y-1 active:shadow-none transition-all"
          >
            I'm Ready!
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function InstructionRow({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) {
  return (
    <div className="flex gap-4 md:gap-6 items-start">
      <div className="w-12 h-12 md:w-16 md:h-16 bg-white/5 rounded-xl md:rounded-2xl flex items-center justify-center border border-white/10 flex-shrink-0">
        {icon}
      </div>
      <div>
        <h4 className="text-base md:text-xl font-black italic uppercase tracking-tight text-white mb-0.5 md:mb-1">{title}</h4>
        <p className="text-gray-400 text-sm md:text-base leading-tight md:leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}
