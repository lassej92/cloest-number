"use client";
import { useEffect, useMemo, useState } from "react";

type Q = { question: string; answer: number; unit?: string; category: string; source?: string };

type RoomPlayer = {
  id: string;
  name: string;
  currentAnswer?: number;
  closestCount?: number;
  farthestCount?: number;
};

type Room = {
  code: string;
  host: string;
  roomName?: string;
  players: Array<RoomPlayer>;
  currentQuestion?: Q;
  gameState: 'waiting' | 'playing' | 'revealed';
  createdAt: string;
  questionStartTime?: string;
  timer?: number;
};

const CATEGORIES = [
  { id: "celebrity_age", label: "Celebrity age" },
  { id: "country_population", label: "Country population" },
  { id: "avg_temperature", label: "Average temperature (°C)" },
  { id: "building_height", label: "Building/monument height" },
  { id: "distance_length", label: "Distances & lengths" },
  { id: "time_dates", label: "Time & dates" },
  { id: "sports_numbers", label: "Sports numbers" },
  { id: "space_numbers", label: "Space facts" },
];

export default function Home() {
  const [gameMode, setGameMode] = useState<'local' | 'room'>('room');
  const [roomCode, setRoomCode] = useState("");
  const [hostName, setHostName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [room, setRoom] = useState<Room | null>(null);
  
  // Local game state
  const [players, setPlayers] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState<Q | null>(null);
  const [guesses, setGuesses] = useState<Record<string, string>>({});
  const [revealed, setRevealed] = useState(false);
  const [seconds, setSeconds] = useState(25);
  const [tick, setTick] = useState(seconds);

  function addPlayer() {
    const n = name.trim();
    if (!n) return;
    setPlayers((p) => [...p, n]);
    setName("");
  }

  async function createRoom() {
    if (!hostName.trim()) return;
    
    try {
      const res = await fetch("/api/room/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          hostName: hostName.trim(),
          roomName: roomName.trim() || undefined
        }),
      });
      
      const data = await res.json();
      setRoomCode(data.roomCode);
      setRoom(data.room);
      setGameMode('room');
    } catch (err) {
      alert("Failed to create room");
    }
  }

  async function newQuestion() {
    if (gameMode === 'local') {
      setRevealed(false);
      setGuesses({});
      setTick(seconds);
      const res = await fetch("/api/question", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: cat || undefined }),
      });
      const data = await res.json();
      setQ(data);
    } else {
      // Room mode - start new question
      try {
        const res = await fetch("/api/room/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomCode, category: cat || undefined }),
        });
        const data = await res.json();
        if (data.success) {
          setRoom(data.room);
        } else {
          alert(data.error);
        }
      } catch (err) {
        alert("Failed to start room game");
      }
    }
  }

  useEffect(() => {
    if (!q || revealed) return;
    const id = setInterval(() => setTick((t) => (t <= 1 ? 0 : t - 1)), 1000);
    return () => clearInterval(id);
  }, [q, revealed]);

  useEffect(() => {
    if (tick === 0 && !revealed) setRevealed(true);
  }, [tick, revealed]);

  // Poll for room updates in room mode
  useEffect(() => {
    if (gameMode !== 'room' || !roomCode) return;
    
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/room/create?code=${roomCode}`);
        const data = await res.json();
        if (data.room) {
          setRoom(data.room);
        }
      } catch (err) {
        console.error("Failed to fetch room updates");
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [gameMode, roomCode]);

  const results = useMemo(() => {
    if (!q) return [];
    const rows = players.map((p) => {
      const v = guesses[p] ? Number(guesses[p]) : NaN;
      const dist = Number.isFinite(v) ? Math.abs(v - q.answer) : Infinity;
      return { player: p, guess: guesses[p] ?? "", dist };
    });
    return rows.sort((a, b) => a.dist - b.dist);
  }, [guesses, players, q]);

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

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Closest Number</h1>
          <p className="text-purple-200 text-lg">***Live AI Trivia Game***</p>
        </div>

        {/* Create Room (Online only) */}
        {!roomCode && (
          <section className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Create Online Room</h2>
            <p className="text-white/70 text-sm mb-4">Players will join from their own phones</p>
            <div className="space-y-3 max-w-md mx-auto">
              <input
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/70 text-sm"
                placeholder="Your name as host"
                value={hostName}
                onChange={(e) => setHostName(e.target.value)}
              />
              <input
                className="w-full bg-white/20 border border-white/30 rounded-lg px-3 py-2 text-white placeholder-white/70 text-sm"
                placeholder="Room name (optional)"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <button
                className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
                onClick={createRoom}
                disabled={!hostName.trim()}
              >
                Create Room
              </button>
            </div>
          </section>
        )}

        {/* Room Code Display */}
        {roomCode && (
          <section className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-white mb-2">Room Created!</h2>
              <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
                {room?.roomName && (
                  <div className="text-white/80 text-lg font-semibold mb-2">{room.roomName}</div>
                )}
                <div className="text-3xl font-bold text-white font-mono mb-2">{roomCode}</div>
                <div className="text-purple-300 text-sm">
                  Share this code with players to join
                </div>
              </div>
              <div className="text-center">
                <div className="text-white/70 text-sm mb-2">Players join at:</div>
                <div className="text-purple-300 font-mono text-sm">
                  {typeof window !== 'undefined' ? window.location.origin : ''}/join/{roomCode}
                </div>
                <div className="text-white/70 text-sm mt-2">
                  Host: {room?.host}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Local mode is removed for online-only play */}

        {/* Room Mode Display */}
        {gameMode === 'room' && roomCode && (
          <section className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 mb-6 border border-white/20">
            <h2 className="text-xl font-semibold text-white mb-4">Room Management</h2>
            
            {/* Room Status */}
            <div className="bg-white/5 rounded-lg p-4 border border-white/10 mb-4">
              <div className="text-center">
                <div className="text-white/70 mb-2">Room Status</div>
                <div className="text-lg font-medium text-white">
                  {room?.gameState === 'waiting' ? 'Waiting for players' : 
                   room?.gameState === 'playing' ? 'Game in progress' : 
                   room?.gameState === 'revealed' ? 'Results shown' : 'Unknown'}
                </div>
                {room?.players && (
                  <div className="text-purple-300 text-sm mt-2">
                    {room.players.length} player{room.players.length !== 1 ? 's' : ''} joined
                  </div>
                )}
              </div>
            </div>

            {/* Game Controls */}
            <div className="space-y-4">
              <div className="flex flex-wrap gap-3">
                <select 
                  className="bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400" 
                  value={cat} 
                  onChange={(e) => setCat(e.target.value)}
                >
                  <option value="">Random category</option>
                  {CATEGORIES.map((c) => <option key={c.id} value={c.id} className="bg-slate-800">{c.label}</option>)}
                </select>
                
                <button 
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-400 disabled:bg-gray-600 disabled:cursor-not-allowed" 
                  onClick={newQuestion} 
                  disabled={!room?.players || room.players.length < 1}
                >
                  Start Game
                </button>
              </div>
              
              {room?.currentQuestion && (
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-center">
                    <div className="text-white/70 text-sm mb-1">Current Question:</div>
                    <div className="text-white font-medium">
                      {room.currentQuestion.question}
                    </div>
                    <div className="text-purple-300 text-sm mt-1">
                      Category: {CATEGORIES.find(c => c.id === room.currentQuestion?.category)?.label || room.currentQuestion?.category}
                    </div>
                  {room.currentQuestion.source && (
                    <div className="text-purple-200 text-xs mt-2">
                      Source: <a href={room.currentQuestion.source} target="_blank" rel="noreferrer" className="underline hover:text-purple-100">{room.currentQuestion.source}</a>
                    </div>
                  )}
                  </div>
                  
                  {room.gameState === 'playing' && (
                    <div className="mt-4 space-y-3">
                      {/* Player Status */}
                      <div className="text-center">
                        <div className="text-white/70 text-sm mb-2">Player Status:</div>
                        <div className="space-y-1">
                          {room.players.map((player, index) => (
                            <div key={player.id} className="text-white text-sm">
                              {player.name}: {player.currentAnswer !== undefined ? `Answered (${player.currentAnswer})` : "Waiting..."}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="text-center">
                        <button
                          className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          onClick={async () => {
                            try {
                              const res = await fetch("/api/room/reveal", {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ roomCode })
                              });
                              const data = await res.json();
                              if (data.success) {
                                setRoom(data.room);
                              }
                            } catch (err) {
                              alert("Failed to reveal results");
                            }
                          }}
                          
                        >
                          Reveal Results
                        </button>
                      </div>
                    </div>
                  )}

                  {room.gameState === 'revealed' && (
                    <div className="mt-4 space-y-4">
                      <div className="text-white/70 text-sm text-center">
                        Results revealed! Review the scoreboard before moving on.
                      </div>
                      {scoreboard && (
                        <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                          <h3 className="text-white font-semibold text-lg mb-3 text-center">Overall Scoreboard</h3>
                          {scoreboard.hasRounds ? (
                            <div className="grid md:grid-cols-2 gap-4">
                              <div>
                                <div className="text-purple-300 text-sm font-medium mb-2 text-center">Closest Wins</div>
                                <div className="space-y-2">
                                  {scoreboard.closest.map((player, idx) => (
                                    <div key={player.id} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2 border border-white/10">
                                      <div className="flex items-center gap-3">
                                        <span className="text-purple-200 font-semibold w-6 text-center">{idx + 1}</span>
                                        <span className="text-white font-medium">{player.name}</span>
                                      </div>
                                      <div className="text-purple-200 text-sm font-semibold">
                                        {player.closest} {player.closest === 1 ? "time" : "times"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <div className="text-pink-300 text-sm font-medium mb-2 text-center">Farthest Off</div>
                                <div className="space-y-2">
                                  {scoreboard.farthest.map((player, idx) => (
                                    <div key={player.id} className="flex justify-between items-center bg-white/10 rounded-lg px-3 py-2 border border-white/10">
                                      <div className="flex items-center gap-3">
                                        <span className="text-pink-200 font-semibold w-6 text-center">{idx + 1}</span>
                                        <span className="text-white font-medium">{player.name}</span>
                                      </div>
                                      <div className="text-pink-200 text-sm font-semibold">
                                        {player.farthest} {player.farthest === 1 ? "time" : "times"}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="text-white/60 text-center text-sm">
                              No rounds completed yet—play a question to populate the scoreboard.
                            </div>
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <button
                          className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded-lg font-medium transition-colors"
                          onClick={newQuestion}
                        >
                          Next Question
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

        {/* Question */}
        {q && (
          <section className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
            <div className="mb-6">
              <div className="bg-white/5 rounded-lg p-6 border border-white/20 mb-4">
                <div className="text-2xl font-bold text-white text-center leading-relaxed">
                  {q.question}
                </div>
                <div className="text-center mt-2">
                  <span className="text-purple-300 text-sm font-medium">
                    Category: {CATEGORIES.find(c => c.id === q.category)?.label || q.category}
                  </span>
                </div>
              </div>
              <div className="flex justify-center">
                <div className={`text-lg font-bold px-6 py-3 rounded-full border-2 ${
                  revealed 
                    ? "bg-red-500/20 border-red-400 text-red-200" 
                    : tick <= 5 
                      ? "bg-orange-500/20 border-orange-400 text-orange-200" 
                      : "bg-blue-500/20 border-blue-400 text-blue-200"
                }`}>
                  {revealed ? "Time's up!" : `${tick}s remaining`}
                </div>
              </div>
            </div>
            
            {!revealed ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                {players.map((p) => (
                  <div key={p} className="bg-white/5 rounded-lg p-4 border border-white/10">
                    <label className="block text-white font-medium mb-2">{p}</label>
                    <input 
                      type="number" 
                      className="w-full bg-white/20 border border-white/30 rounded-lg px-4 py-3 text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:border-transparent"
                      placeholder="Your guess..."
                      value={guesses[p] ?? ""} 
                      onChange={(e) => setGuesses((g) => ({ ...g, [p]: e.target.value }))}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-white/5 rounded-lg p-4 border border-white/10">
                  <div className="text-white">
                    <span className="text-white/70">Correct answer:</span> 
                    <span className="text-2xl font-bold text-green-400 ml-2">
                      {q.answer} {q.unit || ""}
                    </span>
                    {q.source && (
                      <a className="text-purple-300 underline ml-2 hover:text-purple-200" href={q.source} target="_blank">
                        source
                      </a>
                    )}
                  </div>
                </div>
                
                <div className="space-y-2">
                  {results.map((r, i) => (
                    <div key={r.player}
                         className={`flex justify-between items-center p-4 rounded-lg border-2 ${
                           i === 0 
                             ? "bg-green-500/20 border-green-400" 
                             : i === results.length - 1 
                               ? "bg-red-500/20 border-red-400" 
                               : "bg-white/5 border-white/20"
                         }`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                          i === 0 
                            ? "bg-green-500 text-white" 
                            : i === results.length - 1 
                              ? "bg-red-500 text-white" 
                              : "bg-white/20 text-white"
                        }`}>
                          {i + 1}
                        </div>
                        <span className="text-white font-medium">{r.player}</span>
                      </div>
                      <div className="text-right">
                        <div className="text-white/70 text-sm">
                          Guess: <span className="font-medium">{r.guess || "—"}</span>
                        </div>
                        <div className="text-white/60 text-xs">
                          Δ = {Number.isFinite(r.dist) ? r.dist.toFixed(1) : "—"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="mt-6 text-center">
              {!revealed ? (
                <button 
                  className="bg-orange-600 hover:bg-orange-700 text-white px-8 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:bg-gray-600 disabled:cursor-not-allowed" 
                  onClick={() => setRevealed(true)} 
                  disabled={players.some(p => !guesses[p])}
                >
                  Reveal & Score
                </button>
              ) : (
                <button 
                  className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400" 
                  onClick={newQuestion}
                >
                  Next Question
                </button>
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
