// Shared room storage using Vercel KV (Redis) for production
// Falls back to in-memory storage for local development
import { kv } from '@vercel/kv';

const ROOM_PREFIX = 'room:';

// Fallback in-memory storage for local development
const globalForRooms = globalThis as unknown as {
  rooms: Map<string, any> | undefined;
};

const localRooms = globalForRooms.rooms ?? new Map();
globalForRooms.rooms = localRooms;

// Check if we're using KV (production) or local storage (development)
const useKV = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN;

export async function createRoom(roomCode: string, roomData: any) {
  if (useKV) {
    await kv.set(`${ROOM_PREFIX}${roomCode}`, roomData);
  } else {
    localRooms.set(roomCode, roomData);
  }
  return roomData;
}

export async function getRoom(roomCode: string) {
  if (useKV) {
    const room = await kv.get(`${ROOM_PREFIX}${roomCode}`);
    return room as any;
  } else {
    return localRooms.get(roomCode);
  }
}

export async function updateRoom(roomCode: string, roomData: any) {
  if (useKV) {
    await kv.set(`${ROOM_PREFIX}${roomCode}`, roomData);
  } else {
    localRooms.set(roomCode, roomData);
  }
  return roomData;
}

export async function deleteRoom(roomCode: string) {
  if (useKV) {
    await kv.del(`${ROOM_PREFIX}${roomCode}`);
    return true;
  } else {
    return localRooms.delete(roomCode);
  }
}

