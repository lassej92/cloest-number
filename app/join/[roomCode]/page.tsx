"use client";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";

type Q = { question: string; answer: number; unit?: string; category: string; source?: string };

type Room = {
  code: string;
  host: string;
  roomName?: string;
  players: Array<{ id: string; name: string; currentAnswer?: number; closestCount?: number; farthestCount?: number }>;
  currentQuestion?: Q;
  gameState: 'waiting' | 'playing' | 'revealed';
  createdAt: string;
  questionStartTime?: string;
  timer?: number;
  playersReadyForNext?: string[];
  categoryChooser?: string;
};

type Player = {
  id: string;
  name: string;
  currentAnswer?: number;
  closestCount?: number;
  farthestCount?: number;
};

export default function JoinRoom() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  
  const [playerName, setPlayerName] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [player, setPlayer] = useState<Player | null>(null);
  const [room, setRoom] = useState<Room | null>(null);
  const [answer, setAnswer] = useState("");
  const [hasAnswered, setHasAnswered] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const scoreboard = useMemo(() => {
    if (!room?.players?.length) return null;
    const stats = room.players.map((p) => ({
      id: p.id,
      name: p.name,
      closest: p.closestCount ?? 0,
      farthest: p.farthestCount ?? 0
    }));
    return {
      closest: [...stats].sort((a, b) => b.closest - a.closest),
      farthest: [...stats].sort((a, b) => b.farthest - a.farthest),
      hasRounds: stats.some((s) => s.closest > 0 || s.farthest > 0)
    };
  }, [room?.players]);

  const joinRoom = async () => {
    if (!playerName.trim()) return;
    
    try {
      const res = await fetch("/api/room/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomCode, playerName: playerName.trim() })
      });
      
      const data = await res.json();
      if (data.success) {
        setPlayer(data.player);
        setRoom(data.room);
        setIsJoined(true);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to join room");
    }
  };

  const submitAnswer = async () => {
    if (!answer.trim() || !player) return;
    
    try {
      const res = await fetch("/api/room/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          roomCode, 
          playerId: player.id, 
          answer: answer.trim() 
        })
      });
      
      const data = await res.json();
      if (data.success) {
        setHasAnswered(true);
        setRoom(data.room);
      } else {
        alert(data.error);
      }
    } catch (err) {
      alert("Failed to submit answer");
    }
  };


  // Poll for room updates
  useEffect(() => {
    if (!isJoined) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/create?code=${roomCode}`);
        const data = await res.json();
        if (data.room) {
          const previousGameState = room?.gameState;
          setRoom(data.room);
          
          // Reset hasAnswered when a new question starts
          if (data.room.gameState === 'playing' && previousGameState !== 'playing') {
            setHasAnswered(false);
            setAnswer("");
          }
          
          // Also reset if the question has changed (for existing players)
          if (data.room.gameState === 'playing' && data.room.currentQuestion && 
              room?.currentQuestion && data.room.currentQuestion.question !== room.currentQuestion.question) {
            setHasAnswered(false);
            setAnswer("");
          }
          
          // Reset answer state when transitioning from revealed to playing
          if (data.room.gameState === 'playing' && previousGameState === 'revealed') {
            setHasAnswered(false);
            setAnswer("");
          }
          
          // Update timer if game is playing
          if (data.room.gameState === 'playing' && data.room.questionStartTime && data.room.timer) {
            const startTime = new Date(data.room.questionStartTime).getTime();
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            const remaining = Math.max(0, data.room.timer - elapsed);
            setTimeRemaining(remaining);
            
            // Ensure timer is properly initialized - if elapsed is negative, something is wrong
            if (elapsed < 0) {
              console.warn("Timer issue: elapsed time is negative", { elapsed, startTime, now: Date.now() });
            }
            
            // If elapsed time is 0 or negative, don't proceed with auto-reveal logic
            if (elapsed <= 0) {
              return;
            }
            
            // Additional safeguard: Don't auto-reveal if the game just started (within 1 second)
            if (elapsed < 1) {
              return;
            }
            
            // Debug: Log timer updates
            console.log("Timer update:", { 
              remaining, 
              elapsed, 
              startTime: data.room.questionStartTime,
              roomTimer: data.room.timer,
              gameState: data.room.gameState,
              allPlayersAnswered: data.room.players.every((p: any) => p.currentAnswer !== undefined)
            });
            
            // Check if all players have answered
            const allPlayersAnswered = data.room.players.every((p: any) => p.currentAnswer !== undefined);
            
            // Auto-reveal when timer expires OR all players have answered
            // Only auto-reveal if timer has actually started and expired, or all players answered
            if ((remaining === 0 && elapsed > 0) || allPlayersAnswered) {
              console.log("Auto-reveal triggered:", {
                remaining,
                elapsed,
                allPlayersAnswered,
                gameState: data.room.gameState,
                players: data.room.players.map((p: any) => ({ name: p.name, answer: p.currentAnswer }))
              });
              
              if (data.room.gameState === 'playing') {
                try {
                  await fetch("/api/room/reveal", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ roomCode })
                  });
                } catch (err) {
                  console.error("Failed to auto-reveal");
                }
              }
            }
          }
        }
      } catch (err) {
        console.error("Failed to fetch room updates");
      }
    }, 1000); // Poll every second for timer updates
    
    return () => clearInterval(interval);
  }, [isJoined, roomCode, room?.gameState]);

  if (!isJoined) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-6 flex items-center justify-center">
        <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-8 border-2 border-pink-400/30 max-w-md w-full shadow-2xl">
          <div className="text-center mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Join Game</h1>
            <p className="text-purple-200">Room Code: <span className="font-mono text-2xl font-bold text-white">{roomCode}</span></p>
          </div>
          
          <div className="space-y-4">
            <input
              className="w-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-pink-400/50 rounded-lg px-4 py-3 text-white placeholder-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-pink-300"
              placeholder="Enter your name"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && joinRoom()}
            />
            <button
              className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-300 transform hover:scale-105 shadow-lg"
              onClick={joinRoom}
            >
              Join Room
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            {room?.roomName || `Room ${roomCode}`}
          </h1>
          <div className="text-purple-200 text-sm mb-2 font-mono tracking-wider">Code: {roomCode}</div>
          {room?.host && (
            <div className="text-pink-200 text-sm mb-2">Hosted by {room.host}</div>
          )}
          <p className="text-pink-200 text-lg">Welcome, {player?.name}! 🎮</p>
        </div>

        {room?.currentQuestion ? (
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-6 border-2 border-pink-400/30 shadow-2xl">
            <div className="text-center mb-6">
              <div className="text-2xl font-bold text-white mb-2 bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent">
                {room.currentQuestion.question}
              </div>
              <div className="text-pink-300 text-sm mb-4 bg-blue-500/20 rounded-full px-4 py-2 inline-block">
                Category: {room.currentQuestion.category}
              </div>
              
              {/* Timer Display */}
              {room.gameState === 'playing' && room.timer && (
                <div className="flex justify-center mb-4">
                  <div className={`text-xl font-bold px-8 py-4 rounded-full border-2 shadow-lg ${
                    timeRemaining <= 5 
                      ? "bg-gradient-to-r from-red-500 to-pink-500 border-red-400 text-white animate-pulse" 
                      : timeRemaining <= 10
                        ? "bg-gradient-to-r from-orange-500 to-yellow-500 border-orange-400 text-white"
                        : "bg-gradient-to-r from-blue-500 to-purple-500 border-blue-400 text-white"
                  }`}>
                    ⏰ {timeRemaining}s remaining
                  </div>
                </div>
              )}
              
            </div>

            {room.gameState === 'playing' && !hasAnswered ? (
              <div className="space-y-4">
                <input
                  type="number"
                  className="w-full bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-pink-400/50 rounded-lg px-4 py-4 text-white placeholder-pink-200 focus:outline-none focus:ring-2 focus:ring-pink-400 text-center text-xl font-bold"
                  placeholder="Your answer..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                />
                <button
                  className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700 text-white px-6 py-4 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                  onClick={submitAnswer}
                >
                  🚀 Submit Answer
                </button>
              </div>
            ) : room.gameState === 'playing' && hasAnswered ? (
              <div className="text-center">
                <div className="text-green-400 text-xl font-bold mb-2 bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-full px-6 py-3">
                  ✅ Answer submitted!
                </div>
                <div className="text-pink-200 text-lg mb-4">
                  🎯 Waiting for other players... ({room.players.filter(p => p.currentAnswer !== undefined).length}/{room.players.length} answered)
                </div>
                {/* Manual reveal button for host */}
                {player && room.host === player.name && (
                  <button
                    className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white px-6 py-3 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                    onClick={async () => {
                      try {
                        await fetch("/api/room/reveal", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ roomCode })
                        });
                      } catch (err) {
                        console.error("Failed to reveal");
                      }
                    }}
                  >
                    🔍 Reveal Results Now
                  </button>
                )}
              </div>
            ) : room.gameState === 'revealed' ? (
              <div className="space-y-4">
                <div className="bg-gradient-to-r from-green-500/20 to-blue-500/20 rounded-lg p-6 border-2 border-green-400/30 shadow-lg">
                  <div className="text-center">
                    <div className="text-pink-200 text-lg mb-2">🎯 Correct Answer:</div>
                    <div className="text-3xl font-bold bg-gradient-to-r from-green-400 to-blue-400 bg-clip-text text-transparent">
                      {room.currentQuestion?.answer} {room.currentQuestion?.unit || ""}
                    </div>
                    {room.currentQuestion?.source && (
                      <div className="text-pink-200 text-sm mt-3">
                        Source: <a href={room.currentQuestion.source} target="_blank" rel="noreferrer" className="underline hover:text-pink-100">{room.currentQuestion.source}</a>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="text-center mb-6">
                    <div className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-pink-400 bg-clip-text text-transparent mb-2">🏆 Leaderboard</div>
                    
                    {/* Show different UI based on who gets to choose category */}
                    {room.categoryChooser && player && room.categoryChooser === player.id ? (
                      <div className="mt-4">
                        <div className="text-green-400 text-lg font-bold mb-4">
                          🎯 You were furthest away! Choose the next category:
                        </div>
                        <div className="grid grid-cols-2 gap-2 max-w-md mx-auto">
                          {['celebrity_age', 'country_population', 'avg_temperature', 'building_height', 'distance_length', 'time_dates', 'sports_numbers', 'space_numbers'].map(category => (
                            <button
                              key={category}
                              className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-all duration-300 transform hover:scale-105 shadow-lg"
                              onClick={async () => {
                                try {
                                  await fetch("/api/room/select-category", {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ roomCode, playerId: player.id, category })
                                  });
                                } catch (err) {
                                  console.error("Failed to select category");
                                }
                              }}
                            >
                              {category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : room.categoryChooser ? (
                      <div className="text-pink-200 text-lg mt-4">
                        🎯 {room.players.find((p: any) => p.id === room.categoryChooser)?.name} is choosing the next category...
                      </div>
                    ) : (
                      <div className="mt-4">
                        <div className="text-pink-200 text-lg mb-4">
                          🎯 Waiting for all players to press "Next Question" ({room.playersReadyForNext?.length || 0}/{room.players.length})
                        </div>
                        <button
                          className="bg-gradient-to-r from-purple-500 to-pink-600 hover:from-purple-600 hover:to-pink-700 text-white px-8 py-3 rounded-lg font-bold text-lg transition-all duration-300 transform hover:scale-105 shadow-lg"
                          onClick={async () => {
                            if (!player) return;
                            try {
                              await fetch("/api/room/ready-next", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ roomCode, playerId: player.id })
                              });
                            } catch (err) {
                              console.error("Failed to ready for next");
                            }
                          }}
                        >
                          🚀 Ready for Next Question
                        </button>
                      </div>
                    )}
                  </div>
                  {room.players
                    .map(p => ({
                      ...p,
                    distance: p.currentAnswer !== undefined ? Math.abs(p.currentAnswer - (room.currentQuestion?.answer || 0)) : Infinity
                    }))
                    .sort((a, b) => a.distance - b.distance)
                    .map((p, i) => {
                      const isClosest = i === 0 && p.distance !== Infinity;
                      const isFarthest = i === room.players.length - 1 && p.distance !== Infinity;
                      const hasAnswer = p.currentAnswer !== undefined;
                      
                      return (
                        <div key={p.id} className={`flex justify-between items-center p-6 rounded-xl border-2 shadow-lg ${
                          isClosest 
                            ? "bg-gradient-to-r from-green-500/30 to-yellow-500/30 border-green-400 animate-pulse" 
                            : isFarthest && hasAnswer
                              ? "bg-gradient-to-r from-red-500/30 to-pink-500/30 border-red-400"
                              : "bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-pink-400/30"
                        }`}>
                          <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg shadow-lg ${
                              isClosest 
                                ? "bg-gradient-to-r from-green-500 to-yellow-500 text-white" 
                                : isFarthest && hasAnswer
                                  ? "bg-gradient-to-r from-red-500 to-pink-500 text-white"
                                  : "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                            }`}>
                              {i + 1}
                            </div>
                            <div>
                              <div className="text-white font-bold text-lg">{p.name}</div>
                              {isClosest && <div className="text-yellow-400 text-sm font-bold">🏆 Closest!</div>}
                              {isFarthest && hasAnswer && <div className="text-red-400 text-sm font-bold">📏 Farthest</div>}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-white font-bold text-lg">
                              {p.currentAnswer !== undefined ? `${p.currentAnswer}` : "No answer"}
                            </div>
                          {p.currentAnswer !== undefined && (
                              <div className="text-pink-300 text-sm font-medium">
                                Δ = {p.distance.toFixed(1)}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                
                {scoreboard && (
                  <div className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 backdrop-blur-sm rounded-2xl p-6 border-2 border-pink-400/30 shadow-xl">
                    <div className="text-center text-white font-bold text-xl mb-4">
                      📊 Overall Scoreboard
                    </div>
                    {scoreboard.hasRounds ? (
                      <div className="grid md:grid-cols-2 gap-4">
                        <div>
                          <div className="text-purple-200 text-sm font-semibold mb-2 text-center">Closest Wins</div>
                          <div className="space-y-2">
                            {scoreboard.closest.map((p, idx) => (
                              <div key={p.id} className="flex justify-between items-center bg-gradient-to-r from-purple-500/20 to-blue-500/20 border border-pink-400/30 rounded-xl px-3 py-2 shadow">
                                <div className="flex items-center gap-3">
                                  <span className="text-purple-200 font-bold text-lg w-6 text-center">{idx + 1}</span>
                                  <span className="text-white font-semibold">{p.name}</span>
                                </div>
                                <div className="text-purple-100 text-sm font-semibold">
                                  {p.closest} {p.closest === 1 ? "time" : "times"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                        <div>
                          <div className="text-pink-200 text-sm font-semibold mb-2 text-center">Farthest Off</div>
                          <div className="space-y-2">
                            {scoreboard.farthest.map((p, idx) => (
                              <div key={p.id} className="flex justify-between items-center bg-gradient-to-r from-pink-500/20 to-orange-500/20 border border-pink-400/30 rounded-xl px-3 py-2 shadow">
                                <div className="flex items-center gap-3">
                                  <span className="text-pink-200 font-bold text-lg w-6 text-center">{idx + 1}</span>
                                  <span className="text-white font-semibold">{p.name}</span>
                                </div>
                                <div className="text-pink-100 text-sm font-semibold">
                                  {p.farthest} {p.farthest === 1 ? "time" : "times"}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-pink-200 text-sm text-center">
                        No rounds played yet—stick around for the stats!
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 backdrop-blur-sm rounded-2xl p-8 border-2 border-pink-400/30 text-center shadow-2xl">
            <div className="text-pink-200 text-xl font-bold">
              🎮 Waiting for the host to start the game...
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
