{
  "entities": {
    "Room": {
      "title": "Room",
      "description": "A game room",
      "type": "object",
      "properties": {
        "status": { "type": "string", "enum": ["lobby", "starting", "playing", "finished"] },
        "mode": { "type": "string" },
        "hostId": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" },
        "scores": { "type": "object" },
        "timeLeft": { "type": "number" },
        "code": { "type": "string" }
      },
      "required": ["status", "mode", "hostId", "scores", "code"]
    },
    "Player": {
      "title": "Player",
      "description": "A player in a room",
      "type": "object",
      "properties": {
        "userId": { "type": "string" },
        "name": { "type": "string" },
        "heroId": { "type": "string" },
        "x": { "type": "number" },
        "y": { "type": "number" },
        "rotation": { "type": "number" },
        "health": { "type": "number" },
        "maxHealth": { "type": "number" },
        "ammo": { "type": "number" },
        "coins": { "type": "number" },
        "team": { "type": "string", "enum": ["blue", "red"] },
        "lastUpdated": { "type": "number" },
        "lastShot": {
          "type": "object",
          "properties": {
            "id": { "type": "string" },
            "x": { "type": "number" },
            "y": { "type": "number" },
            "vx": { "type": "number" },
            "vy": { "type": "number" },
            "damage": { "type": "number" },
            "time": { "type": "number" }
          }
        }
      }
    },
    "PartyMember": {
      "title": "PartyMember",
      "description": "A member inside a party lobby",
      "type": "object",
      "properties": {
        "userId": { "type": "string" },
        "name": { "type": "string" },
        "heroId": { "type": "string" },
        "skinImage": { "type": "string" },
        "heroLevel": { "type": "number" },
        "prestigeLevel": { "type": "number" }
      },
      "required": ["userId", "name", "heroId", "heroLevel", "prestigeLevel"]
    },
    "Party": {
      "title": "Party",
      "description": "A party matchmaking/co-op lobby",
      "type": "object",
      "properties": {
        "code": { "type": "string" },
        "hostId": { "type": "string" },
        "members": { "type": "array" },
        "gameMode": { "type": "string" },
        "status": { "type": "string", "enum": ["lobby", "match_starting", "playing"] },
        "matchRoomId": { "type": "string" },
        "createdAt": { "type": "string", "format": "date-time" }
      },
      "required": ["code", "hostId", "members", "gameMode", "status"]
    },
    "AdminBroadcast": {
      "title": "AdminBroadcast",
      "description": "A real-time broadcast message typed using the developer console of the game",
      "type": "object",
      "properties": {
        "message": { "type": "string" },
        "activeUntil": { "type": "number" },
        "color": { "type": "string" },
        "sender": { "type": "string" }
      },
      "required": ["message", "activeUntil"]
    }
  },
  "firestore": {
    "rooms/{roomId}": {
      "schema": "Room",
      "description": "Collection of game rooms"
    },
    "rooms/{roomId}/players/{userId}": {
      "schema": "Player",
      "description": "Players in a specific room"
    },
    "parties/{partyId}": {
      "schema": "Party",
      "description": "Lobbies for party matchmaking and co-op teams"
    },
    "admin_broadcast/{id}": {
      "schema": "AdminBroadcast",
      "description": "Collection of global developer broadcast alerts and announcements"
    }
  }
}
