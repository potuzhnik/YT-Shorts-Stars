/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { UserData, HeroId } from '../../types';
import { 
  ArrowLeft, 
  Coins, 
  Sparkles, 
  Trophy, 
  Lock, 
  Check, 
  ChevronRight, 
  Zap, 
  Shuffle,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HERO_SKINS, HERO_VERSIONS } from '../../constants';

interface ShopProps {
  userData: UserData;
  updateUserData: (data: Partial<UserData> | ((prev: UserData) => UserData)) => void;
  onBack: () => void;
}

interface DropResult {
  type: 'hero' | 'skin' | 'upgrade' | 'coins' | 'prestige';
  name: string;
  id?: string; // Skin ID or Hero ID
  image?: string;
  emoji?: string;
  amount?: number;
  heroId?: HeroId;
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
  'smurfik': '🍄',
  'capybara': '🍊',
  'pes-patron': '🐶',
  'aura-scrooge': '💰',
};

export default function Shop({ userData, updateUserData, onBack }: ShopProps) {
  const [openState, setOpenState] = useState<'idle' | 'opening' | 'revealed'>('idle');
  const [activeCrateType, setActiveCrateType] = useState<'aura' | 'pearl' | 'mango' | 'potuzhno'>('aura');
  const [revealedDrop, setRevealedDrop] = useState<DropResult | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Drop selection & activation
  const handleBuyAuraCrate = (isFree: boolean = false) => {
    if (!isFree && userData.coins < 1000) {
      setErrorMessage('Insufficient Coins!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (isFree && (userData.auraCrates || 0) <= 0) {
      setErrorMessage('No Free Crates Available!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setActiveCrateType('aura');

    let selectedDrop: DropResult | null = null;

    const isLuckActive = userData.adminLuckExpr && Date.now() < userData.adminLuckExpr;
    const luckMult = isLuckActive ? (userData.adminLuckMultiplier || 1) : 1;

    // Check 4.2% chance for prestige token (scaled by luck)
    if (Math.random() < Math.min(0.95, 0.042 * luckMult)) {
      selectedDrop = {
        type: 'prestige',
        name: 'Prestige Token',
        emoji: '👑',
      };
    }

    const r = Math.random();

    // List locked Heroes and unowned Skins for calculating rates & fallback checks
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

    // 1) 15% rate: New Character (scaled by luck)
    const baseHeroRate = 0.15 * luckMult;
    const baseSkinRate = 0.15 * luckMult;

    if (r < baseHeroRate && lockedHeroIds.length > 0) {
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

    // 2) 15% rate: New Skin (scaled by luck)
    if (!selectedDrop && (r >= baseHeroRate && r < (baseHeroRate + baseSkinRate)) && unownedSkins.length > 0) {
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

    // 3) 35% rate: Level Upgrade (+1 level to an unlocked hero)
    if (!selectedDrop && (r >= 0.30 && r < 0.65) && userData.unlockedHeroIds.length > 0) {
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

    // 4) 35% rate (or fallback): Coins Return
    if (!selectedDrop) {
      const coinRoll = Math.random();
      let coinsRefunded = 300;
      let title = 'Coin Bag';

      if (coinRoll < 0.50) {
        coinsRefunded = 300;
        title = 'Bronze Coin Stash';
      } else if (coinRoll < 0.80) {
        coinsRefunded = 600;
        title = 'Silver Treasure Satchel';
      } else if (coinRoll < 0.95) {
        coinsRefunded = 1200;
        title = 'Golden Aura Urn';
      } else {
        coinsRefunded = 2500;
        title = 'Jackpot Cosmic Cache!';
      }

      selectedDrop = {
        type: 'coins',
        amount: coinsRefunded,
        name: title,
        emoji: '🪙'
      };
    }

    // Launch unboxing suspense flow
    setOpenState('opening');
    setRevealedDrop(selectedDrop);

    setTimeout(() => {
      // Transition state to fully revealed after shaker stops
      setOpenState('revealed');

      // Execute updates inside the master userData engine
      updateUserData(prev => {
        const next = { ...prev };
        if (isFree) {
          next.auraCrates = Math.max(0, (prev.auraCrates || 0) - 1);
        } else {
          next.coins = prev.coins - 1000; // Crate cost
        }

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
          } else if (selectedDrop.type === 'prestige') {
            next.prestigeTokens = (next.prestigeTokens || 0) + 1;
          }
        }

        // Commit to localStorage immediately as contingency
        localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
        return next;
      });
    }, 1800);
  };

  const handleBuyTomPearlCrate = (isFree: boolean = false) => {
    if (!isFree && userData.coins < 2500) {
      setErrorMessage('Insufficient Coins!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (isFree && (userData.tomPearlCrates || 0) <= 0) {
      setErrorMessage('No Free Pearl Crates Available!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setActiveCrateType('pearl');

    let selectedDrop: DropResult | null = null;

    const isLuckActive = userData.adminLuckExpr && Date.now() < userData.adminLuckExpr;
    const luckMult = isLuckActive ? (userData.adminLuckMultiplier || 1) : 1;

    // Check 8.3% chance for prestige token (scaled by luck)
    if (Math.random() < Math.min(0.95, 0.083 * luckMult)) {
      selectedDrop = {
        type: 'prestige',
        name: 'Prestige Token',
        emoji: '👑',
      };
    }

    const r = Math.random();

    // List locked Heroes and unowned Skins for calculating rates & fallback checks
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

    // Tom Pearl Crate Drop logic: 35% New Hero, 35% New Skin (scaled by luck)
    const baseHeroRate = 0.35 * luckMult;
    const baseSkinRate = 0.35 * luckMult;

    if (r < baseHeroRate && lockedHeroIds.length > 0) {
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
    } else if (r >= baseHeroRate && r < (baseHeroRate + baseSkinRate) && unownedSkins.length > 0) {
      const targetSkin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
      selectedDrop = {
        type: 'skin',
        heroId: targetSkin.heroId,
        id: targetSkin.id,
        name: targetSkin.name,
        image: targetSkin.image,
        emoji: '✨'
      };
    } else if (r >= 0.70 && r < 0.90 && userData.unlockedHeroIds.length > 0) {
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
    } else {
      // Coins return - highly boosted (1500 to 6000 coins)
      const coinRoll = Math.random();
      let coinsRefunded = 1500;
      let title = 'Bronze Pearl Safe';

      if (coinRoll >= 0.70 && coinRoll < 0.90) {
        coinsRefunded = 3000;
        title = 'Silver Pearl Safe';
      } else if (coinRoll >= 0.90) {
        coinsRefunded = 6000;
        title = 'Cosmic Pearl Chest Jackpot!';
      }

      selectedDrop = {
        type: 'coins',
        amount: coinsRefunded,
        name: title,
        emoji: '🪙'
      };
    }

    setOpenState('opening');
    setRevealedDrop(selectedDrop);

    setTimeout(() => {
      setOpenState('revealed');

      updateUserData(prev => {
        const next = { ...prev };
        if (isFree) {
          next.tomPearlCrates = Math.max(0, (prev.tomPearlCrates || 0) - 1);
        } else {
          next.coins = prev.coins - 2500; // Tom Pearl Crate cost
        }

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
          } else if (selectedDrop.type === 'prestige') {
            next.prestigeTokens = (next.prestigeTokens || 0) + 1;
          }
        }

        localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
        return next;
      });
    }, 1800);
  };

  const handleBuyMangoCrate = (isFree: boolean = false) => {
    if (!isFree && userData.coins < 5000) {
      setErrorMessage('Insufficient Coins!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (isFree && (userData.mangoCrates || 0) <= 0) {
      setErrorMessage('No Free Mango Crates Available!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setActiveCrateType('mango');

    let selectedDrop: DropResult | null = null;

    const isLuckActive = userData.adminLuckExpr && Date.now() < userData.adminLuckExpr;
    const luckMult = isLuckActive ? (userData.adminLuckMultiplier || 1) : 1;

    // Check 12.4% chance for prestige token (scaled by luck)
    if (Math.random() < Math.min(0.95, 0.124 * luckMult)) {
      selectedDrop = {
        type: 'prestige',
        name: 'Prestige Token',
        emoji: '👑',
      };
    }

    const r = Math.random();

    // List locked Heroes and unowned Skins for calculating rates & fallback checks
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

    // Mango Crate Drop logic: 40% New Hero, 40% New Skin (scaled by luck)
    const baseHeroRate = 0.40 * luckMult;
    const baseSkinRate = 0.40 * luckMult;

    if (!selectedDrop && r < baseHeroRate && lockedHeroIds.length > 0) {
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
    } else if (!selectedDrop && (r >= baseHeroRate && r < (baseHeroRate + baseSkinRate)) && unownedSkins.length > 0) {
      const targetSkin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
      selectedDrop = {
        type: 'skin',
        heroId: targetSkin.heroId,
        id: targetSkin.id,
        name: targetSkin.name,
        image: targetSkin.image,
        emoji: '✨'
      };
    } else if (!selectedDrop && (r >= 0.80 && r < 0.94) && userData.unlockedHeroIds.length > 0) {
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
    } else if (!selectedDrop) {
      // Coins return (3000 to 12000 coins)
      const coinRoll = Math.random();
      let coinsRefunded = 3000;
      let title = 'Bronze Mango Vault';

      if (coinRoll >= 0.65 && coinRoll < 0.90) {
        coinsRefunded = 6000;
        title = 'Silver Mango Safe Chest';
      } else if (coinRoll >= 0.90) {
        coinsRefunded = 12000;
        title = 'Golden Mango Treasure Jackpot!';
      }

      selectedDrop = {
        type: 'coins',
        amount: coinsRefunded,
        name: title,
        emoji: '🥭'
      };
    }

    setOpenState('opening');
    setRevealedDrop(selectedDrop);

    setTimeout(() => {
      setOpenState('revealed');

      updateUserData(prev => {
        const next = { ...prev };
        if (isFree) {
          next.mangoCrates = Math.max(0, (prev.mangoCrates || 0) - 1);
        } else {
          next.coins = prev.coins - 5000; // Mango Crate cost
        }

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
          } else if (selectedDrop.type === 'prestige') {
            next.prestigeTokens = (next.prestigeTokens || 0) + 1;
          }
        }

        localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
        return next;
      });
    }, 1800);
  };

  const handleBuyPotuzhnoCrate = (isFree: boolean = false) => {
    if (!isFree && userData.coins < 10000) {
      setErrorMessage('Insufficient Coins!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    if (isFree && (userData.potuzhnoCrates || 0) <= 0) {
      setErrorMessage('No Free Potuzhno Crates Available!');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }

    setActiveCrateType('potuzhno');

    let selectedDrop: DropResult | null = null;

    const isLuckActive = userData.adminLuckExpr && Date.now() < userData.adminLuckExpr;
    const luckMult = isLuckActive ? (userData.adminLuckMultiplier || 1) : 1;

    // Check 18.7% chance for prestige token (scaled by luck)
    if (Math.random() < Math.min(0.95, 0.187 * luckMult)) {
      selectedDrop = {
        type: 'prestige',
        name: 'Prestige Token',
        emoji: '👑',
      };
    }

    const r = Math.random();

    // List locked Heroes and unowned Skins for calculating rates & fallback checks
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

    // Potuzhno Crate Drop logic: 45% New Hero, 45% New Skin (scaled by luck)
    const baseHeroRate = 0.45 * luckMult;
    const baseSkinRate = 0.45 * luckMult;

    if (!selectedDrop && r < baseHeroRate && lockedHeroIds.length > 0) {
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
    } else if (!selectedDrop && (r >= baseHeroRate && r < (baseHeroRate + baseSkinRate)) && unownedSkins.length > 0) {
      const targetSkin = unownedSkins[Math.floor(Math.random() * unownedSkins.length)];
      selectedDrop = {
        type: 'skin',
        heroId: targetSkin.heroId,
        id: targetSkin.id,
        name: targetSkin.name,
        image: targetSkin.image,
        emoji: '✨'
      };
    } else if (!selectedDrop && (r >= 0.90 && r < 0.98) && userData.unlockedHeroIds.length > 0) {
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
    } else if (!selectedDrop) {
      // Coins return (6000 to 25000 coins)
      const coinRoll = Math.random();
      let coinsRefunded = 6000;
      let title = 'Bronze Potuzhno Vault';

      if (coinRoll >= 0.60 && coinRoll < 0.85) {
        coinsRefunded = 12000;
        title = 'Silver Potuzhno Coffer';
      } else if (coinRoll >= 0.85) {
        coinsRefunded = 25000;
        title = 'Titanium Potuzhno Megabox Jackpot!';
      }

      selectedDrop = {
        type: 'coins',
        amount: coinsRefunded,
        name: title,
        emoji: '💪'
      };
    }

    setOpenState('opening');
    setRevealedDrop(selectedDrop);

    setTimeout(() => {
      setOpenState('revealed');

      updateUserData(prev => {
        const next = { ...prev };
        if (isFree) {
          next.potuzhnoCrates = Math.max(0, (prev.potuzhnoCrates || 0) - 1);
        } else {
          next.coins = prev.coins - 10000; // Potuzhno Crate cost
        }

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
          } else if (selectedDrop.type === 'prestige') {
            next.prestigeTokens = (next.prestigeTokens || 0) + 1;
          }
        }

        localStorage.setItem('meme_brawlers_data', JSON.stringify(next));
        return next;
      });
    }, 1800);
  };

  // Close unboxing and clean temporary states
  const handleClaim = () => {
    setOpenState('idle');
    setRevealedDrop(null);
  };

  const totalHeroes = Object.keys(HERO_VERSIONS).length;
  const unlockedCount = userData.unlockedHeroIds.length;
  const lockedCount = totalHeroes - unlockedCount;

  // Compile total skins count and unlocked skin metrics
  const totalSkins = Object.values(HERO_SKINS).flat().length;
  const unlockedSkinsCount = Object.values(userData.ownedSkinIds).flat().length;
  const lockedSkinsCount = totalSkins - unlockedSkinsCount;

  return (
    <div className="w-full h-full bg-[#0b1329] p-4 md:p-8 overflow-y-auto text-white">
      <div className="max-w-6xl mx-auto pb-16">
        
        {/* Header Ribbon */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center hover:bg-white/10 hover:border-violet-500/30 transition-all border border-white/10 active:scale-95"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-4xl md:text-5xl font-black italic uppercase tracking-tighter bg-gradient-to-r from-violet-400 via-pink-400 to-yellow-300 bg-clip-text text-transparent drop-shadow-md">
                AURA SHOP
              </h1>
              <p className="text-violet-400 text-xs font-black uppercase tracking-widest mt-1">
                Lootboxes & mystical cosmic drops
              </p>
            </div>
          </div>
          
          <div className="flex gap-4 items-center animate-fade-in">
            <div className="bg-slate-950/85 px-5 py-3 rounded-2xl border-2 border-yellow-500/20 flex items-center gap-3 shadow-[0_0_20px_rgba(234,179,8,0.15)]" title="Prestige Tokens">
               <span className="text-xl">👑</span>
               <span className="text-2xl font-black italic tabular-nums text-yellow-500 leading-none">{userData.prestigeTokens || 0}</span>
            </div>
            <div className="bg-slate-950/85 px-5 py-3 rounded-2xl border-2 border-violet-500/20 flex items-center gap-3 shadow-[0_0_20px_rgba(139,92,246,0.15)]">
               <Coins className="w-5 h-5 text-yellow-400 animate-pulse" />
               <span className="text-2xl font-black italic tabular-nums text-yellow-400 leading-none">{userData.coins}</span>
            </div>
          </div>
        </div>

        {/* Crate Centerpiece Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT CONTAINER: Dual-Crate grid */}
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* CARD 1: Interactive Aura Crate */}
            <div className="bg-slate-900/60 border-2 border-violet-500/25 rounded-[2.5rem] p-6 relative overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(139,92,246,0.05)] flex flex-col items-center text-center">
              
              {/* Visual background aura gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-violet-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
              <div className="absolute -bottom-10 left-10 w-40 h-40 bg-pink-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />

              {/* Glowing Tag */}
              <div className="absolute top-5 left-5 flex items-center gap-1.5 bg-violet-500/10 px-3 py-1.5 rounded-full border border-violet-500/20 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-violet-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-violet-400">Cosmic Tier</span>
              </div>

              {/* Interactive Box Stage */}
              <div className="relative w-full aspect-square max-w-[200px] flex items-center justify-center my-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    y: [0, -8, 0],
                    rotateY: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative cursor-pointer select-none"
                  onClick={() => {
                    if ((userData.auraCrates || 0) > 0) {
                      handleBuyAuraCrate(true);
                    } else {
                      handleBuyAuraCrate(false);
                    }
                  }}
                >
                  {/* 3D Circular Aura */}
                  <div className="absolute inset-0 bg-violet-500/10 rounded-full blur-2xl scale-110 animate-pulse pointer-events-none" />
                  
                  {/* Large stylish crate text design and custom layers */}
                  <div className="text-[7rem] md:text-[8rem] select-none filter drop-shadow-[0_0_35px_rgba(168,85,247,0.4)]">
                    🔮
                  </div>
                  
                  {/* Embedded dynamic sparkles */}
                  <div className="absolute top-4 left-0 text-xl animate-bounce">✨</div>
                  <div className="absolute bottom-3 right-4 text-lg animate-pulse">🌟</div>
                </motion.div>
              </div>

              {/* Crate Information */}
              <div className="max-w-md flex-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white flex items-center justify-center gap-2">
                  AURA CRATE
                </h3>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Excellent entry-level lootbox! Offers regular unlock rates for characters, rare skins, level power ups and decent gold refunds.
                </p>
              </div>

              {/* Pricing Section */}
              <div className="w-full mt-6 space-y-3">
                {(userData.auraCrates || 0) > 0 && (
                  <button
                    onClick={() => handleBuyAuraCrate(true)}
                    className="w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all bg-gradient-to-r from-cyan-500 via-violet-500 to-fuchsia-600 hover:from-cyan-400 hover:to-fuchsia-500 text-white shadow-[0_4px_0_rgb(109,40,217)] active:translate-y-1 active:shadow-none animate-pulse flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-300 pointer-events-none" />
                    <span>Open Free Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-300 font-bold">{(userData.auraCrates || 0)} left</span>
                  </button>
                )}

                <button
                  onClick={() => handleBuyAuraCrate(false)}
                  disabled={userData.coins < 1000}
                  className={`w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all shadow-[0_4px_0_rgb(109,40,217)] active:translate-y-1 active:shadow-none ${
                    userData.coins >= 1000
                      ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white'
                      : 'bg-slate-800 text-gray-500 border border-white/5 cursor-not-allowed shadow-none'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>Buy Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-400">1000 Coins</span>
                  </div>
                </button>
              </div>
            </div>

            {/* CARD 2: Interactive Tom Pearl Crate (NEW CRATE!) */}
            <div className="bg-[#101f3d]/60 border-2 border-cyan-400/35 rounded-[2.5rem] p-6 relative overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(34,211,238,0.08)] flex flex-col items-center text-center">
              
              {/* Visual background aura gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-cyan-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
              <div className="absolute -bottom-10 left-10 w-40 h-40 bg-teal-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />

              {/* Glowing Tag */}
              <div className="absolute top-5 left-5 flex items-center gap-1.5 bg-cyan-500/15 px-3 py-1.5 rounded-full border border-cyan-400/30 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-cyan-400">Royal Pearl Tier</span>
              </div>

              {/* Interactive Box Stage */}
              <div className="relative w-full aspect-square max-w-[200px] flex items-center justify-center my-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    y: [0, -8, 0],
                    rotateY: [0, -5, 5, 0]
                  }}
                  transition={{ 
                    duration: 4.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative cursor-pointer select-none"
                  onClick={() => {
                    if ((userData.tomPearlCrates || 0) > 0) {
                      handleBuyTomPearlCrate(true);
                    } else {
                      handleBuyTomPearlCrate(false);
                    }
                  }}
                >
                  {/* 3D Circular Aura */}
                  <div className="absolute inset-0 bg-cyan-500/10 rounded-full blur-2xl scale-110 animate-pulse pointer-events-none" />
                  
                  {/* Large stylish crate text design and custom layers */}
                  <div className="text-[7rem] md:text-[8rem] select-none filter drop-shadow-[0_0_35px_rgba(34,211,238,0.5)]">
                    🐚
                  </div>
                  
                  {/* Embedded dynamic sparkles */}
                  <div className="absolute top-4 right-0 text-xl animate-bounce">💎</div>
                  <div className="absolute bottom-3 left-3 text-lg animate-pulse">⚪</div>
                </motion.div>
              </div>

              {/* Crate Information */}
              <div className="max-w-md flex-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-400 to-indigo-300 bg-clip-text text-transparent">
                  TOM PEARL CRATE
                </h3>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Supercharged royal crate! Offers massive <strong className="text-cyan-400">35% Hero</strong> and <strong className="text-cyan-400">35% Skin</strong> unlock rates, alongside highly boosted, stellar coin rewards!
                </p>
              </div>

              {/* Pricing Section */}
              <div className="w-full mt-6 space-y-3">
                {(userData.tomPearlCrates || 0) > 0 && (
                  <button
                    onClick={() => handleBuyTomPearlCrate(true)}
                    className="w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all bg-gradient-to-r from-cyan-400 via-teal-500 to-emerald-600 hover:from-cyan-300 hover:to-emerald-500 text-white shadow-[0_4px_0_rgb(13,148,136)] active:translate-y-1 active:shadow-none animate-pulse flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-300 pointer-events-none" />
                    <span>Open Free Pearl Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-200 font-bold">{(userData.tomPearlCrates || 0)} left</span>
                  </button>
                )}

                <button
                  onClick={() => handleBuyTomPearlCrate(false)}
                  disabled={userData.coins < 2500}
                  className={`w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all shadow-[0_4px_0_rgb(13,148,136)] active:translate-y-1 active:shadow-none ${
                    userData.coins >= 2500
                      ? 'bg-gradient-to-r from-cyan-500 via-teal-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white'
                      : 'bg-slate-800 text-gray-500 border border-white/5 cursor-not-allowed shadow-none'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>Buy Pearl Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-400">2500 Coins</span>
                  </div>
                </button>
              </div>
            </div>

            {/* CARD 3: Interactive Mango Crate (NEW CRATE!) */}
            <div className="bg-[#241b10]/60 border-2 border-amber-500/35 rounded-[2.5rem] p-6 relative overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(245,158,11,0.08)] flex flex-col items-center text-center">
              
              {/* Visual background aura gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-amber-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
              <div className="absolute -bottom-10 left-10 w-40 h-40 bg-orange-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />

              {/* Glowing Tag */}
              <div className="absolute top-5 left-5 flex items-center gap-1.5 bg-amber-500/15 px-3 py-1.5 rounded-full border border-amber-500/30 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">Sweet Mango Tier</span>
              </div>

              {/* Interactive Box Stage */}
              <div className="relative w-full aspect-square max-w-[200px] flex items-center justify-center my-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    y: [0, -8, 0],
                    rotateY: [0, 5, -5, 0]
                  }}
                  transition={{ 
                    duration: 4.8, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative cursor-pointer select-none"
                  onClick={() => {
                    if ((userData.mangoCrates || 0) > 0) {
                      handleBuyMangoCrate(true);
                    } else {
                      handleBuyMangoCrate(false);
                    }
                  }}
                >
                  {/* 3D Circular Aura */}
                  <div className="absolute inset-0 bg-amber-500/10 rounded-full blur-2xl scale-110 animate-pulse pointer-events-none" />
                  
                  {/* Large stylish crate text */}
                  <div className="text-[7rem] md:text-[8rem] select-none filter drop-shadow-[0_0_35px_rgba(245,158,11,0.5)]">
                    🥭
                  </div>
                  
                  {/* Embedded dynamic sparkles */}
                  <div className="absolute top-4 left-0 text-xl animate-bounce">🌟</div>
                  <div className="absolute bottom-3 right-4 text-lg animate-pulse">✨</div>
                </motion.div>
              </div>

              {/* Crate Information */}
              <div className="max-w-md flex-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white flex items-center justify-center gap-2 bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
                  MANGO CRATE
                </h3>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Sweet tropical treasure! Offers incredible <strong className="text-amber-400">12.4% Prestige</strong> chance, and balanced <strong className="text-amber-400">40% rates</strong> for rare characters & skins!
                </p>
              </div>

              {/* Pricing Section */}
              <div className="w-full mt-6 space-y-3">
                {(userData.mangoCrates || 0) > 0 && (
                  <button
                    onClick={() => handleBuyMangoCrate(true)}
                    className="w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all bg-gradient-to-r from-amber-400 via-orange-500 to-yellow-650 hover:from-amber-300 hover:to-yellow-500 text-white shadow-[0_4px_0_rgb(217,119,6)] active:translate-y-1 active:shadow-none animate-pulse flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-300 pointer-events-none" />
                    <span>Open Free Mango Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-200 font-bold">{(userData.mangoCrates || 0)} left</span>
                  </button>
                )}

                <button
                  onClick={() => handleBuyMangoCrate(false)}
                  disabled={userData.coins < 5000}
                  className={`w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all shadow-[0_4px_0_rgb(217,119,6)] active:translate-y-1 active:shadow-none ${
                    userData.coins >= 5000
                      ? 'bg-gradient-to-r from-amber-500 via-orange-500 to-orange-600 hover:from-amber-450 hover:to-orange-550 text-white'
                      : 'bg-slate-800 text-gray-500 border border-white/5 cursor-not-allowed shadow-none'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>Buy Mango Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-400">5000 Coins</span>
                  </div>
                </button>
              </div>
            </div>

            {/* CARD 4: Interactive Potuzhno Crate (NEW CRATE!) */}
            <div className="bg-[#291013]/60 border-2 border-red-500/35 rounded-[2.5rem] p-6 relative overflow-hidden backdrop-blur-xl shadow-[0_0_40px_rgba(239,68,68,0.12)] flex flex-col items-center text-center">
              
              {/* Visual background aura gradients */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-80 h-80 bg-red-600/10 rounded-full blur-[100px] pointer-events-none -z-10" />
              <div className="absolute -bottom-10 left-10 w-40 h-40 bg-pink-500/5 rounded-full blur-[80px] pointer-events-none -z-10" />

              {/* Glowing Tag */}
              <div className="absolute top-5 left-5 flex items-center gap-1.5 bg-red-500/15 px-3 py-1.5 rounded-full border border-red-500/30 shadow-sm animate-pulse">
                <Zap className="w-3.5 h-3.5 text-red-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-red-400">Potuzhno Overdrive Tier</span>
              </div>

              {/* Interactive Box Stage */}
              <div className="relative w-full aspect-square max-w-[200px] flex items-center justify-center my-4">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  animate={{ 
                    y: [0, -10, 0],
                    rotate: [0, 4, -4, 0]
                  }}
                  transition={{ 
                    duration: 3.5, 
                    repeat: Infinity, 
                    ease: "easeInOut" 
                  }}
                  className="relative cursor-pointer select-none"
                  onClick={() => {
                    if ((userData.potuzhnoCrates || 0) > 0) {
                      handleBuyPotuzhnoCrate(true);
                    } else {
                      handleBuyPotuzhnoCrate(false);
                    }
                  }}
                >
                  {/* 3D Circular Aura */}
                  <div className="absolute inset-0 bg-red-500/20 rounded-full blur-3xl scale-125 animate-pulse pointer-events-none" />
                  
                  {/* Large stylish crate text */}
                  <div className="text-[7rem] md:text-[8rem] select-none filter drop-shadow-[0_0_40px_rgba(239,68,68,0.6)]">
                    💪
                  </div>
                  
                  {/* Embedded dynamic sparkles */}
                  <div className="absolute top-4 right-0 text-xl animate-bounce">⚡</div>
                  <div className="absolute bottom-3 left-3 text-lg animate-pulse">💥</div>
                </motion.div>
              </div>

              {/* Crate Information */}
              <div className="max-w-md flex-1">
                <h3 className="text-2xl font-black italic uppercase tracking-tight text-white flex items-center justify-center gap-2 bg-gradient-to-r from-red-500 via-orange-400 to-yellow-400 bg-clip-text text-transparent">
                  POTUZHNO CRATE
                </h3>
                <p className="text-gray-400 text-xs mt-2 leading-relaxed">
                  Ultimate power unboxing! Unlocks a massive <strong className="text-red-400">18.7% Prestige Upgradeable</strong> chance and huge UP-chances on rare characters & skins (<strong className="text-red-400">45% each</strong>)!
                </p>
              </div>

              {/* Pricing Section */}
              <div className="w-full mt-6 space-y-3">
                {(userData.potuzhnoCrates || 0) > 0 && (
                  <button
                    onClick={() => handleBuyPotuzhnoCrate(true)}
                    className="w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all bg-gradient-to-r from-red-500 via-orange-500 to-yellow-650 hover:from-red-400 hover:to-yellow-500 text-white shadow-[0_4px_0_rgb(185,28,28)] active:translate-y-1 active:shadow-none animate-pulse flex items-center justify-center gap-2"
                  >
                    <Sparkles className="w-4 h-4 shrink-0 text-yellow-300 pointer-events-none" />
                    <span>Open Free Potuzhno Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-200 font-bold">{(userData.potuzhnoCrates || 0)} left</span>
                  </button>
                )}

                <button
                  onClick={() => handleBuyPotuzhnoCrate(false)}
                  disabled={userData.coins < 10000}
                  className={`w-full relative group py-4 rounded-xl font-black italic text-lg uppercase tracking-widest transition-all shadow-[0_4px_0_rgb(185,28,28)] active:translate-y-1 active:shadow-none ${
                    userData.coins >= 10000
                      ? 'bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-400 hover:to-yellow-450 text-white'
                      : 'bg-slate-800 text-gray-500 border border-white/5 cursor-not-allowed shadow-none'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Coins className="w-4 h-4 shrink-0" />
                    <span>Buy Potuzhno Crate</span>
                    <div className="w-[1px] h-4 bg-white/20" />
                    <span className="text-yellow-400">10k Coins</span>
                  </div>
                </button>
              </div>
            </div>

          </div>

          {/* RIGHT AREA: Prize Table and Probabilities list */}
          <div className="lg:col-span-4 space-y-6">
            
            <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-6">
              <div className="flex items-center gap-2.5 mb-6">
                <Info className="w-5 h-5 text-violet-400" />
                <h4 className="text-lg font-black uppercase tracking-wider text-white">Drop Rates & Contents</h4>
              </div>

              {/* 1. Character Drops */}
              <div className="space-y-4">
                <div className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span className="font-extrabold text-xs uppercase text-gray-400">CHARACTER DROPS</span>
                    </div>
                    <div className="font-bold text-sm text-white mt-1">Unlock Unowned Heroes</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 mt-1">
                      {lockedCount > 0 ? `${lockedCount} LOCKED CHARACTER(S) AVAILABLE` : 'ALL HEROES UNLOCKED'}
                    </div>
                  </div>
                  <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1.5 rounded-xl font-black italic text-sm">
                    15%
                  </div>
                </div>

                {/* 2. Skin Drops */}
                <div className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-fuchsia-400" />
                      <span className="font-extrabold text-xs uppercase text-gray-400">SKIN DROPS</span>
                    </div>
                    <div className="font-bold text-sm text-white mt-1">Unlock Legendary Skins</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 mt-1">
                      {lockedSkinsCount > 0 ? `${lockedSkinsCount} SKINS TOMORROW TO DISCOVER` : 'ALL SKINS OWNED'}
                    </div>
                  </div>
                  <div className="bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20 px-3 py-1.5 rounded-xl font-black italic text-sm">
                    15%
                  </div>
                </div>

                {/* 3. Upgrade Level Upgrade */}
                <div className="p-4 bg-slate-950 /40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="font-extrabold text-xs uppercase text-gray-400">HERO LEVEL UP</span>
                    </div>
                    <div className="font-bold text-sm text-white mt-1">Increases Max Stats (+1 Level)</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 mt-1">
                      Instantly upgrades level of an owned character
                    </div>
                  </div>
                  <div className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 px-3 py-1.5 rounded-xl font-black italic text-sm">
                    35%
                  </div>
                </div>

                {/* 4. Coins Return */}
                <div className="p-4 bg-slate-950/40 rounded-2xl border border-white/5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-400" />
                      <span className="font-extrabold text-xs uppercase text-gray-400">COINS RETURN</span>
                    </div>
                    <div className="font-bold text-sm text-white mt-1">Earn Coins Back</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 mt-1">
                      Chance to win back 300, 600, 1200, or 2500 coins!
                    </div>
                  </div>
                  <div className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-3 py-1.5 rounded-xl font-black italic text-sm">
                    35%
                  </div>
                </div>

                {/* 5. Prestige Tokens */}
                <div className="p-4 bg-gradient-to-r from-violet-950/40 to-amber-950/20 rounded-2xl border border-yellow-500/20 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-yellow-500" />
                      <span className="font-extrabold text-xs uppercase text-yellow-500">PRESTIGE TOKENS</span>
                    </div>
                    <div className="font-bold text-sm text-white mt-1">Prestige Upgradeable 👑</div>
                    <div className="text-[10px] uppercase font-mono text-gray-500 mt-1 space-y-0.5">
                      <div>Aura: <span className="text-yellow-400 font-bold">4.2%</span></div>
                      <div>Pearl: <span className="text-yellow-400 font-bold">8.3%</span></div>
                      <div>Mango: <span className="text-amber-400 font-bold">12.4%</span></div>
                      <div>Potuzhno: <span className="text-red-400 font-bold">18.7%</span></div>
                    </div>
                  </div>
                  <div className="bg-amber-500/10 text-yellow-500 border border-amber-500/20 px-3 py-1.5 rounded-xl font-black italic text-sm text-right leading-tight">
                    <div>Aura: 4.2%</div>
                    <div>Pearl: 8.3%</div>
                    <div>Mango: 12.4%</div>
                    <div>Potuzhno: 18.7%</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Collectiion Status Badge summary */}
            <div className="p-5 bg-slate-900 border border-violet-500/15 rounded-3xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-yellow-500 shrink-0" />
                <div>
                  <div className="text-xs uppercase font-extrabold text-gray-400">Unlocked Brawlers</div>
                  <div className="text-lg font-black text-white">{unlockedCount} / {totalHeroes}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Sparkles className="w-6 h-6 text-fuchsia-500 shrink-0" />
                <div>
                  <div className="text-xs uppercase font-extrabold text-gray-400">Epic Skins</div>
                  <div className="text-lg font-black text-white">{unlockedSkinsCount} / {totalSkins}</div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* DETAILED SUSPENSEFUL UNBOXING SHAKER & DISCOVERY MODAL */}
      <AnimatePresence>
        {openState !== 'idle' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] bg-[#030712]/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-white overflow-hidden"
          >
            {/* Visual background atmospheric effects */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-violet-600/15 rounded-full blur-[140px] pointer-events-none -z-10" />
            
            {/* 1) SHAKING / OPENING STATE CONTAINER */}
            {openState === 'opening' && (
              <div className="flex flex-col items-center justify-center text-center max-w-sm">
                
                {/* Shaker Element */}
                <motion.div
                  animate={{ 
                    x: [0, -10, 10, -10, 10, -5, 5, 0],
                    y: [0, -4, 4, -4, 4, -2, 2, 0],
                    scale: [1, 1.05, 0.98, 1.15, 1.25, 1]
                  }}
                  transition={{ 
                    duration: 1.8, 
                    ease: "easeInOut",
                    repeat: Infinity
                  }}
                  className="text-[12rem] filter drop-shadow-[0_0_80px_rgba(168,85,247,0.5)] select-none cursor-wait"
                >
                  {activeCrateType === 'pearl' ? '🐚' : '🔮'}
                </motion.div>

                <motion.h4
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-4xl font-black italic uppercase tracking-tighter text-yellow-400 mt-10 animate-pulse"
                >
                  opening...
                </motion.h4>
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mt-2 animate-pulse">
                  channeling the cosmos
                </p>
              </div>
            )}

            {/* 2) REVEALED Drop Reward display */}
            {openState === 'revealed' && revealedDrop && (
              <motion.div
                initial={{ scale: 0.85, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.85, opacity: 0 }}
                className="w-full max-w-md bg-slate-950/80 border-4 border-violet-500/40 rounded-[3rem] p-8 text-center shadow-[0_0_100px_rgba(139,92,246,0.25)] flex flex-col items-center balance-content relative overflow-hidden"
              >
                {/* Embedded stars behind the item card */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-violet-500 via-pink-400 to-yellow-300" />
                
                {/* Drop Glow Tag */}
                <span className={`text-[11px] font-black uppercase tracking-[0.2em] px-4 py-1.5 rounded-full border mb-8 ${
                  revealedDrop.type === 'hero' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                  revealedDrop.type === 'skin' ? 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20' :
                  revealedDrop.type === 'upgrade' ? 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' :
                  'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
                }`}>
                  {revealedDrop.type === 'hero' && '🆕 NEW CHARACTER'}
                  {revealedDrop.type === 'skin' && '✨ LEGENDARY SKIN'}
                  {revealedDrop.type === 'upgrade' && '💪 LEVEL UP!'}
                  {revealedDrop.type === 'coins' && '🪙 REFUND COINS'}
                </span>

                {/* Display Media Stage */}
                <div className="w-full h-56 flex items-center justify-center bg-slate-900/60 rounded-3xl border border-white/5 p-6 mb-8 relative">
                  
                  {/* Decorative Sparkles background */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-30 gap-6 select-none pointer-events-none text-2xl">
                    <span>⭐</span><span>✨</span><span>🌟</span>
                  </div>

                  {revealedDrop.image ? (
                    <motion.img 
                      initial={{ scale: 0.5, rotate: -15 }}
                      animate={{ scale: 1.15, rotate: 0 }}
                      src={revealedDrop.image} 
                      alt={revealedDrop.name}
                      referrerPolicy="no-referrer"
                      className="max-h-[90%] max-w-[90%] object-contain filter drop-shadow-[0_15px_30px_rgba(0,0,0,0.5)] z-10"
                    />
                  ) : (
                    <motion.div 
                      initial={{ scale: 0.3 }}
                      animate={{ scale: 1 }}
                      className="text-[7.5rem] selection-none z-10"
                    >
                      {revealedDrop.emoji || '🎁'}
                    </motion.div>
                  )}
                </div>

                {/* Item Details */}
                <div className="mb-8 max-w-sm">
                  {revealedDrop.type === 'upgrade' && revealedDrop.heroId && (
                     <div className="text-[10px] font-black uppercase text-cyan-400/80 tracking-widest leading-none mb-1">
                        Power Card Upgraded
                     </div>
                  )}
                  {revealedDrop.type === 'skin' && revealedDrop.heroId && (
                     <div className="text-[10px] font-black uppercase text-fuchsia-400/80 tracking-widest leading-none mb-1">
                        Legacy Skin Unlocked
                     </div>
                  )}

                  <h2 className={`text-3xl font-black italic uppercase leading-tight ${
                    revealedDrop.type === 'hero' ? 'text-emerald-400' :
                    revealedDrop.type === 'skin' ? 'text-fuchsia-400' :
                    revealedDrop.type === 'upgrade' ? 'text-cyan-400' :
                    'text-yellow-400'
                  }`}>
                    {revealedDrop.name}
                  </h2>

                  {/* Supplemental Subtext / Stats values */}
                  {revealedDrop.type === 'upgrade' && revealedDrop.levelFrom !== undefined && (
                    <div className="flex items-center justify-center gap-3 mt-3">
                      <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Level {revealedDrop.levelFrom}</span>
                      <ChevronRight className="w-4 h-4 text-slate-500" />
                      <span className="bg-cyan-500 text-slate-950 text-xs font-black px-2.5 py-0.5 rounded-full">Level {revealedDrop.levelTo}</span>
                    </div>
                  )}

                  {revealedDrop.type === 'coins' && revealedDrop.amount !== undefined && (
                    <div className="flex items-center justify-center gap-1.5 text-yellow-400 text-lg font-black italic mt-2">
                       <Check className="w-5 h-5" />
                       <span>+{revealedDrop.amount} COINS ADDED</span>
                    </div>
                  )}

                  {revealedDrop.type === 'hero' && (
                     <p className="text-gray-400 text-xs font-extrabold uppercase tracking-wide mt-3">
                        Added to your Brawlers Collection!
                     </p>
                  )}

                  {revealedDrop.type === 'skin' && (
                     <p className="text-gray-400 text-xs font-extrabold uppercase tracking-wide mt-3">
                        Equip this skin in the Collection Tab!
                     </p>
                  )}
                </div>

                {/* Claim Button */}
                <button
                  onClick={handleClaim}
                  className="w-full bg-white text-slate-950 font-black italic uppercase text-lg tracking-widest py-4.5 rounded-2xl shadow-lg border-2 border-white hover:bg-slate-200 transition-colors active:scale-98"
                >
                  CLAIM PRIZE
                </button>

              </motion.div>
            )}

          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
