// Shared room storage (in-memory for demo, use database in production)
// Use globalThis to persist across hot reloads in development
const globalForRooms = globalThis as unknown as {
  rooms: Map<string, any> | undefined;
};

export const rooms = globalForRooms.rooms ?? new Map();
globalForRooms.rooms = rooms;

export function createRoom(roomCode: string, roomData: any) {
  rooms.set(roomCode, roomData);
  return roomData;
}

export function getRoom(roomCode: string) {
  return rooms.get(roomCode);
}

export function updateRoom(roomCode: string, roomData: any) {
  rooms.set(roomCode, roomData);
  return roomData;
}

export function deleteRoom(roomCode: string) {
  return rooms.delete(roomCode);
}

