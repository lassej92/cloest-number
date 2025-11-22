import { NextResponse } from "next/server";
import { createRoom, getRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { hostName, roomName } = await req.json();
    
    const cleanedHost = typeof hostName === "string" ? hostName.trim() : "";
    if (!cleanedHost) {
      return NextResponse.json({ error: "Host name required" }, { status: 400 });
    }
    
    const cleanedRoomName = typeof roomName === "string" && roomName.trim()
      ? roomName.trim()
      : `${cleanedHost}'s Room`;
    
    // Generate unique room code
    const roomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    
    // Create room
    const room = {
      code: roomCode,
      host: cleanedHost,
      roomName: cleanedRoomName,
      players: [],
      currentQuestion: null,
      gameState: 'waiting', // waiting, playing, revealed
      usedQuestions: [], // Track used questions to prevent duplicates
      playersReadyForNext: [], // Track which players have pressed "Next Question"
      categoryChooser: null, // Player who gets to choose next category
      createdAt: new Date().toISOString()
    };
    
    createRoom(roomCode, room);
    
    // Resolve base URL from request or environment for join URL consistency
    const proto = (req.headers as any).get?.("x-forwarded-proto") || "http";
    const host = (req.headers as any).get?.("host");
    const envBase = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
    const baseUrl = host ? `${proto}://${host}` : (envBase || 'http://localhost:3000');

    return NextResponse.json({ 
      roomCode, 
      room,
      joinUrl: `${baseUrl}/join/${roomCode}`
    });
  } catch (err: any) {
    console.error("Create room error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const roomCode = searchParams.get('code');
  
  if (!roomCode) {
    return NextResponse.json({ error: "Room code required" }, { status: 400 });
  }
  
  const room = getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Room not found" }, { status: 404 });
  }
  
  return NextResponse.json({ room });
}
