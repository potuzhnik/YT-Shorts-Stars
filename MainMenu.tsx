/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useMemo, useState } from 'react';
import { Stage, Layer, Rect, Circle, Group, Text, Image as KonvaImage, Wedge, Line } from 'react-konva';
import { HeroId, GameMode } from '../../types';
import { useGameLoop } from '../../hooks/useGameLoop';
import { motion, AnimatePresence } from 'motion/react';
import { Coins, Heart, Zap, Award, TrendingUp, Timer, Star, Battery } from 'lucide-react';
import { HERO_VERSIONS, GAME_MODES } from '../../constants';
import useImage from 'use-image';

interface ArenaProps {
  heroId: HeroId;
  heroLevel: number;
  skinColor: string;
  skinImage?: string;
  mode: GameMode;
  onFinish: (coins: number, trophies: number, svinemarks: number, won?: boolean, kills?: number) => void;
  multiplayer?: { roomId: string, userId: string, isHost: boolean };
  prestigeLevel?: number;
}

const CharacterModel = ({ heroId, isHidden, skinColor, team, skinImage, name, isPlayer = false, isBoss = false, jammerActiveUntil }: { heroId: HeroId, isHidden: boolean, skinColor: string, team: 'blue' | 'red' | 'green' | 'yellow', skinImage?: string, name?: string, isPlayer?: boolean, isBoss?: boolean, jammerActiveUntil?: number }) => {
  const hero = HERO_VERSIONS[heroId];
  const [image] = useImage(skinImage || hero.image || '');
  const baseSize = isBoss ? 120 : (isPlayer ? 60 : 50);

  const colors = useMemo(() => {
    switch (team) {
      case 'blue': return { fill: "#3b82f644", stroke: "#3b82f6", textFill: "#60a5fa" };
      case 'green': return { fill: "#10b98144", stroke: "#10b981", textFill: "#34d399" };
      case 'yellow': return { fill: "#f59e0b44", stroke: "#f59e0b", textFill: "#fbbf24" };
      case 'red':
      default: return { fill: "#ef444444", stroke: "#ef4444", textFill: "#f87171" };
    }
  }, [team]);

  return (
    <Group opacity={1}>
       {jammerActiveUntil && Date.now() < jammerActiveUntil && (
         <Circle
           radius={baseSize * 1.25}
           stroke="#06b6d4"
           strokeWidth={4}
           dash={[10, 5]}
           shadowBlur={15}
           shadowColor="#06b6d4"
           opacity={0.8}
         />
       )}
       {image ? (
          <KonvaImage
            image={image}
            width={baseSize * 1.8}
            height={baseSize * 1.8}
            x={-baseSize * 0.9}
            y={-baseSize * 0.9}
          />
       ) : (
         <>
           <Circle 
              radius={baseSize} 
              fill={isPlayer ? `${skinColor}44` : colors.fill} 
              stroke={isPlayer ? skinColor : colors.stroke} 
              strokeWidth={3} 
           />
           <Text text={hero.id === 'goose-einstein' ? '🦢' : hero.id === 'chicken' ? '🐔' : hero.id === 'svinobomba' ? '🐷' : hero.id === 'alcatrasnic' ? '🐹' : hero.id === 'bimbolit' ? '💣' : hero.id === 'oreshki' ? '🐿️' : hero.id === 'svin' ? '🐗' : hero.id === 'aura-tom' ? '🎧' : hero.id === 'smurfik' ? '🧚‍♂️' : hero.id === 'pes-patron' ? '🐶' : '🐦'} fontSize={baseSize * 1.2} x={-baseSize * 0.6} y={-baseSize * 0.65} />
         </>
       )}
       {name && (
         <Text 
           text={name} 
           fontSize={14} 
           fontStyle="bold" 
           fill={colors.textFill} 
           x={-30} 
           y={-85} 
           align="center" 
           width={60}
         />
       )}
    </Group>
  );
};

