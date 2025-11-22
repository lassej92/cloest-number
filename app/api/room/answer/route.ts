import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode, playerId, answer } = await req.json();
    
    const room = await getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    // Ensure backward compatibility - add usedQuestions if missing
    if (!room.usedQuestions) {
      room.usedQuestions = [];
    }
    
    const player = room.players.find(p => p.id === playerId);
    if (!player) {
      return NextResponse.json({ error: "Player not found" }, { status: 404 });
    }
    
    // Update player's answer
    player.currentAnswer = parseFloat(answer);
    player.answeredAt = new Date().toISOString();
    
    await updateRoom(roomCode, room);
    
    return NextResponse.json({ 
      success: true, 
      player,
      room 
    });
  } catch (err: any) {
    console.error("Submit answer error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
