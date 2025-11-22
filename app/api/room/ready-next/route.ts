import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode, playerId } = await req.json();
    
    const room = getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    // Ensure backward compatibility
    if (!room.playersReadyForNext) {
      room.playersReadyForNext = [];
    }
    if (!room.categoryChooser) {
      room.categoryChooser = null;
    }
    
    const player = room.players.find((p: any) => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    
    // Add player to ready list if not already there
    if (!room.playersReadyForNext.includes(playerId)) {
      room.playersReadyForNext.push(playerId);
    }
    
    // Check if all players are ready
    const allPlayersReady = room.players.length === room.playersReadyForNext.length;
    
    updateRoom(roomCode, room);
    
    return NextResponse.json({ 
      success: true, 
      room,
      allPlayersReady,
      readyCount: room.playersReadyForNext.length,
      totalPlayers: room.players.length
    });
  } catch (err: any) {
    console.error("Ready for next error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
