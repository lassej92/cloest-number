// Shared room storage using Redis (Vercel KV) for production
// Falls back to in-memory storage for local development
import { createClient } from 'redis';

const ROOM_PREFIX = 'room:';

// Fallback in-memory storage for local development
const globalForRooms = globalThis as unknown as {
  rooms: Map<string, any> | undefined;
};

const localRooms = globalForRooms.rooms ?? new Map();
globalForRooms.rooms = localRooms;

// Check if we're using Redis (production) or local storage (development)
const useRedis = !!process.env.KV_REST_API_URL;

// Initialize Redis client lazily
let redisClient: ReturnType<typeof createClient> | null = null;

async function getRedisClient() {
  if (!useRedis) return null;
  
  if (!redisClient) {
    redisClient = createClient({
      url: process.env.KV_REST_API_URL
    });
    await redisClient.connect();
  }
  
  return redisClient;
}

export async function createRoom(roomCode: string, roomData: any) {
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(roomData));
    }
  } else {
    localRooms.set(roomCode, roomData);
  }
  return roomData;
}

export async function getRoom(roomCode: string) {
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      const data = await client.get(`${ROOM_PREFIX}${roomCode}`);
      return data ? JSON.parse(data) : null;
    }
  } else {
    return localRooms.get(roomCode);
  }
  return null;
}

export async function updateRoom(roomCode: string, roomData: any) {
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.set(`${ROOM_PREFIX}${roomCode}`, JSON.stringify(roomData));
    }
  } else {
    localRooms.set(roomCode, roomData);
  }
  return roomData;
}

export async function deleteRoom(roomCode: string) {
  if (useRedis) {
    const client = await getRedisClient();
    if (client) {
      await client.del(`${ROOM_PREFIX}${roomCode}`);
      return true;
    }
  } else {
    return localRooms.delete(roomCode);
  }
  return false;
}

