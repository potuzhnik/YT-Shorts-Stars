/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { GameState, UserData, HeroId, GameMode } from './types';
import { INITIAL_USER_DATA, HERO_VERSIONS, HERO_SKINS } from './constants';
import MainMenu from './components/Menu/MainMenu';
import Collection from './components/Menu/Collection';
import Shop from './components/Menu/Shop';
import Upgrade from './components/Menu/Upgrade';
import Arena from './components/Game/Arena';
import Tutorial from './components/Game/Tutorial';
import HeroDetails from './components/Menu/HeroDetails';
import TrophyRoad from './components/Menu/TrophyRoad';
import BattlePass from './components/Menu/BattlePass';
import { generateDailyQuests, getTodayDateString } from './utils/quests';
import DailyQuestsDialog from './components/Menu/DailyQuestsDialog';
import { motion, AnimatePresence } from 'motion/react';
import { auth, subscribeToAuth, signIn, testConnection, db } from './services/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import MangoRainOverlay from './components/Menu/MangoRainOverlay';
import AdminConsole from './components/Menu/AdminConsole';
import { createCustomRoom, joinCustomRoom, joinRoomById, subscribeToRoom, RoomData, updateRoomState, subscribeToPlayers, leaveRoom } from './services/multiplayerService';
import { PartyData, createParty, joinPartyByCode, leaveParty, updatePartyState, updateMemberSelection, subscribeToParty } from './services/partyService';
import { User } from 'firebase/auth';

