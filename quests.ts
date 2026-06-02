import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  onSnapshot, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  serverTimestamp,
  deleteDoc,
  runTransaction,
  limit,
  orderBy,
  getDoc,
  increment
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from './firebase';
import { GameMode, HeroId } from '../types';

export interface RemotePlayer {
  userId: string;
  name: string;
  heroId: HeroId;
  x: number;
  y: number;
  rotation: number;
  health: number;
  maxHealth: number;
  ammo: number;
  coins: number;
  team: 'blue' | 'red' | 'green' | 'yellow';
  lastUpdated: number;
  lastShot?: {
    id: string;
    x: number;
    y: number;
    vx: number;
    vy: number;
    damage: number;
    time: number;
  };
}

export interface RoomData {
  id: string;
  status: 'lobby' | 'starting' | 'playing' | 'finished';
  mode: GameMode;
  hostId: string;
  playerCount: number;
  createdAt: any;
  scores: { blue: number; red: number };
  timeLeft?: number;
  code: string;
}

export const createCustomRoom = async (mode: GameMode, userId: string, name: string, heroId: HeroId) => {
  const roomsRef = collection(db, 'rooms');
  const code = Array.from({ length: 5 }, () => 
    'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36))
  ).join('');

  console.log(`createCustomRoom: Creating custom ${mode} room with code ${code}...`);
  let roomId = '';

  try {
    const docRef = await addDoc(roomsRef, {
      status: 'lobby',
      mode,
      hostId: userId,
      playerCount: 1,
      code,
      createdAt: serverTimestamp(),
      scores: { blue: 0, red: 0 },
      timeLeft: 120,
    });
    roomId = docRef.id;
    console.log(`createCustomRoom: Created room ${roomId} with code ${code}`);
  } catch (error) {
    console.error("createCustomRoom: addDoc failed", error);
    handleFirestoreError(error, OperationType.CREATE, 'rooms');
  }

  // Add guest/host to the players list
  const playerPath = `rooms/${roomId}/players/${userId}`;
  const playerRef = doc(db, playerPath);
  try {
    await setDoc(playerRef, {
      userId,
      name,
      heroId,
      x: 0, 
      y: 0,
      rotation: 0,
      health: 100, 
      maxHealth: 100,
      ammo: 3,
      coins: 0,
      team: 'blue',
      lastUpdated: Date.now()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, playerPath);
  }

  return { roomId, code };
};

export const joinCustomRoom = async (code: string, userId: string, name: string, heroId: HeroId, teamOverride: 'blue' | 'red' | 'green' | 'yellow' = 'red') => {
  const roomsRef = collection(db, 'rooms');
  const upperCode = code.trim().toUpperCase();
  console.log(`joinCustomRoom: Searching for lobby with code ${upperCode}...`);

  const q = query(
    roomsRef,
    where('status', '==', 'lobby'),
    where('code', '==', upperCode),
    limit(1)
  );

  const querySnapshot = await getDocs(q);
  if (querySnapshot.empty) {
    throw new Error("Room not found or game already started.");
  }

  const roomDoc = querySnapshot.docs[0];
  const roomId = roomDoc.id;
  const roomData = roomDoc.data();

  if ((roomData.playerCount || 0) >= 2) {
    throw new Error("Room is full.");
  }

  // Check if player is already in this room to be idempotent/resilient
  const playerPath = `rooms/${roomId}/players/${userId}`;
  const playerRef = doc(db, playerPath);
  const playerDoc = await getDoc(playerRef);

  if (!playerDoc.exists()) {
    // Try updating the player count
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        playerCount: increment(1)
      });
    } catch (error) {
      console.error("joinCustomRoom update playerCount failed", error);
      throw new Error("Could not join custom room.");
    }

    // Add the player using random or predetermined team
    try {
      await setDoc(playerRef, {
        userId,
        name,
        heroId,
        x: 0, 
        y: 0,
        rotation: 0,
        health: 100, 
        maxHealth: 100,
        ammo: 3,
        coins: 0,
        team: teamOverride, // Custom or opposing team
        lastUpdated: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, playerPath);
    }
  }

  return roomId;
};

export const joinRoomById = async (
  roomId: string, 
  userId: string, 
  name: string, 
  heroId: HeroId, 
  teamOverride: 'blue' | 'red' | 'green' | 'yellow' = 'red'
) => {
  const roomRef = doc(db, 'rooms', roomId);
  const roomDoc = await getDoc(roomRef);
  if (!roomDoc.exists()) {
    throw new Error("Room not found.");
  }
  const roomData = roomDoc.data() as RoomData;
  if (roomData.status !== 'lobby') {
    throw new Error("Game already started.");
  }
  if ((roomData.playerCount || 0) >= 2) {
    throw new Error("Room is full.");
  }

  const playerPath = `rooms/${roomId}/players/${userId}`;
  const playerRef = doc(db, playerPath);
  const playerDoc = await getDoc(playerRef);

  if (!playerDoc.exists()) {
    try {
      await updateDoc(roomRef, {
        playerCount: increment(1)
      });
    } catch (error) {
      console.error("joinRoomById update playerCount failed", error);
      throw new Error("Could not join room.");
    }

    try {
      await setDoc(playerRef, {
        userId,
        name,
        heroId,
        x: 0, 
        y: 0,
        rotation: 0,
        health: 100, 
        maxHealth: 100,
        ammo: 3,
        coins: 0,
        team: teamOverride,
        lastUpdated: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, playerPath);
    }
  }

  return roomId;
};

const cleanObject = (obj: any) => {
  const cleaned: any = {};
  for (const key in obj) {
    if (obj[key] !== undefined) {
      cleaned[key] = obj[key];
    }
  }
  return cleaned;
};

export const updatePlayerState = async (roomId: string, userId: string, state: Partial<RemotePlayer>) => {
  const path = `rooms/${roomId}/players/${userId}`;
  const playerRef = doc(db, path);
  try {
    const cleanedState = cleanObject({
      ...state,
      lastUpdated: Date.now()
    });
    await updateDoc(playerRef, cleanedState);
  } catch (error) {
    // Throttling errors or minor failures in update are common in real-time
    // But we still handle it for debugging permissions
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const updateRoomState = async (roomId: string, state: Partial<RoomData>) => {
  const path = `rooms/${roomId}`;
  const roomRef = doc(db, path);
  try {
    const cleanedState = cleanObject(state);
    await updateDoc(roomRef, cleanedState);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
};

export const leaveRoom = async (roomId: string, userId: string) => {
  const path = `rooms/${roomId}/players/${userId}`;
  const playerRef = doc(db, path);
  try {
    await deleteDoc(playerRef);
    // Decrement player count on the room level
    const roomRef = doc(db, 'rooms', roomId);
    await updateDoc(roomRef, {
      playerCount: increment(-1)
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToRoom = (roomId: string, callback: (data: RoomData) => void) => {
  const path = `rooms/${roomId}`;
  return onSnapshot(doc(db, path), (doc) => {
    if (doc.exists()) {
      callback({ id: doc.id, ...doc.data() } as RoomData);
    }
  }, (error) => {
    handleFirestoreError(error, OperationType.GET, path);
  });
};

export const subscribeToPlayers = (roomId: string, callback: (players: RemotePlayer[]) => void) => {
  const path = `rooms/${roomId}/players`;
  return onSnapshot(collection(db, path), (snapshot) => {
    const players: RemotePlayer[] = [];
    snapshot.forEach((doc) => {
      players.push(doc.data() as RemotePlayer);
    });
    callback(players);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, path);
  });
};
