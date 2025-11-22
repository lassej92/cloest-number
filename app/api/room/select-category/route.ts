import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode, playerId, category } = await req.json();
    
    const room = await getRoom(roomCode);
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
    
    // Check if this player is the category chooser
    if (room.categoryChooser !== playerId) {
      return NextResponse.json({ error: "Only the category chooser can select category" }, { status: 403 });
    }
    
    // Generate a new question with the selected category
    const proto = (req.headers as any).get?.("x-forwarded-proto") || "http";
    const hostHeader = (req.headers as any).get?.("host");
    const envBase = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    const baseUrl = hostHeader ? `${proto}://${hostHeader}` : (envBase || 'http://localhost:3000');

    const questionRes = await fetch(`${baseUrl}/api/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        category: category,
        usedQuestions: room.usedQuestions || []
      }),
    });
    
    if (!questionRes.ok) {
      return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
    }
    
    const questionData = await questionRes.json();
    
    // Clear all player answers and reset ready state
    const updatedPlayers = room.players.map((player: any) => ({
      ...player,
      currentAnswer: undefined,
      answeredAt: undefined
    }));
    
    // Update room with new question and start game
    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      currentQuestion: questionData,
      gameState: 'playing',
      questionStartTime: new Date().toISOString(),
      timer: 30, // 30 second timer
      usedQuestions: [...(room.usedQuestions || []), questionData], // Add to used questions
      playersReadyForNext: [], // Reset ready state
      categoryChooser: null // Reset category chooser
    };
    
    await updateRoom(roomCode, updatedRoom);
    
    return NextResponse.json({ 
      success: true, 
      room: updatedRoom 
    });
  } catch (err: any) {
    console.error("Select category error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
