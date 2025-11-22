import { NextResponse } from "next/server";
import { getRoom, updateRoom } from "@/lib/rooms";

export async function POST(req: Request) {
  try {
    const { roomCode } = await req.json();
    
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
    
    // Find the player who was furthest away (they get to choose next category)
    const playersWithAnswers = room.players.filter((p: any) => p.currentAnswer !== undefined);
    let categoryChooser = null;

    let playersWithStats = room.players.map((player: any) => ({
      ...player,
      closestCount: player.closestCount ?? 0,
      farthestCount: player.farthestCount ?? 0
    }));
    
    if (playersWithAnswers.length > 0 && room.currentQuestion) {
      const enrichedPlayers = playersWithAnswers.map((p: any) => ({
        ...p,
        distance: Math.abs(p.currentAnswer - room.currentQuestion.answer)
      }));
      
      const minDistance = Math.min(...enrichedPlayers.map((p: any) => p.distance));
      const maxDistance = Math.max(...enrichedPlayers.map((p: any) => p.distance));
      
      const closestPlayers = enrichedPlayers.filter((p: any) => p.distance === minDistance);
      const farthestPlayers = enrichedPlayers.filter((p: any) => p.distance === maxDistance);
      const hasDistinctFarthest = enrichedPlayers.length > 1 && maxDistance > minDistance;
      
      // Update player stats
      playersWithStats = room.players.map((player: any) => {
        const answered = player.currentAnswer !== undefined;
        let closestCount = player.closestCount ?? 0;
        let farthestCount = player.farthestCount ?? 0;
        
        if (answered) {
          const distance = Math.abs(player.currentAnswer - room.currentQuestion.answer);
          if (distance === minDistance) {
            closestCount += 1;
          }
          if (hasDistinctFarthest && distance === maxDistance) {
            farthestCount += 1;
          }
        }
        
        return {
          ...player,
          closestCount,
          farthestCount
        };
      });
      
      if (hasDistinctFarthest && farthestPlayers.length > 0) {
        categoryChooser = farthestPlayers[0].id;
      } else if (closestPlayers.length > 0) {
        // Fallback: if everyone tied, let the first closest player choose (consistent with previous behavior)
        categoryChooser = closestPlayers[0].id;
      }
      
      console.log("Category chooser selection:", {
        correctAnswer: room.currentQuestion.answer,
        players: enrichedPlayers.map((p: any) => ({ name: p.name, answer: p.currentAnswer, distance: p.distance })),
        chooser: playersWithStats.find((p: any) => p.id === categoryChooser)?.name || null,
        closestAwarded: closestPlayers.map((p: any) => p.name),
        farthestAwarded: hasDistinctFarthest ? farthestPlayers.map((p: any) => p.name) : []
      });
    }
    
    // Update room to revealed state
    const updatedRoom = {
      ...room,
      players: playersWithStats,
      gameState: 'revealed',
      categoryChooser,
      playersReadyForNext: [] // Reset ready state
    };
    
    await updateRoom(roomCode, updatedRoom);
    
    return NextResponse.json({ 
      success: true, 
      room: updatedRoom 
    });
  } catch (err: any) {
    console.error("Reveal room error:", err);
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 });
  }
}