export default function Arena({ heroId, heroLevel, skinColor, skinImage, mode, onFinish, multiplayer, prestigeLevel = 0 }: ArenaProps) {
  const [gameOver, setGameOver] = useState<'WIN' | 'LOSE' | null>(null);
  const [coinsEarned, setCoinsEarned] = useState(0);
  const [trophyChange, setTrophyChange] = useState<number>(0);
  const [finalRanking, setFinalRanking] = useState<number | null>(null);
  const { world, inputRef } = useGameLoop(heroId, heroLevel, skinColor, !!gameOver, mode, multiplayer, prestigeLevel);

  const svinemarksEarned = useMemo(() => {
    if (mode === GameMode.BOSS_FIGHT) {
      return gameOver === 'WIN' ? 100 : 15;
    }
    if (mode === GameMode.BREAKTHROUGH) {
      return world ? ((world as any).mangoPoints || 0) : 0;
    }
    return world ? (((world.player as any).kills || 0) * 15 + (gameOver === 'WIN' ? 25 : 5)) : 0;
  }, [mode, gameOver, world]);

  // Responsive stage sizing
  const [stageSize, setStageSize] = useState({ width: window.innerWidth, height: window.innerHeight });

  useMemo(() => {
    const handleResize = () => setStageSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!world) return null;

  // Win/Loss check
  if (!gameOver && world) {
    if (mode === GameMode.BOSS_FIGHT) {
      const boss = world.bots.find(b => (b as any).isBossEntity);
      const isBossDefeated = !boss || boss.health <= 0;
      const isPlayerDead = world.player.health <= 0;
      const areAllAlliesDead = world.remotePlayers.every(rp => rp.health <= 0);

      if (isBossDefeated) {
        setGameOver('WIN');
        setCoinsEarned(350 + Math.floor(Math.random() * 50));
        setTrophyChange(15);
      } else if (isPlayerDead && areAllAlliesDead) {
        setGameOver('LOSE');
        setCoinsEarned(30 + Math.floor(Math.random() * 15));
        setTrophyChange(-4);
      }
    } else if (mode === GameMode.DUO_SHOWDOWN) {
      const isPlayerDead = world.player.health <= 0;
      const blueAlliesDead = world.remotePlayers.filter(rp => rp.team === 'blue').every(rp => rp.health <= 0) &&
                             world.bots.filter(b => b.team === 'blue').every(b => b.health <= 0);
      
      const enemiesCount = world.bots.filter(b => b.team !== 'blue' && b.health > 0).length +
                           world.remotePlayers.filter(rp => rp.team !== 'blue' && rp.health > 0).length;

      if (isPlayerDead && blueAlliesDead) {
        setGameOver('LOSE');
        setCoinsEarned(35 + Math.floor(Math.random() * 20));
        setTrophyChange(-4);
      } else if (enemiesCount === 0) {
        setGameOver('WIN');
        setFinalRanking(1);
        setCoinsEarned(250 + Math.floor(Math.random() * 100));
        setTrophyChange(12);
      }
    } else if (mode === GameMode.SOLO_SHOWDOWN) {
      if (world.player.health <= 0) {
        setGameOver('LOSE');
        const ranking = world.bots.length + 1;
        setFinalRanking(ranking);
        setCoinsEarned(Math.floor(Math.random() * 30));
        
        let trophyDiff = -8;
        if (ranking === 2) trophyDiff = 6;
        else if (ranking === 3) trophyDiff = 2;
        else if (ranking === 4) trophyDiff = -2;
        else if (ranking === 5) trophyDiff = -5;
        else trophyDiff = -8;
        setTrophyChange(trophyDiff);
      } else if (world.bots.length === 0) {
        setGameOver('WIN');
        setFinalRanking(1);
        setCoinsEarned(200 + Math.floor(Math.random() * 100));
        setTrophyChange(10);
      }
    } else if (mode === GameMode.BREAKTHROUGH) {
      const isPlayerDead = world.player.health <= 0;
      const areAllAlliesDead = world.remotePlayers.length > 0 ? world.remotePlayers.every(p => p.health <= 0) : true;
      if (isPlayerDead && areAllAlliesDead) {
        setGameOver('LOSE');
        const currentWave = (world as any).wave || 0;
        setCoinsEarned(50 + currentWave * 20);
        setTrophyChange(-3);
      } else if ((world as any).waveState === 'victory') {
        setGameOver('WIN');
        setCoinsEarned(500);
        setTrophyChange(15);
      }
    } else {
      // Team modes: Timer-based
      if (world.timeLeft !== undefined && world.timeLeft <= 0) {
         const blueScore = world.scores?.blue || 0;
         const redScore = world.scores?.red || 0;
         if (blueScore > redScore) {
           setGameOver('WIN');
           setCoinsEarned(250);
           setTrophyChange(8);
         } else {
           setGameOver('LOSE');
           setCoinsEarned(50);
           setTrophyChange(-6);
         }
      } else if (world.player.health <= 0) {
        setGameOver('LOSE');
        setCoinsEarned(Math.floor(Math.random() * 50));
        setTrophyChange(-6);
      }
    }
  }

  const cx = stageSize.width / 2 - world.camera.x;
  const cy = stageSize.height / 2 - world.camera.y;

  return (
    <div className="relative w-full h-full touch-none bg-[#111]">
      <Stage width={stageSize.width} height={stageSize.height}>
        <Layer x={cx} y={cy}>
          {/* Background Grid */}
          {mode === GameMode.BREAKTHROUGH ? (
            <>
              {/* Deep Ocean */}
              <Rect x={0} y={0} width={300} height={world.height} fill="#1d4ed8" />
              {/* Shallow Cyanish Water */}
              <Rect x={300} y={0} width={200} height={world.height} fill="#06b6d4" />
              {/* Sandy Shore Beach */}
              <Rect x={500} y={0} width={300} height={world.height} fill="#fef08a" />
              {/* Mango Island Grass / Jungle */}
              <Rect x={800} y={0} width={world.width - 800} height={world.height} fill="#15803d" />
              
              {/* Waves lines */}
              {Array.from({ length: 15 }).map((_, i) => (
                <Line
                  key={`wave-${i}`}
                  points={[
                    400 + Math.sin(Date.now() / 600 + i) * 20,
                    i * (world.height / 15),
                    410 + Math.sin(Date.now() / 600 + i) * 20,
                    i * (world.height / 15) + 30
                  ]}
                  stroke="#ffffffcc"
                  strokeWidth={3}
                  lineCap="round"
                />
              ))}

              {/* Grid on land only */}
              {Array.from({ length: 12 }).map((_, i) => (
                <Rect key={`line-v-${i}`} x={800 + i * 100} y={0} width={2} height={world.height} fill="#ffffff05" />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                <Rect key={`line-h-${i}`} x={800} y={i * 100} width={world.width - 800} height={2} fill="#ffffff05" />
              ))}
              
              {/* Landing Crafts Barge */}
              <Group x={120} y={world.height / 2 - 90}>
                {/* Landing Craft Hull */}
                <Rect
                  x={-80}
                  y={0}
                  width={220}
                  height={180}
                  fill="#64748b"
                  stroke="#475569"
                  strokeWidth={6}
                  cornerRadius={15}
                />
                {/* Metallic stripes */}
                <Rect x={-60} y={20} width={20} height={140} fill="#475569" />
                <Rect x={-20} y={20} width={20} height={140} fill="#475569" />
                <Rect x={20} y={20} width={20} height={140} fill="#475569" />
                
                {/* Steel ramp door */}
                {!(world as any).bargeOpen ? (
                  // Closed Door (ramp up)
                  <Rect
                    x={140}
                    y={5}
                    width={15}
                    height={170}
                    fill="#334155"
                    stroke="#1e293b"
                    strokeWidth={4}
                    cornerRadius={4}
                  />
                ) : (
                  // Open Door (ramp dropped forward)
                  <Rect
                    x={145}
                    y={10}
                    width={110}
                    height={160}
                    fill="#475569"
                    stroke="#334155"
                    strokeWidth={4}
                    cornerRadius={5}
                  />
                )}
                {/* Landing crafts engines and detail */}
                <Rect x={-100} y={40} width={20} height={30} fill="#334155" />
                <Rect x={-100} y={110} width={20} height={30} fill="#334155" />
                <Text text="LANDING CRAFT L-01" x={-50} y={150} fontSize={11} fill="#94a3b8" fontStyle="black" rotation={270} />
              </Group>
            </>
          ) : (
            <>
              <Rect x={0} y={0} width={world.width} height={world.height} fill="#1e293b" />
              {Array.from({ length: 20 }).map((_, i) => (
                 <Rect key={`line-v-${i}`} x={i * 100} y={0} width={2} height={world.height} fill="#ffffff08" />
              ))}
              {Array.from({ length: 20 }).map((_, i) => (
                 <Rect key={`line-h-${i}`} x={0} y={i * 100} width={world.width} height={2} fill="#ffffff08" />
              ))}
            </>
          )}

          {/* Boundaries */}
          <Rect x={-10} y={-10} width={world.width + 20} height={10} fill="#ef4444" />
          <Rect x={-10} y={world.height} width={world.width + 20} height={10} fill="#ef4444" />
          <Rect x={-10} y={0} width={10} height={world.height} fill="#ef4444" />
          <Rect x={world.width} y={0} width={10} height={world.height} fill="#ef4444" />

          {/* Bushes */}
          {world.bushes.map(bush => (
            <Rect 
              key={bush.id} 
              x={bush.x} 
              y={bush.y} 
              width={bush.width} 
              height={bush.height} 
              fill="#166534" 
              cornerRadius={20}
              stroke="#14532d"
              strokeWidth={4}
            />
          ))}

          {/* Destructibles (Crates & Ruins) */}
          {world.destructibles?.map(d => {
            if (d.health <= 0) return null;
            const healthRatio = d.health / d.maxHealth;
            const isCrate = d.type === 'crate';
            const mainColor = isCrate ? '#e08a1e' : '#475569';
            const strokeColor = isCrate ? '#78350f' : '#1e293b';

            return (
              <Group key={d.id}>
                {/* Main Body */}
                <Rect
                  x={d.x}
                  y={d.y}
                  width={d.width}
                  height={d.height}
                  fill={mainColor}
                  stroke={strokeColor}
                  strokeWidth={4}
                  cornerRadius={8}
                />
                
                {/* Details inside the Rect (X on crates, cracks on ruins) */}
                {isCrate ? (
                  <>
                    <Line
                      points={[d.x + 8, d.y + 8, d.x + d.width - 8, d.y + d.height - 8]}
                      stroke="#78350f"
                      strokeWidth={3}
                    />
                    <Line
                      points={[d.x + d.width - 8, d.y + 8, d.x + 8, d.y + d.height - 8]}
                      stroke="#78350f"
                      strokeWidth={3}
                    />
                    {/* Inner wood frame */}
                    <Rect
                      x={d.x + 6}
                      y={d.y + 6}
                      width={d.width - 12}
                      height={d.height - 12}
                      stroke="#78350f"
                      strokeWidth={2.5}
                    />
                  </>
                ) : (
                  <>
                    {/* Bricks / crack lines */}
                    <Line
                      points={[d.x + d.width / 2, d.y + 4, d.x + d.width / 2, d.y + d.height - 4]}
                      stroke="#1e293b"
                      strokeWidth={3}
                    />
                    <Line
                      points={[d.x + 4, d.y + d.height / 2, d.x + d.width - 4, d.y + d.height / 2]}
                      stroke="#1e293b"
                      strokeWidth={3}
                    />
                    <Line
                      points={[d.x + 10, d.y + d.height / 4, d.x + d.width / 2, d.y + d.height / 4]}
                      stroke="#1e293b"
                      strokeWidth={2}
                    />
                    <Line
                      points={[d.x + d.width / 2, d.y + (3 * d.height) / 4, d.x + d.width - 10, d.y + (3 * d.height) / 4]}
                      stroke="#1e293b"
                      strokeWidth={2}
                    />
                  </>
                )}

                {/* Health Bar shown only when damaged */}
                {healthRatio < 1 && (
                  <Group x={d.x} y={d.y - 14}>
                    {/* Background */}
                    <Rect
                      width={d.width}
                      height={8}
                      fill="#ef4444"
                      cornerRadius={3}
                    />
                    {/* Foreground */}
                    <Rect
                      width={d.width * healthRatio}
                      height={8}
                      fill={healthRatio > 0.5 ? '#22c55e' : '#eab308'}
                      cornerRadius={3}
                    />
                    {/* Minimalist text */}
                    <Text
                      text={`${Math.ceil(d.health)} HP`}
                      x={0}
                      y={-11}
                      fontSize={9}
                      fill="#ffffff"
                      fontStyle="bold"
                      align="center"
                      width={d.width}
                    />
                  </Group>
                )}
              </Group>
            );
          })}

          {/* Projectiles */}
          {world.projectiles.map(p => {
            if ((p as any).isWindSlash) {
              const angleDeg = (Math.atan2(p.vy, p.vx) * 180 / Math.PI);
              return (
                <Wedge
                  key={p.id}
                  x={p.x}
                  y={p.y}
                  radius={p.radius * 2}
                  angle={80}
                  fill="rgba(6, 182, 212, 0.45)"
                  stroke="rgba(255, 255, 255, 0.8)"
                  strokeWidth={2}
                  rotation={angleDeg - 40}
                  shadowBlur={8}
                  shadowColor="#22d3ee"
                />
              );
            }
            if ((p as any).isPiercingUlt) {
              const angleRad = Math.atan2(p.vy, p.vx);
              return (
                <Group key={p.id}>
                  <Line
                    points={[
                      -Math.cos(angleRad) * 45, -Math.sin(angleRad) * 45,
                      0, 0
                    ]}
                    x={p.x}
                    y={p.y}
                    stroke="rgba(6, 182, 212, 0.4)"
                    strokeWidth={14}
                    lineCap="round"
                  />
                  <Line
                    points={[
                      -Math.cos(angleRad) * 40, -Math.sin(angleRad) * 40,
                      0, 0
                    ]}
                    x={p.x}
                    y={p.y}
                    stroke="#ffffff"
                    strokeWidth={6}
                    lineCap="round"
                    shadowBlur={12}
                    shadowColor="#06b6d4"
                  />
                </Group>
              );
            }
            if ((p as any).isMangoFlame) {
              return (
                <Circle 
                  key={p.id} 
                  x={p.x} 
                  y={p.y} 
                  radius={p.radius + (Math.random() * 6 - 3)} 
                  fill={Math.random() > 0.4 ? '#facc15' : '#f97316'} 
                  opacity={0.7}
                  shadowBlur={12} 
                  shadowColor="#fbbf24" 
                />
              );
            }
            if ((p as any).isMine) {
              if (p.ownerId === 'player') {
                return (
                  <Group key={p.id} x={p.x} y={p.y}>
                    <Circle
                      radius={p.radius}
                      fill="rgba(251, 191, 36, 0.15)"
                      stroke="rgba(251, 191, 36, 0.4)"
                      strokeWidth={1}
                      dash={[4, 4]}
                    />
                    <Circle
                      radius={6}
                      fill={Math.floor(Date.now() / 300) % 2 === 0 ? '#ef4444' : '#b91c1c'}
                    />
                  </Group>
                );
              }
              return null;
            }
            return (
              <Circle key={p.id} x={p.x} y={p.y} radius={p.radius} fill={p.color} shadowBlur={10} shadowColor={p.color} />
            );
          })}

          {/* Coins */}
          {world.coins.map(coin => (
            <Group key={coin.id} x={coin.x} y={coin.y}>
               <Circle radius={15} fill="#fbbf24" shadowBlur={10} shadowColor="#fbbf24" stroke="#d97706" strokeWidth={2} />
               <Text text="C" fontSize={14} x={-5} y={-7} fill="#d97706" fontStyle="black" />
            </Group>
          ))}

          {/* Bots */}
          {world.bots.map(bot => (
            <Group key={bot.id} x={bot.x} y={bot.y} rotation={bot.rotation} opacity={bot.isHidden ? (bot.team === world.player.team ? 0.35 : 0) : 1}>
               <CharacterModel 
                 heroId={bot.heroId} 
                 isHidden={bot.isHidden} 
                 skinColor="#ef4444" 
                 team={bot.team} 
                 isBoss={!!(bot as any).isBossEntity} 
               />
               {/* Upright Bot Behavior State Label */}
               {bot.health > 0 && (bot as any).behaviorState && (bot as any).behaviorState !== 'patrol' && (
                 <Group y={-76} x={-30} rotation={-bot.rotation}>
                   <Text 
                      text={(bot as any).behaviorState === 'ambushing' ? '⚠️ AMBUSH' : (bot as any).behaviorState.toUpperCase()} 
                      fontSize={8} 
                      fontStyle="black"
                      fill={
                        (bot as any).behaviorState === 'ambushing' ? '#fbbf24' : 
                        (bot as any).behaviorState === 'retreat' ? '#3b82f6' : 
                        (bot as any).behaviorState === 'dodge' ? '#c084fc' : 
                        (bot as any).behaviorState === 'cover' ? '#34d399' : '#f87171'
                      }
                      shadowColor="#000"
                      shadowBlur={4}
                      shadowOffset={{ x: 1, y: 1 }}
                      shadowOpacity={0.9}
                      width={60}
                      align="center"
                   />
                 </Group>
               )}
               {!(bot as any).isBossEntity && (
                 <Group y={-60} x={-30}>
                    <Rect width={60} height={6} fill="#000" cornerRadius={3} />
                    <Rect width={(bot.health / bot.maxHealth) * 60} height={6} fill={bot.team === 'blue' ? "#3b82f6" : "#ef4444"} cornerRadius={3} />
                    <Group y={8}>
                       {Array.from({ length: bot.maxAmmo }).map((_, i) => (
                         <Rect 
                            key={i} 
                            x={i * (60 / bot.maxAmmo) + 1} 
                            y={0} 
                            width={(60 / bot.maxAmmo) - 2} 
                            height={3} 
                            fill={bot.ammo > i ? "#f97316" : "#444"} 
                            cornerRadius={1.5} 
                         />
                       ))}
                    </Group>
                 </Group>
               )}
               {bot.coins > 0 && (
                 <Group y={-85} x={-15}>
                    <Circle radius={10} fill="#fbbf24" />
                    <Text text={bot.coins.toString()} fontSize={12} x={8} y={-6} fill="#fff" fontStyle="black" />
                 </Group>
               )}
            </Group>
          ))}

          {/* Remote Players */}
          {world.remotePlayers?.map(rp => (
             <Group key={rp.id} x={rp.x} y={rp.y} rotation={rp.rotation} opacity={rp.isHidden ? (rp.team === world.player.team ? 0.35 : 0) : 1}>
                <CharacterModel heroId={rp.heroId} isHidden={rp.isHidden} skinColor="#ef4444" team={rp.team} name={rp.name} />
                <Group y={-60} x={-30}>
                   <Rect width={60} height={6} fill="#000" cornerRadius={3} />
                   <Rect width={(rp.health / rp.maxHealth) * 60} height={6} fill={rp.team === 'blue' ? "#3b82f6" : "#ef4444"} cornerRadius={3} />
                   <Group y={8}>
                      {Array.from({ length: rp.maxAmmo }).map((_, i) => (
                        <Rect 
                           key={i} 
                           x={i * (60 / rp.maxAmmo) + 1} 
                           y={0} 
                           width={(60 / rp.maxAmmo) - 2} 
                           height={3} 
                           fill={rp.ammo > i ? "#f97316" : "#444"} 
                           cornerRadius={1.5} 
                        />
                      ))}
                   </Group>
                </Group>
                {rp.coins > 0 && (
                  <Group y={-85} x={-15}>
                     <Circle radius={10} fill="#fbbf24" />
                     <Text text={rp.coins.toString()} fontSize={12} x={8} y={-6} fill="#fff" fontStyle="black" />
                  </Group>
                )}
             </Group>
          ))}

          {/* Bayraktar Drone */}
          {world.player.heroId === 'pes-patron' && (world.player as any).activeDrone && (
            <Group 
              x={(world.player as any).activeDrone.x} 
              y={(world.player as any).activeDrone.y}
              rotation={(world.player as any).activeDrone.rotation || 0}
            >
              {/* Rotor cross */}
              <Line points={[-20, -20, 20, 20]} stroke="#9ca3af" strokeWidth={3} />
              <Line points={[-20, 20, 20, -20]} stroke="#9ca3af" strokeWidth={3} />
              {/* Small glowing/rotating rotors */}
              <Circle x={-20} y={-20} radius={6} fill="rgba(251, 191, 36, 0.6)" stroke="#b45309" strokeWidth={1} />
              <Circle x={20} y={20} radius={6} fill="rgba(251, 191, 36, 0.6)" stroke="#b45309" strokeWidth={1} />
              <Circle x={-20} y={20} radius={6} fill="rgba(251, 191, 36, 0.6)" stroke="#b45309" strokeWidth={1} />
              <Circle x={20} y={-20} radius={6} fill="rgba(251, 191, 36, 0.6)" stroke="#b45309" strokeWidth={1} />
              {/* Main fuselage with camera wing */}
              <Line points={[-12, 0, 12, 0]} stroke="#374151" strokeWidth={8} lineCap="round" />
              <Circle radius={10} fill="#1f2937" stroke="#fbbf24" strokeWidth={1.5} />
              {/* Forward sensor light */}
              <Circle x={0} y={8} radius={3} fill="#ef4444" />
              {/* Drone indicator text */}
              <Text text="BAYRAKTAR" fontSize={11} fill="#fbbf24" fontStyle="black" x={-35} y={-25} width={70} align="center" />
            </Group>
          )}

          {/* Player */}
          <Group x={world.player.x} y={world.player.y} rotation={world.player.rotation} opacity={world.player.isHidden ? 0.45 : 1}>
             {world.player.heroId === 'capybara' && (world.player as any).capybaraUltUntil && Date.now() < (world.player as any).capybaraUltUntil && (
                <Circle 
                   radius={65} 
                   stroke="#facc15" 
                   strokeWidth={4} 
                   dash={[15, 8]}
                   shadowBlur={20} 
                   shadowColor="#facc15" 
                   opacity={0.8}
                />
             )}
             <CharacterModel heroId={world.player.heroId} isHidden={world.player.isHidden} skinColor={skinColor} team={world.player.team} skinImage={skinImage} isPlayer jammerActiveUntil={(world.player as any).jammerActiveUntil} />
             
             {/* Player Status Bar */}
             {world.player.health > 0 && (
               <Group y={-60} x={-30} rotation={-world.player.rotation}>
                  <Rect width={60} height={6} fill="#000" cornerRadius={3} />
                  <Rect width={(world.player.health / world.player.maxHealth) * 60} height={6} fill="#10b981" cornerRadius={3} />
                  <Group y={8}>
                     {Array.from({ length: world.player.maxAmmo }).map((_, i) => (
                       <Rect 
                          key={i} 
                          x={i * (60 / world.player.maxAmmo) + 1} 
                          y={0} 
                          width={(60 / world.player.maxAmmo) - 2} 
                          height={3} 
                          fill={world.player.ammo > i ? "#f97316" : "#444"} 
                          cornerRadius={1.5} 
                       />
                     ))}
                  </Group>
               </Group>
             )}

             {/* Player Damage Indicator */}
             {Date.now() - world.player.lastDamageTime < 200 && (
                <Circle radius={60} fill="#ffffff88" />
             )}
             {world.player.coins > 0 && (
               <Group y={-85} x={-15}>
                  <Circle radius={12} fill="#fbbf24" shadowBlur={5} shadowColor="#fbbf24" />
                  <Text text={world.player.coins.toString()} fontSize={14} x={10} y={-7} fill="#fff" fontStyle="black" />
               </Group>
             )}
          </Group>
        </Layer>
      </Stage>

      {/* Mode Specific Top Bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-6">
        {mode !== GameMode.SOLO_SHOWDOWN && mode !== GameMode.BOSS_FIGHT && mode !== GameMode.BREAKTHROUGH && (
          <div className="flex items-center gap-4 bg-black/60 backdrop-blur-xl px-8 py-4 rounded-3xl border-2 border-white/10 shadow-2xl">
             <div className="text-center">
                <div className="text-[10px] font-black uppercase text-blue-400 tracking-widest mb-1">TEAM BLUE</div>
                <div className="text-4xl font-black italic text-blue-500 tabular-nums leading-none">
                  {mode === GameMode.COIN_RUSH ? world.scores?.blue : world.scores?.blue}
                </div>
             </div>
             
             <div className="w-px h-12 bg-white/10 mx-2" />

             <div className="text-center min-w-[100px]">
                <div className="flex items-center justify-center gap-1 text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">
                  <Timer className="w-3 h-3" />
                  TIME
                </div>
                <div className="text-3xl font-black italic text-white tabular-nums leading-none">
                   {Math.floor((world.timeLeft || 0) / 60)}:{((world.timeLeft || 0) % 60).toString().padStart(2, '0')}
                </div>
             </div>

             <div className="w-px h-12 bg-white/10 mx-2" />

             <div className="text-center">
                <div className="text-[10px] font-black uppercase text-red-400 tracking-widest mb-1">TEAM RED</div>
                <div className="text-4xl font-black italic text-red-500 tabular-nums leading-none">
                  {mode === GameMode.COIN_RUSH ? world.scores?.red : world.scores?.red}
                </div>
             </div>
          </div>
        )}

        {mode === GameMode.BREAKTHROUGH && (
          <div className="flex items-center gap-6 bg-black/75 backdrop-blur-xl px-8 py-4 rounded-3xl border-2 border-yellow-500/20 shadow-[0_0_50px_rgba(234,179,8,0.15)] select-none">
             <div className="text-center font-black">
                <div className="text-[10px] uppercase text-yellow-500 tracking-widest mb-1">🌴 Wave</div>
                <div className="text-4xl italic text-yellow-400 tabular-nums leading-none">
                  {((world as any).wave === 0) ? 'Intro' : ((world as any).wave === 10 ? 'BOSS W10' : (world as any).wave)}
                </div>
             </div>
             
             <div className="w-px h-12 bg-white/15" />

             <div className="text-center font-black min-w-[120px]">
                <div className="text-[10px] uppercase text-gray-400 tracking-widest mb-1">⚔️ Enemies Left</div>
                <div className="text-4xl italic text-white tabular-nums leading-none">
                  {((world as any).wave === 0) ? '--' : world.bots.filter(b => b.health > 0).length}
                </div>
             </div>

             <div className="w-px h-12 bg-white/15" />

             <div className="text-center font-black">
                <div className="text-[10px] uppercase text-orange-400 tracking-widest mb-1">🥭 Mango Points</div>
                <div className="text-4xl italic text-orange-500 tabular-nums leading-none flex items-center justify-center gap-1.5">
                  {(world as any).mangoPoints || 0}
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Landing Intro Loading Banner overlay */}
      {mode === GameMode.BREAKTHROUGH && (world as any).wave === 0 && (
        <div className="absolute inset-0 z-30 bg-blue-950/40 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center"
          >
            <div className="text-yellow-400 text-6xl font-black italic uppercase tracking-widest mb-2 drop-shadow-md animate-pulse">
              Mango Island Landing
            </div>
            <div className="text-white text-lg font-bold uppercase tracking-[0.25em] bg-yellow-500/20 px-6 py-2 rounded-full border border-yellow-500/30">
              Steer the Landcrafts & Secure the Coast!
            </div>
            
            <div className="mt-8 w-64 h-3 bg-black/60 rounded-full border border-white/10 overflow-hidden mx-auto">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: 3.5, ease: "linear" }}
                className="h-full bg-yellow-500"
              />
            </div>
          </motion.div>
        </div>
      )}

      {/* Boss Health Bar Overlay for Breakthrough Mode Wave 10 */}
      {mode === GameMode.BREAKTHROUGH && (world as any).wave === 10 && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none animate-fade-in">
          {(() => {
            const boss = world.bots.find(b => (b as any).isBossEntity);
            if (!boss) return null;
            const hpPercentage = Math.max(0, (boss.health / boss.maxHealth) * 100);
            return (
              <div className="bg-black/75 backdrop-blur-xl px-6 py-4 rounded-3xl border-2 border-yellow-500/35 shadow-[0_0_30px_rgba(234,179,8,0.2)] flex flex-col items-center">
                <div className="flex justify-between w-full items-center mb-1">
                  <span className="font-black text-lg italic text-[#fbbf24] tracking-wider uppercase drop-shadow-[0_0_10px_rgba(251,191,36,0.4)] flex items-center gap-2">
                    👑 {boss.name} { (boss as any).isParrying ? '🛡️ [PARRYING]' : '' }
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-300">
                    {Math.max(0, Math.floor(boss.health)).toLocaleString()} / 200,000 HP
                  </span>
                </div>
                <div className="w-full h-5 bg-slate-900/85 rounded-full overflow-hidden border border-yellow-500/20 shadow-inner">
                  <motion.div
                    initial={false}
                    animate={{ width: `${hpPercentage}%` }}
                    className="h-full bg-gradient-to-r from-yellow-600 via-amber-500 to-yellow-400 shadow-[0_0_20px_rgba(251,191,36,0.6)]"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Boss Health Bar Overlay for Boss Fight */}
      {mode === GameMode.BOSS_FIGHT && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-20 w-full max-w-xl px-4 pointer-events-none">
          {(() => {
            const boss = world.bots.find(b => (b as any).isBossEntity);
            if (!boss) return null;
            const hpPercentage = Math.max(0, (boss.health / boss.maxHealth) * 100);
            return (
              <div className="bg-black/75 backdrop-blur-xl px-6 py-4 rounded-3xl border-2 border-red-500/35 shadow-2xl flex flex-col items-center">
                <div className="flex justify-between w-full items-center mb-1">
                  <span className="font-black text-lg italic text-[#ef4444] tracking-wider uppercase drop-shadow-[0_0_10px_rgba(239,68,68,0.4)]">
                    {boss.name}
                  </span>
                  <span className="font-mono text-xs font-bold text-gray-300">
                    {Math.max(0, Math.floor(boss.health)).toLocaleString()} / 75,000 HP
                  </span>
                </div>
                <div className="w-full h-5 bg-slate-900/85 rounded-full overflow-hidden border border-red-500/20 shadow-inner">
                  <motion.div
                    initial={false}
                    animate={{ width: `${hpPercentage}%` }}
                    className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-red-500 shadow-[0_0_20px_rgba(239,68,68,0.6)]"
                  />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Spectator Tracking Information */}
      {mode === GameMode.BOSS_FIGHT && world.player.health <= 0 && world.remotePlayers.some(rp => rp.health > 0) && (
        <div className="absolute bottom-32 left-1/2 -translate-x-1/2 z-30 bg-black/90 backdrop-blur-md px-6 py-3 rounded-full border-2 border-red-500/30 text-center animate-pulse flex items-center gap-2 shadow-[0_10px_25px_rgba(0,0,0,0.5)]">
          <span className="text-xl">💀</span>
          <span className="font-black uppercase tracking-widest text-[#ef4444] italic text-xs">
            SPECTATING ALLY: {world.remotePlayers.find(rp => rp.health > 0)?.name || 'Teammate'}
          </span>
        </div>
      )}

      {/* HUD */}
      <div className="absolute top-8 left-8 flex items-center gap-4 z-20 pointer-events-none">
         <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
               <Heart className="w-5 h-5 text-red-500 fill-red-500" />
               <span className="font-black text-xl italic uppercase">
                 {mode === GameMode.BOSS_FIGHT && world.player.health <= 0 ? "Spectating Hp" : "Health"}
               </span>
            </div>
            <div className="w-64 h-4 bg-white/10 rounded-full overflow-hidden border border-white/5">
               <motion.div 
                  initial={false}
                  animate={{ 
                    width: `${(
                      mode === GameMode.BOSS_FIGHT && world.player.health <= 0
                        ? ((world.remotePlayers.find(p => p.health > 0)?.health || 0) / (world.remotePlayers.find(p => p.health > 0)?.maxHealth || 1)) * 100
                        : (world.player.health / world.player.maxHealth) * 100
                    )}%` 
                  }}
                  className="h-full bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]"
               />
            </div>
            <div className="text-right text-xs font-bold text-gray-400 mt-1 uppercase">
               {mode === GameMode.BOSS_FIGHT && world.player.health <= 0
                 ? `${Math.max(0, Math.floor(world.remotePlayers.find(p => p.health > 0)?.health || 0))} / ${world.remotePlayers.find(p => p.health > 0)?.maxHealth || 1}`
                 : `${Math.max(0, Math.floor(world.player.health))} / ${world.player.maxHealth}`
               }
            </div>

            {/* Ammo Bar */}
            <div className="flex items-center gap-2 mb-2 mt-4">
               <Battery className="w-5 h-5 text-orange-500 fill-orange-500" />
               <span className="font-black text-xl italic uppercase text-orange-500">Ammo</span>
            </div>
            <div className="flex gap-1">
               {Array.from({ length: world.player.maxAmmo }).map((_, i) => (
                  <div key={i} className="flex-1 h-3 bg-white/10 rounded-full overflow-hidden border border-white/5 min-w-[20px]">
                     <motion.div 
                        initial={false}
                        animate={{ 
                          width: world.player.ammo > i 
                            ? '100%' 
                            : (world.player.ammo === i ? `${(world.player.lastReloadProgress / HERO_VERSIONS[world.player.heroId].stats.reloadTime) * 100}%` : '0%') 
                        }}
                        className="h-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.5)]"
                     />
                  </div>
               ))}
            </div>
         </div>

         <div className="bg-black/60 backdrop-blur-md px-6 py-3 rounded-2xl border border-white/20">
            <div className="flex items-center gap-2 mb-2">
               <Zap className="w-5 h-5 text-yellow-400 fill-yellow-400" />
               <span className="font-black text-xl italic uppercase">ULTIMATE</span>
            </div>
            <div className="w-48 h-3 bg-white/10 rounded-full overflow-hidden">
               <motion.div 
                  initial={false}
                  animate={{ width: `${world.player.ultimateCharge}%` }}
                  className="h-full bg-yellow-400"
               />
            </div>
         </div>
      </div>

      <div className="absolute top-8 right-8 flex flex-col items-end gap-3 z-20">
         {mode === GameMode.SOLO_SHOWDOWN && (
           <div className="bg-black/60 px-6 py-3 rounded-2xl border border-white/20 flex items-center gap-2">
              <Award className="w-6 h-6 text-yellow-500" />
              <span className="font-black text-2xl italic uppercase">{world.bots.length + 1} REmaining</span>
           </div>
         )}
         
         {mode === GameMode.COIN_RUSH && (
           <div className="bg-yellow-500 text-black px-6 py-3 rounded-2xl border-4 border-yellow-300 flex items-center gap-2 shadow-xl">
              <Coins className="w-6 h-6" />
              <span className="font-black text-2xl italic uppercase">{world.player.coins} HELD</span>
           </div>
         )}

         {mode === GameMode.BOUNTY && (
           <div className="bg-purple-600 text-white px-6 py-3 rounded-2xl border-4 border-purple-400 flex items-center gap-2 shadow-xl">
              <Star className="w-6 h-6 fill-white" />
              <span className="font-black text-2xl italic uppercase">STAR HUNTER</span>
           </div>
         )}
      </div>

      {/* Controls */}
      <div className="absolute bottom-6 left-6 w-40 h-40 md:w-56 md:h-56 z-30 opacity-80 active:opacity-100 transition-opacity">
        <Joystick onMove={(v) => { inputRef.current.move = v }} label="MOVE" />
      </div>

      <div className="absolute bottom-6 right-6 w-40 h-40 md:w-56 md:h-56 z-30 opacity-80 active:opacity-100 transition-opacity">
        <Joystick 
          onMove={(v) => { inputRef.current.shoot = v }} 
          onTap={() => { inputRef.current.autoAim = true }}
          label="ATTACK" 
          isAction 
        />
      </div>

      {/* Ability & Ultimate Buttons */}
      <div className="absolute bottom-48 right-6 md:bottom-64 md:right-12 flex flex-col gap-6 z-30">
        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => { inputRef.current.useUltimate = true; }}
          className={`w-20 h-20 md:w-28 md:h-28 rounded-full border-4 flex items-center justify-center shadow-2xl transition-all ${
            world.player.ultimateCharge >= 100 
              ? 'bg-yellow-500 border-yellow-300 animate-pulse' 
              : 'bg-yellow-900/50 border-yellow-700/50 opacity-50'
          }`}
        >
          <Zap className={`w-10 h-10 md:w-14 md:h-14 ${world.player.ultimateCharge >= 100 ? 'text-black fill-black' : 'text-yellow-700'}`} />
          <div className="absolute -top-4 bg-black/80 px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase border border-white/20">ULTIMATE</div>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.8 }}
          onClick={() => { inputRef.current.useAbility = true; }}
          className="w-16 h-16 md:w-24 md:h-24 bg-blue-600 rounded-full border-4 border-blue-400 flex items-center justify-center shadow-2xl relative"
        >
          <TrendingUp className="w-8 h-8 md:w-12 md:h-12 text-white" />
          <div className="absolute -top-4 bg-black/80 px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black uppercase border border-white/20">ABILITY</div>
          {Date.now() < world.player.abilityCooldown && (
             <div className="absolute inset-0 bg-black/70 rounded-full flex items-center justify-center text-sm font-black">
                {Math.ceil((world.player.abilityCooldown - Date.now()) / 1000)}s
             </div>
          )}
        </motion.button>
      </div>

      {/* Game Over Screen */}
      <AnimatePresence>
        {gameOver && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4 lg:p-8"
          >
            <motion.div
              initial={{ scale: 0.5, y: 100 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-slate-800 p-8 lg:p-12 rounded-[2.5rem] lg:rounded-[3rem] border-4 border-yellow-500 shadow-[0_0_50px_rgba(234,179,8,0.3)] max-w-sm w-full text-center"
            >
              <h2 className={`text-4xl lg:text-6xl font-black italic uppercase italic tracking-tighter mb-4 ${gameOver === 'WIN' ? 'text-yellow-400' : 'text-red-500'}`}>
                {gameOver === 'WIN' ? 'victory!' : 'DEFEATED!'}
              </h2>
              <p className="text-gray-400 font-bold uppercase tracking-widest mb-8 text-xs lg:text-base">
                {gameOver === 'WIN' ? 'You clutched the arena!' : 'Better luck next time, meme lord.'}
              </p>
              
              {finalRanking !== null && mode === GameMode.SOLO_SHOWDOWN && (
                <div className="mb-4 text-center">
                  <span className={`inline-block px-5 py-2 rounded-2xl font-black text-lg italic uppercase tracking-wider ${
                    finalRanking <= 3 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' : 'bg-slate-700/50 text-slate-300'
                  }`}>
                    #{finalRanking} Place
                  </span>
                </div>
              )}

              <div className="space-y-3 mb-8">
                {/* Coins reward */}
                <div className="bg-black/40 p-4 lg:p-6 rounded-2xl border border-white/10 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Coins className="w-6 h-6 lg:w-8 lg:h-8 text-yellow-500" />
                    <span className="font-black text-2xl lg:text-3xl italic">+{coinsEarned}</span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-yellow-500 bg-yellow-500/10 px-2.5 py-1 rounded">Coins</span>
                </div>

                {/* Trophy Reward */}
                <div className={`bg-black/40 p-4 lg:p-6 rounded-2xl border flex items-center justify-between ${
                  trophyChange >= 0 ? 'border-emerald-500/20' : 'border-red-500/20'
                }`}>
                  <div className="flex items-center gap-3">
                    <span className="text-2xl lg:text-3xl">{trophyChange >= 0 ? '🏆' : '💀'}</span>
                    <span className={`font-black text-2xl lg:text-3xl italic ${trophyChange >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {trophyChange >= 0 ? `+${trophyChange}` : trophyChange}
                    </span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded ${
                    trophyChange >= 0 ? 'text-emerald-400 bg-emerald-400/10' : 'text-red-400 bg-red-400/10'
                  }`}>
                    Trophies
                  </span>
                </div>

                {/* Svinemarks Reward */}
                <div className="bg-black/40 p-4 lg:p-6 rounded-2xl border border-blue-500/20 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl lg:text-3xl">🐷</span>
                    <span className="font-black text-2xl lg:text-3xl italic text-cyan-400">
                      +{svinemarksEarned}
                    </span>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400 bg-cyan-400/10 px-2.5 py-1 rounded">Svinemarks</span>
                </div>
              </div>

              <button
                onClick={() => {
                  const smEarned = mode === GameMode.BREAKTHROUGH ? ((world as any).mangoPoints || 0) : (((world?.player as any)?.kills || 0) * 15 + (gameOver === 'WIN' ? 25 : 5));
                  onFinish(coinsEarned, trophyChange, smEarned, gameOver === 'WIN', (world?.player as any)?.kills || 0);
                }}
                className="w-full bg-yellow-500 hover:bg-yellow-400 text-black py-4 lg:py-6 rounded-2xl font-black italic text-xl lg:text-2xl uppercase tracking-widest shadow-[0_8px_0_rgb(202,138,4)] active:translate-y-1 active:shadow-none transition-all"
              >
                Continue
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Joystick({ onMove, onTap, label, isAction = false }: { onMove: (pos: { x: number, y: number }) => void, onTap?: () => void, label: string, isAction?: boolean }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);
  const startPosRef = useRef({ x: 0, y: 0 });
  const moveStartedRef = useRef(false);
  const touchIdRef = useRef<number | null>(null);

  const handleStart = (e: React.TouchEvent | React.MouseEvent) => {
    const isTouch = 'touches' in e;
    const touch = isTouch ? e.changedTouches[0] : (e as React.MouseEvent);
    
    if (isTouch) {
      touchIdRef.current = e.changedTouches[0].identifier;
    }

    setActive(true);
    startPosRef.current = { x: touch.clientX, y: touch.clientY };
    moveStartedRef.current = false;
  };

  const handleMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!active) return;
    
    let touch: { clientX: number, clientY: number } | undefined;
    
    if ('touches' in e) {
      // Find the specific touch for this joystick
      const touches = Array.from(e.touches);
      touch = touches.find(t => t.identifier === touchIdRef.current);
    } else {
      touch = e as React.MouseEvent;
    }

    if (!touch) return;

    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.min(60, Math.hypot(dx, dy));
    
    // Check if substantial movement happened to distinguish from tap
    const dragDist = Math.hypot(touch.clientX - startPosRef.current.x, touch.clientY - startPosRef.current.y);
    if (dragDist > 10) moveStartedRef.current = true;

    const angle = Math.atan2(dy, dx);
    const nx = Math.cos(angle) * dist;
    const ny = Math.sin(angle) * dist;

    setPos({ x: nx, y: ny });
    onMove({ x: nx / 60, y: ny / 60 });
  };

  const handleEnd = (e: React.TouchEvent | React.MouseEvent) => {
    if (!active) return;

    if ('touches' in e) {
      const changedTouches = Array.from(e.changedTouches);
      const touch = changedTouches.find(t => t.identifier === touchIdRef.current);
      if (!touch) return; // Not the touch that ended this joystick
    }

    if (!moveStartedRef.current && onTap) {
      onTap();
    }
    
    setActive(false);
    touchIdRef.current = null;
    setPos({ x: 0, y: 0 });
    onMove({ x: 0, y: 0 });
  };

  return (
    <div 
      className="w-full h-full rounded-full bg-white/5 border-2 border-white/10 backdrop-blur-sm relative flex items-center justify-center select-none"
      onMouseDown={handleStart}
      onMouseMove={handleMove}
      onMouseUp={handleEnd}
      onMouseLeave={handleEnd}
      onTouchStart={handleStart}
      onTouchMove={handleMove}
      onTouchEnd={handleEnd}
      onTouchCancel={handleEnd}
    >
      <div className="absolute text-[10px] font-black uppercase text-white/20 tracking-[0.2em]">{label}</div>
      <motion.div
        animate={{ x: pos.x, y: pos.y, scale: active ? 1.1 : 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200 }}
        className={`w-20 h-20 rounded-full shadow-2xl flex items-center justify-center border-4 border-white/20 ${isAction ? 'bg-orange-500' : 'bg-blue-600'}`}
      >
        <div className="w-12 h-12 rounded-full bg-white/20 border border-white/40" />
      </motion.div>
    </div>
  );
}