export default function App() {
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [isDailyQuestsOpen, setIsDailyQuestsOpen] = useState(false);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SOLO_SHOWDOWN);
  const [heroDetailsId, setHeroDetailsId] = useState<HeroId>('goose-einstein');
  const [user, setUser] = useState<User | null>(null);
  const [multiplayer, setMultiplayer] = useState<{ roomId: string, isHost: boolean } | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchingData, setSearchingData] = useState<{ 
    roomId: string; 
    code: string; 
    playersCount: number; 
    isHost: boolean; 
    players: { name: string; heroId: HeroId; userId: string }[] 
  } | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [partyData, setPartyData] = useState<PartyData | null>(null);
  const [partyId, setPartyId] = useState<string | null>(null);
  
  // Admin Abuse & Multi-user Broadcast States
  const [isAdminConsoleOpen, setIsAdminConsoleOpen] = useState(false);
  const [globalAdminMsg, setGlobalAdminMsg] = useState<{ message: string, activeUntil: number, color: string } | null>(null);
  const [isMangoRainActive, setIsMangoRainActive] = useState(false);
  const [mangoRainExpiry, setMangoRainExpiry] = useState(0);

  // Global Sync Multiplier & Interactive Admin States
  const [globalLuckMultiplier, setGlobalLuckMultiplier] = useState(1);
  const [globalLuckExpiry, setGlobalLuckExpiry] = useState(0);
  const [globalCoinMultiplier, setGlobalCoinMultiplier] = useState(1);
  const [globalCoinExpiry, setGlobalCoinExpiry] = useState(0);
  
  const [isSlapTriggered, setIsSlapTriggered] = useState(false);
  const [activeNukeTime, setActiveNukeTime] = useState(0);
  const [secondsToNuke, setSecondsToNuke] = useState<number | null>(null);
  const [isExploded, setIsExploded] = useState(false);

  const lastSlapRef = useRef(0);
  const lastNukeRef = useRef(0);

  const [userData, setUserData] = useState<UserData>(() => {
    const saved = localStorage.getItem('meme_brawlers_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Robust merge with defaults to handle new heroes/properties
        const merged = {
          ...INITIAL_USER_DATA,
          ...parsed,
          heroLevels: { ...INITIAL_USER_DATA.heroLevels, ...(parsed.heroLevels || {}) },
          heroSkins: { ...INITIAL_USER_DATA.heroSkins, ...(parsed.heroSkins || {}) },
          ownedSkinIds: { ...INITIAL_USER_DATA.ownedSkinIds, ...(parsed.ownedSkinIds || {}) },
          selectedSkinId: { ...INITIAL_USER_DATA.selectedSkinId, ...(parsed.selectedSkinId || {}) },
          heroPrestige: { ...INITIAL_USER_DATA.heroPrestige, ...(parsed.heroPrestige || {}) },
        };

        // Validate selected hero exists, otherwise fallback
        if (!HERO_VERSIONS[merged.selectedHeroId]) {
          merged.selectedHeroId = INITIAL_USER_DATA.selectedHeroId;
        }
        return merged;
      } catch (e) {
        return INITIAL_USER_DATA;
      }
    }
    return INITIAL_USER_DATA;
  });

  useEffect(() => {
    testConnection();
  }, []);

  useEffect(() => {
    localStorage.setItem('meme_brawlers_data', JSON.stringify(userData));
  }, [userData]);

  const updateUserData = (data: Partial<UserData> | ((prev: UserData) => UserData)) => {
    setUserData(prev => {
      if (typeof data === 'function') {
        return data(prev);
      }
      return { ...prev, ...data };
    });
  };

  useEffect(() => {
    return subscribeToAuth((u) => {
      setUser(u);
    });
  }, []);

  // Synchronized Firestore Admin Broadcast Message & Mango Rain subscription loop
  useEffect(() => {
    // 1. Expose a global callback for local broadcast feedback without Firestore dependency
    (window as any)._onReceiveBroadcast = (data: any) => {
      if (data && data.activeUntil && Date.now() < data.activeUntil) {
        setGlobalAdminMsg({
          message: data.message,
          activeUntil: data.activeUntil,
          color: data.color || '#f43f5e',
        });
      } else {
        setGlobalAdminMsg(null);
      }

      const now = Date.now();
      if (data && data.rainActiveUntil && now < data.rainActiveUntil) {
        setIsMangoRainActive(true);
        setMangoRainExpiry(data.rainActiveUntil);
      } else {
        setIsMangoRainActive(false);
      }

      // Sync multipliers
      if (data && data.luckMultiplier && data.luckActiveUntil) {
        setGlobalLuckMultiplier(data.luckMultiplier);
        setGlobalLuckExpiry(data.luckActiveUntil);
      }
      if (data && data.coinMultiplier && data.coinActiveUntil) {
        setGlobalCoinMultiplier(data.coinMultiplier);
        setGlobalCoinExpiry(data.coinActiveUntil);
      }

      // Sync slap
      if (data && data.slappedAt && data.slappedAt > lastSlapRef.current) {
        lastSlapRef.current = data.slappedAt;
        setIsSlapTriggered(true);
        setTimeout(() => setIsSlapTriggered(false), 1200);
      }

      // Sync nuke
      if (data && data.nukedAt && data.nukedAt > lastNukeRef.current) {
        if (now < data.nukedAt + 13000) {
          lastNukeRef.current = data.nukedAt;
          setActiveNukeTime(data.nukedAt);
        }
      }
    };

    // 2. Realtime subscription to the Firestore state for multi-player synchronization
    const unsub = onSnapshot(doc(db, 'admin_broadcast', 'current'), (snapshot) => {
      try {
        if (snapshot.exists()) {
          const data = snapshot.data();
          const now = Date.now();
          if (data.activeUntil && now < data.activeUntil) {
            setGlobalAdminMsg({
              message: data.message,
              activeUntil: data.activeUntil,
              color: data.color || '#f43f5e'
            });
          } else {
            setGlobalAdminMsg(null);
          }

          if (data.rainActiveUntil && now < data.rainActiveUntil) {
            setIsMangoRainActive(true);
            setMangoRainExpiry(data.rainActiveUntil);
          } else {
            setIsMangoRainActive(false);
          }

          // Sync multipliers globally
          if (data.luckMultiplier && data.luckActiveUntil) {
            setGlobalLuckMultiplier(data.luckMultiplier);
            setGlobalLuckExpiry(data.luckActiveUntil);
          } else {
            setGlobalLuckMultiplier(1);
            setGlobalLuckExpiry(0);
          }

          if (data.coinMultiplier && data.coinActiveUntil) {
            setGlobalCoinMultiplier(data.coinMultiplier);
            setGlobalCoinExpiry(data.coinActiveUntil);
          } else {
            setGlobalCoinMultiplier(1);
            setGlobalCoinExpiry(0);
          }

          // Slap triggered check
          if (data.slappedAt && data.slappedAt > lastSlapRef.current) {
            lastSlapRef.current = data.slappedAt;
            setIsSlapTriggered(true);

            // Bassy synth "OOF" sound effect
            try {
              const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.type = 'sawtooth';
              osc.frequency.setValueAtTime(150, ctx.currentTime);
              osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
              gain.gain.setValueAtTime(0.15, ctx.currentTime);
              gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
              osc.connect(gain);
              gain.connect(ctx.destination);
              osc.start();
              osc.stop(ctx.currentTime + 0.25);
            } catch (e) {}

            setTimeout(() => {
              setIsSlapTriggered(false);
            }, 1200);
          }

          // Nuke trigger check
          if (data.nukedAt && data.nukedAt > lastNukeRef.current) {
            const timePassed = Date.now() - data.nukedAt;
            if (timePassed < 13000) {
              lastNukeRef.current = data.nukedAt;
              setActiveNukeTime(data.nukedAt);
            }
          }
        }
      } catch (err) {
        console.warn("Firebase snapshot failed or restricted schema:", err);
      }
    }, (err) => {
      console.warn("Firestore snapshot listen aborted:", err);
    });

    return () => {
      unsub();
      delete (window as any)._onReceiveBroadcast;
    };
  }, []);

  // Nuke countdown ticking & explosion force disconnect
  useEffect(() => {
    if (!activeNukeTime) {
      setSecondsToNuke(null);
      setIsExploded(false);
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now();
      const difference = now - activeNukeTime; // ms since nuke initiated
      const count = 10 - Math.floor(difference / 1000);

      if (count > 0) {
        setSecondsToNuke(count);
        setIsExploded(false);
        
        // Bomb ticking tick beep sound
        try {
          const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.frequency.setValueAtTime(800, ctx.currentTime);
          gain.gain.setValueAtTime(0.1, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + 0.15);
        } catch (e) {}

      } else if (difference < 13500) {
        setSecondsToNuke(0);
        setIsExploded(true);

        // Kick from active matches back to main menu
        if (gameState !== GameState.MENU) {
          setGameState(GameState.MENU);
        }

        // Louder atomic bomb white noise explosion rumble
        if (difference >= 10000 && difference < 10500) {
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(200, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 1.0);
            gain.gain.setValueAtTime(0.35, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.3);
          } catch (e) {}
        }
      } else {
        setActiveNukeTime(0);
        setSecondsToNuke(null);
        setIsExploded(false);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [activeNukeTime, gameState]);

  // Set local timer for sliding board self-cleanup
  useEffect(() => {
    if (!globalAdminMsg) return;
    const ticks = globalAdminMsg.activeUntil - Date.now();
    if (ticks <= 0) {
      setGlobalAdminMsg(null);
      return;
    }
    const cleaner = setTimeout(() => setGlobalAdminMsg(null), ticks);
    return () => clearTimeout(cleaner);
  }, [globalAdminMsg]);

  useEffect(() => {
    const today = getTodayDateString();
    if (userData.lastQuestsRefresh !== today || !userData.dailyQuests || userData.dailyQuests.length === 0) {
      updateUserData(prev => ({
        ...prev,
        dailyQuests: generateDailyQuests(),
        lastQuestsRefresh: today,
      }));
    }
  }, []);

  const createRoom = async () => {
    if (!user) {
      try {
        await signIn();
        return;
      } catch (e) {
        console.error("Sign in failed");
        return;
      }
    }

    setIsSearching(true);
    try {
      const { roomId, code } = await createCustomRoom(gameMode, user.uid, user.displayName || 'Player', userData.selectedHeroId);
      setupRoomSubscriptions(roomId, code, true);
    } catch (e) {
      console.error("Failed to create room", e);
      setIsSearching(false);
    }
  };

  const joinRoom = async (code: string) => {
    if (!user) {
      try {
        await signIn();
        return;
      } catch (e) {
        console.error("Sign in failed");
        return;
      }
    }

    setIsSearching(true);
    try {
      const roomId = await joinCustomRoom(code, user.uid, user.displayName || 'Player', userData.selectedHeroId);
      setupRoomSubscriptions(roomId, code, false);
    } catch (e) {
      console.error("Failed to join room", e);
      setIsSearching(false);
      throw e;
    }
  };

  const setupRoomSubscriptions = (roomId: string, code: string, isHost: boolean) => {
    let isStarted = false;

    const unsubPlayers = subscribeToPlayers(roomId, (players) => {
      setSearchingData(prev => ({
        roomId: roomId,
        code: code,
        playersCount: players.length,
        isHost: isHost,
        players: players.map(p => ({
          userId: p.userId,
          name: p.name,
          heroId: p.heroId
        }))
      }));
    });

    const unsubRoom = subscribeToRoom(roomId, (room) => {
      setSearchingData(prev => prev ? {
        ...prev,
        isHost: room.hostId === user?.uid,
        playersCount: room.playerCount || prev.playersCount
      } : null);

      if (room.status === 'playing' && !isStarted) {
        isStarted = true;
        setMultiplayer({ roomId, isHost: room.hostId === user?.uid });
        setGameState(GameState.BATTLE);
        setIsSearching(false);
        setSearchingData(null);
        unsubRoom();
        unsubPlayers();
      }
    });

    (window as any)._cancelMatchmaking = () => {
      unsubRoom();
      unsubPlayers();
      setIsSearching(false);
      setSearchingData(null);
      if (user) {
        leaveRoom(roomId, user.uid).catch(console.error);
      }
    };

    (window as any)._forceStartMatch = () => {
       updateRoomState(roomId, { status: 'playing' }).catch(console.error);
    };
  };

  // Sync hero selection to party lobby when selected hero or selected skin changes
  useEffect(() => {
    if (partyId && user) {
      const selectedSkinId = userData.selectedSkinId?.[userData.selectedHeroId];
      const skins = HERO_SKINS[userData.selectedHeroId] || [];
      const skinImage = skins.find(s => s.id === selectedSkinId)?.image || null;
      const heroLevel = userData.heroLevels?.[userData.selectedHeroId] || 1;
      const prestigeLevel = userData.heroPrestige?.[userData.selectedHeroId] || 0;

      updateMemberSelection(partyId, user.uid, {
        heroId: userData.selectedHeroId,
        skinImage,
        heroLevel,
        prestigeLevel
      }).catch(console.error);
    }
  }, [partyId, user, userData.selectedHeroId, userData.selectedSkinId, userData.heroLevels, userData.heroPrestige]);

  // Subscribe to party changes when partyId is active
  useEffect(() => {
    if (!partyId) return;

    let started = false;
    const unsub = subscribeToParty(partyId, async (party) => {
      setPartyData(party);

      // Check if host initiated starting match, but local player hasn't transitioned yet
      if (party.status === 'match_starting' && party.matchRoomId && !started) {
        started = true;
        const isHost = party.hostId === user?.uid;
        
        // Let the guest also register into the room
        if (!isHost && user) {
          try {
            await joinRoomById(
              party.matchRoomId, // Joining by direct room ID
              user.uid,
              user.displayName || 'Player',
              userData.selectedHeroId,
              'blue' // Friend is on blue/ally team
            );
          } catch (e) {
            console.error("Guest failed to join custom room", e);
          }
        }

        // Set multiplayer config so Arena knows to sync co-op
        setMultiplayer({ 
          roomId: party.matchRoomId, 
          isHost 
        });

        setGameState(GameState.BATTLE);

        // Put party back into 'lobby' status on Firestore so subsequent matches work cleanly!
        if (isHost) {
          await updatePartyState(partyId, {
            status: 'lobby',
            matchRoomId: ""
          });
        }
      }
    });

    return () => {
      unsub();
      setPartyData(null);
    };
  }, [partyId, user]);

  const handleCreateParty = async () => {
    if (!user) {
      try {
        await signIn();
        return;
      } catch (e) {
        console.error("Sign in failed");
        return;
      }
    }
    try {
      const selectedSkinId = userData.selectedSkinId?.[userData.selectedHeroId];
      const skins = HERO_SKINS[userData.selectedHeroId] || [];
      const skinImage = skins.find(s => s.id === selectedSkinId)?.image || null;
      const heroLevel = userData.heroLevels?.[userData.selectedHeroId] || 1;
      const prestigeLevel = userData.heroPrestige?.[userData.selectedHeroId] || 0;

      const { partyId, code } = await createParty(
        user.uid,
        user.displayName || 'Player',
        userData.selectedHeroId,
        skinImage,
        heroLevel,
        prestigeLevel,
        gameMode
      );
      setPartyId(partyId);
    } catch (e) {
      console.error("Failed to create party", e);
    }
  };

  const handleJoinParty = async (code: string): Promise<boolean> => {
    if (!user) {
      try {
        await signIn();
      } catch (e) {
        console.error("Sign in failed");
        return false;
      }
    }
    try {
      const selectedSkinId = userData.selectedSkinId?.[userData.selectedHeroId];
      const skins = HERO_SKINS[userData.selectedHeroId] || [];
      const skinImage = skins.find(s => s.id === selectedSkinId)?.image || null;
      const heroLevel = userData.heroLevels?.[userData.selectedHeroId] || 1;
      const prestigeLevel = userData.heroPrestige?.[userData.selectedHeroId] || 0;

      const pId = await joinPartyByCode(
        code,
        user!.uid,
        user!.displayName || 'Player',
        userData.selectedHeroId,
        skinImage,
        heroLevel,
        prestigeLevel
      );
      setPartyId(pId);
      return true;
    } catch (e) {
      console.error("Failed to join party", e);
      return false;
    }
  };

  const handleLeaveParty = async () => {
    if (partyId && user) {
      await leaveParty(partyId, user.uid);
      setPartyId(null);
      setPartyData(null);
    }
  };

  const handleKickPartyMember = async (targetUserId: string) => {
    if (partyId) {
      await leaveParty(partyId, targetUserId);
    }
  };

  const handleStartPartyMatch = async () => {
    if (!partyId || !user) return;
    try {
      // 1. Create a dynamic multiplayer room for matchmaking
      const { roomId } = await createCustomRoom(
        gameMode,
        user.uid,
        user.displayName || 'Player',
        userData.selectedHeroId
      );

      // 2. Update party so that guest sees the room is starting and has matchRoomId (direct Firestore ID)!
      await updatePartyState(partyId, {
        status: 'match_starting',
        matchRoomId: roomId
      });
    } catch (e) {
      console.error("Failed to start party match", e);
    }
  };

  const playSolo = () => {
    if (!userData.hasSeenTutorial) {
      setGameState(GameState.TUTORIAL);
    } else {
      setGameState(GameState.BATTLE);
    }
  };

  const finishBattle = (coinsEarned: number, trophyChange?: number, svinemarksEarned?: number, won?: boolean, kills?: number) => {
    updateUserData(prev => {
      const isCoinActive = (globalCoinExpiry && Date.now() < globalCoinExpiry) || (prev.adminCoinExpr && Date.now() < prev.adminCoinExpr);
      const coinMult = isCoinActive ? (globalCoinExpiry && Date.now() < globalCoinExpiry ? globalCoinMultiplier : (prev.adminCoinMultiplier || 1)) : 1;
      const finalCoins = Math.round(coinsEarned * coinMult);

      const currentTrophies = prev.trophies || 0;
      const nextTrophies = Math.max(0, currentTrophies + (trophyChange || 0));

      // Update Daily Quests progress
      let updatedQuests = prev.dailyQuests || [];
      if (updatedQuests.length > 0) {
        updatedQuests = updatedQuests.map(q => {
          if (q.claimed) return q;

          let addedProgress = 0;
          if (q.type === 'wins' && won) {
            addedProgress = 1;
          } else if (q.type === 'kills' && kills) {
            addedProgress = kills;
          }

          if (addedProgress > 0) {
            return {
              ...q,
              progress: Math.min(q.target, q.progress + addedProgress)
            };
          }
          return q;
        });
      }

      return {
        ...prev,
        coins: prev.coins + finalCoins,
        trophies: nextTrophies,
        svinemarks: (prev.svinemarks || 0) + (svinemarksEarned || 0),
        mangoPoints: (prev.mangoPoints || 0) + (svinemarksEarned || 0),
        claimedBattlepassSeason2Levels: prev.claimedBattlepassSeason2Levels || [],
        dailyQuests: updatedQuests,
      };
    });
    setGameState(GameState.MENU);
    setMultiplayer(null);
  };

  const finishTutorial = () => {
    updateUserData(prev => ({ ...prev, hasSeenTutorial: true }));
    setGameState(GameState.BATTLE);
  };

  const effectiveUserData = {
    ...userData,
    adminLuckMultiplier: (globalLuckExpiry && Date.now() < globalLuckExpiry) ? globalLuckMultiplier : (userData.adminLuckMultiplier || 1),
    adminLuckExpr: (globalLuckExpiry && Date.now() < globalLuckExpiry) ? globalLuckExpiry : (userData.adminLuckExpr || 0),
    adminCoinMultiplier: (globalCoinExpiry && Date.now() < globalCoinExpiry) ? globalCoinMultiplier : (userData.adminCoinMultiplier || 1),
    adminCoinExpr: (globalCoinExpiry && Date.now() < globalCoinExpiry) ? globalCoinExpiry : (userData.adminCoinExpr || 0),
  };

  const states = [GameState.TROPHY_ROAD, GameState.SHOP, GameState.MENU, GameState.COLLECTION];
  const currentIndex = states.indexOf(gameState);
  const [direction, setDirection] = useState(0);

  const handleEarnMangoPoints = (amount: number) => {
    updateUserData(prev => ({
      ...prev,
      svinemarks: (prev.svinemarks || 0) + amount,
      mangoPoints: (prev.mangoPoints || 0) + amount
    }));
  };

  const navigate = (nextState: GameState) => {
    const nextIndex = states.indexOf(nextState);
    setDirection(nextIndex > currentIndex ? 1 : -1);
    setGameState(nextState);
  };

  const variants = {
    enter: (direction: number) => ({
      x: direction > 0 ? '100%' : direction < 0 ? '-100%' : 0,
      opacity: 0
    }),
    center: {
      x: 0,
      opacity: 1
    },
    exit: (direction: number) => ({
      x: direction < 0 ? '100%' : direction > 0 ? '-100%' : 0,
      opacity: 0
    })
  };

  return (
    <div className={`w-full h-screen bg-[#0f172a] text-white overflow-hidden font-sans select-none touch-none transition-all duration-150 ${
      isSlapTriggered ? 'scale-95 rotate-2 border-8 border-rose-600 shadow-[0_0_50px_rgba(225,29,72,0.6)]' : ''
    } ${
      secondsToNuke !== null ? 'animate-pulse bg-red-950/30 shadow-[inset_0_0_120px_rgba(239,68,68,0.3)]' : ''
    }`}>
      <AnimatePresence initial={false} custom={direction}>
        {currentIndex !== -1 ? (
          <motion.div
            key={gameState}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{
              x: { type: "spring", stiffness: 300, damping: 30 },
              opacity: { duration: 0.2 }
            }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={1}
            onDragEnd={(_, info) => {
              const swipe = Math.abs(info.offset.x) > 50 || Math.abs(info.velocity.x) > 500;
              if (swipe) {
                if (info.offset.x > 0 && currentIndex > 0) {
                  navigate(states[currentIndex - 1]);
                } else if (info.offset.x < 0 && currentIndex < states.length - 1) {
                  navigate(states[currentIndex + 1]);
                }
              }
            }}
            className="w-full h-full absolute inset-0 touch-none flex items-center justify-center overflow-hidden"
          >
            {gameState === GameState.MENU && (
              <MainMenu 
                userData={effectiveUserData} 
                updateUserData={updateUserData}
                selectedMode={gameMode}
                onSelectMode={setGameMode}
                onPlaySolo={playSolo}
                onCreateCustomRoom={createRoom}
                onJoinCustomRoom={joinRoom}
                onNavigate={navigate}
                isOnline={isOnline}
                setIsOnline={setIsOnline}
                isSearching={isSearching}
                searchingData={searchingData}
                onCancelSearch={() => (window as any)._cancelMatchmaking?.()}
                onForceStart={() => (window as any)._forceStartMatch?.()}
                user={user}
                onSignIn={signIn}
                onOpenDailyQuests={() => setIsDailyQuestsOpen(true)}
                onOpenAdminConsole={() => setIsAdminConsoleOpen(true)}
                partyData={partyData}
                onCreateParty={handleCreateParty}
                onJoinParty={handleJoinParty}
                onLeaveParty={handleLeaveParty}
                onKickPartyMember={handleKickPartyMember}
                onStartPartyMatch={handleStartPartyMatch}
              />
            )}
            {gameState === GameState.COLLECTION && (
              <Collection
                userData={effectiveUserData}
                updateUserData={updateUserData}
                onBack={() => navigate(GameState.MENU)}
                onShowDetails={(id) => {
                  setHeroDetailsId(id);
                  setGameState(GameState.DETAILS);
                }}
              />
            )}
            {gameState === GameState.SHOP && (
              <Shop userData={effectiveUserData} updateUserData={updateUserData} onBack={() => navigate(GameState.MENU)} />
            )}
            {gameState === GameState.TROPHY_ROAD && (
              <TrophyRoad
                userData={effectiveUserData}
                updateUserData={updateUserData}
                onBack={() => navigate(GameState.MENU)}
              />
            )}
          </motion.div>
        ) : (
          <div className="w-full h-full absolute inset-0">
            {gameState === GameState.BATTLE_PASS && (
               <motion.div
                key="battlepass"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="w-full h-full animate-fadeIn"
              >
                <BattlePass
                  userData={effectiveUserData}
                  updateUserData={updateUserData}
                  onBack={() => setGameState(GameState.MENU)}
                />
              </motion.div>
            )}

            {gameState === GameState.UPGRADE && (
               <motion.div
                key="upgrade"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="w-full h-full"
              >
                <Upgrade
                  userData={effectiveUserData}
                  updateUserData={updateUserData}
                  onBack={() => setGameState(GameState.MENU)}
                />
              </motion.div>
            )}

            {gameState === GameState.DETAILS && (
              <motion.div
                key="details"
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.1 }}
                className="w-full h-full"
              >
                <HeroDetails 
                  heroId={heroDetailsId} 
                  userData={effectiveUserData} 
                  updateUserData={updateUserData}
                  onBack={() => setGameState(GameState.COLLECTION)} 
                />
              </motion.div>
            )}

            {gameState === GameState.TUTORIAL && (
              <Tutorial onComplete={finishTutorial} onCancel={() => setGameState(GameState.MENU)} />
            )}

            {gameState === GameState.BATTLE && (
              <Arena
                heroId={effectiveUserData.selectedHeroId}
                heroLevel={effectiveUserData.heroLevels?.[effectiveUserData.selectedHeroId] || 1}
                skinColor={effectiveUserData.heroSkins?.[effectiveUserData.selectedHeroId] || '#3b82f6'}
                skinImage={(() => {
                  const selectedSkinId = effectiveUserData.selectedSkinId?.[effectiveUserData.selectedHeroId];
                  const skins = HERO_SKINS[effectiveUserData.selectedHeroId] || [];
                  return skins.find(s => s.id === selectedSkinId)?.image;
                })()}
                mode={gameMode}
                onFinish={finishBattle}
                multiplayer={user && multiplayer ? { ...multiplayer, userId: user.uid } : undefined}
                prestigeLevel={effectiveUserData.heroPrestige?.[effectiveUserData.selectedHeroId] || 0}
              />
            )}
          </div>
        )}
      </AnimatePresence>

      <DailyQuestsDialog
        userData={effectiveUserData}
        updateUserData={updateUserData}
        isOpen={isDailyQuestsOpen}
        onClose={() => setIsDailyQuestsOpen(false)}
      />

      {/* Admin Abuse Overlays */}
      <MangoRainOverlay 
        isActive={isMangoRainActive} 
        expiry={mangoRainExpiry} 
        onEarnMango={handleEarnMangoPoints} 
      />

      <AdminConsole
        isOpen={isAdminConsoleOpen}
        onClose={() => setIsAdminConsoleOpen(false)}
        userData={effectiveUserData}
        updateUserData={updateUserData}
        isOnline={isOnline}
        onLocalMangoRain={(durationSec) => {
          setIsMangoRainActive(true);
          setMangoRainExpiry(Date.now() + durationSec * 1000);
        }}
      />

      {/* Sliding System Announcement Billboard */}
      <AnimatePresence>
        {globalAdminMsg && (
          <motion.div
            initial={{ translateY: -100, opacity: 0 }}
            animate={{ translateY: 0, opacity: 1 }}
            exit={{ translateY: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            className="fixed top-24 inset-x-0 z-[200] pointer-events-none flex justify-center p-4 animate-in"
          >
            <div 
              style={{ borderColor: `${globalAdminMsg.color}80` }}
              className="bg-slate-950/95 backdrop-blur-md border-2 px-6 md:px-8 py-3.5 rounded-2xl md:rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.6)] flex items-center gap-3 md:gap-5 max-w-xl text-center pointer-events-auto"
            >
              <div 
                style={{ backgroundColor: globalAdminMsg.color }}
                className="w-3.5 h-3.5 rounded-full animate-ping shrink-0" 
              />
              <div className="text-left font-sans">
                <span style={{ color: globalAdminMsg.color }} className="text-[10px] md:text-xs font-black uppercase tracking-widest block font-mono">
                  🚨 SYSTEM BROADCAST 🚨
                </span>
                <p className="text-xs md:text-sm text-yellow-100 font-extrabold italic mt-0.5 tracking-wide leading-relaxed">
                  {globalAdminMsg.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roblox-Style Slap Overlay */}
      <AnimatePresence>
        {isSlapTriggered && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -20 }}
            animate={{ scale: [1, 1.2, 1], opacity: 1, rotate: [0, 15, 0] }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ type: "spring", duration: 0.5 }}
            className="fixed inset-0 z-[220] pointer-events-none flex flex-col items-center justify-center bg-rose-600/25 backdrop-blur-[1px]"
          >
            <span className="text-8xl md:text-[12rem] select-none filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]">👋</span>
            <div className="bg-slate-950/95 text-white border-2 border-rose-500 rounded-3xl p-6 shadow-2xl text-center max-w-sm md:max-w-md mt-4 animate-bounce mx-4">
              <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-wider text-rose-500 font-sans">👋 SLAPPED BY ADMIN! 👋</h2>
              <p className="text-xs md:text-sm font-bold text-yellow-105 font-mono mt-2">OOF! MULTIPLAYER ABUSIVE POWER UNLEASHED!</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Roblox-Style Server Nuke Siren UI */}
      <AnimatePresence>
        {secondsToNuke !== null && secondsToNuke > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-12 inset-x-4 md:inset-x-0 z-[210] pointer-events-none flex justify-center"
          >
            <div className="bg-slate-950/95 border-4 border-red-650 text-white p-5 md:p-6 rounded-3xl shadow-[0_0_30px_rgba(239,68,68,0.7)] hover:border-red-500 transition-all text-center flex flex-col items-center gap-2 max-w-md pointer-events-auto animate-pulse">
              <span className="text-3xl md:text-4xl animate-bounce">☢️ 🚨 ☢️</span>
              <h2 className="text-xl md:text-2xl font-sans font-black italic uppercase tracking-widest text-red-500">SERVER NUKE DETECTOR</h2>
              <p className="text-xs font-mono font-bold text-gray-300">ADMIN HAS TRIGGERED COMPLETE DESTRUCTION COUNTDOWN</p>
              <div className="text-5xl md:text-6xl font-mono font-black text-yellow-400 mt-2 tracking-widest bg-red-950/60 px-6 py-2 rounded-2xl border border-red-500/50">
                {secondsToNuke}s
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen Nuclear Blast Impact effect */}
      <AnimatePresence>
        {isExploded && (
          <motion.div
            initial={{ opacity: 0, scale: 0.1 }}
            animate={{ opacity: [1, 1, 0], scale: [1, 4, 10] }}
            transition={{ duration: 3.5, times: [0, 0.4, 1] }}
            className="fixed inset-0 z-[250] bg-gradient-to-tr from-yellow-400 via-amber-500 to-rose-600 flex items-center justify-center pointer-events-none"
          >
            <div className="text-center font-sans p-4">
              <span className="text-[10rem] md:text-[15rem] tracking-widest block select-none">💥</span>
              <h1 className="text-5xl md:text-8xl font-sans font-black italic uppercase tracking-wider text-white shadow-2xl">KABOOM!</h1>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

