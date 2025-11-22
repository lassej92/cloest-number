import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode, playerName } = await req.json();
    
    const room = await getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    // Ensure backward compatibility - add usedQuestions if missing
    if (!room.usedQuestions) {
      room.usedQuestions = [];
      await updateRoom(roomCode, room);
    }
    
    if (room.gameState === 'playing' || room.gameState === 'revealed') {
      return NextResponse.json({ error: "Game already in progress" }, { status: 400 });
    }
    
    // Check if player already exists
    const existingPlayer = room.players.find((p: any) => p.name === playerName);
    if (existingPlayer) {
      return NextResponse.json({ 
        success: true, 
        player: existingPlayer,
        room 
      });
    }
    
    // Add new player
    const player = {
      id: Math.random().toString(36).substring(2, 15),
      name: playerName,
      joinedAt: new Date().toISOString(),
      currentAnswer: undefined,
      score: 0,
      closestCount: 0,
      farthestCount: 0
    };
    
    room.players.push(player);
    await updateRoom(roomCode, room);
    
    return NextResponse.json({ 
      success: true, 
      player,
      room 
    });
  } catch (err: any) {
    console.error("Join room error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
