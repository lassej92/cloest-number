import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode, category } = await req.json();
    
    if (!roomCode) {
      return NextResponse.json({ error: "Room code required" }, { status: 400 });
    }
    
    const room = await getRoom(roomCode);
    if (!room) {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    
    // Ensure backward compatibility - add usedQuestions if missing
    if (!room.usedQuestions) {
      room.usedQuestions = [];
    }
    
    // Clear all player answers
    const updatedPlayers = room.players.map((player: any) => ({
      ...player,
      currentAnswer: undefined,
      answeredAt: undefined
    }));
    
    // Generate a new question
    // Resolve base URL from request or environment
    const proto = (req.headers as any).get?.("x-forwarded-proto") || "http";
    const host = (req.headers as any).get?.("host");
    const envBase = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    const baseUrl = host ? `${proto}://${host}` : (envBase || 'http://localhost:3000');

    const questionRes = await fetch(`${baseUrl}/api/question`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        category: category || undefined,
        usedQuestions: room.usedQuestions || []
      }),
    });
    
    if (!questionRes.ok) {
      return NextResponse.json({ error: "Failed to generate question" }, { status: 500 });
    }
    
    const questionData = await questionRes.json();
    
    // Update room with new question and start game
    // Add a small delay to ensure timer is properly initialized
    const startTime = new Date();
    const updatedRoom = {
      ...room,
      players: updatedPlayers,
      currentQuestion: questionData,
      gameState: 'playing',
      questionStartTime: startTime.toISOString(),
      timer: 30, // 30 second timer
      usedQuestions: [...(room.usedQuestions || []), questionData] // Add to used questions
    };
    
    // Debug: Log timer initialization
    console.log("Next question with timer:", {
      questionStartTime: updatedRoom.questionStartTime,
      timer: updatedRoom.timer,
      gameState: updatedRoom.gameState
    });
    
    await updateRoom(roomCode, updatedRoom);
    
    return NextResponse.json({ 
      success: true, 
      room: updatedRoom 
    });
  } catch (err: any) {
    console.error("Next question error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
