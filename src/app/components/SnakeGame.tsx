"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";

type Position = { x: number; y: number };
type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";

const GRID = 20;
const INITIAL_SPEED = 120;

export default function SnakeGame() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const musicRef = useRef<AudioContext | null>(null);

  const [snake, setSnake] = useState<Position[]>([
    { x: 10, y: 10 },
    { x: 10, y: 11 },
    { x: 10, y: 12 },
  ]);

  const [food, setFood] = useState<Position>({ x: 6, y: 6 });
  const [direction, setDirection] = useState<Direction>("UP");
  const [queuedDirection, setQueuedDirection] = useState<Direction | null>(null);

  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [speed, setSpeed] = useState(INITIAL_SPEED);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [score, setScore] = useState(0);
  const [particles, setParticles] = useState<Position[]>([]);
  const [leaderboard, setLeaderboard] = useState<number[]>([]);

  const boardSize = isFullscreen
    ? Math.min(window.innerWidth, window.innerHeight) * 0.85
    : 560;
  const CELL = Math.floor(boardSize / GRID);

  /* ---------------------------
     Retro Sound Engine
  ---------------------------- */

  function playTone(freq: number, duration = 100) {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "square";
    osc.frequency.value = freq;
    gain.gain.value = 0.1;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    setTimeout(() => {
      osc.stop();
      ctx.close();
    }, duration);
  }

  /* ---------------------------
     Leaderboard
  ---------------------------- */

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("snake_leaderboard") || "[]");
    setLeaderboard(saved);
  }, []);

  function saveScore(newScore: number) {
    const updated = [...leaderboard, newScore]
      .sort((a, b) => b - a)
      .slice(0, 5);

    localStorage.setItem("snake_leaderboard", JSON.stringify(updated));
    setLeaderboard(updated);
  }

  function getRank(score: number) {
    if (score >= 150) return "💎 Neon Architect";
    if (score >= 100) return "🥇 Gold Dev";
    if (score >= 60) return "🥈 Silver Dev";
    return "🥉 Bronze Dev";
  }

  /* ---------------------------
     Direction
  ---------------------------- */

  const directionMap: Record<Direction, Position> = {
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
  };

  const isOpposite = (a: Direction, b: Direction) =>
    (a === "UP" && b === "DOWN") ||
    (a === "DOWN" && b === "UP") ||
    (a === "LEFT" && b === "RIGHT") ||
    (a === "RIGHT" && b === "LEFT");

  /* ---------------------------
     Food
  ---------------------------- */

  const generateFood = useCallback((currentSnake: Position[]) => {
    let newFood: Position;
    while (true) {
      newFood = {
        x: Math.floor(Math.random() * GRID),
        y: Math.floor(Math.random() * GRID),
      };
      if (!currentSnake.some(p => p.x === newFood.x && p.y === newFood.y))
        return newFood;
    }
  }, []);

  /* ---------------------------
     Game Loop
  ---------------------------- */

  const gameTick = useCallback(() => {
    setSnake(prev => {
      let newDir = direction;

      if (queuedDirection && !isOpposite(direction, queuedDirection)) {
        newDir = queuedDirection;
        setDirection(queuedDirection);
        setQueuedDirection(null);
      }

      const head = prev[0];
      const move = directionMap[newDir];

      const next = { x: head.x + move.x, y: head.y + move.y };

      if (
        next.x < 0 ||
        next.y < 0 ||
        next.x >= GRID ||
        next.y >= GRID ||
        prev.some(p => p.x === next.x && p.y === next.y)
      ) {
        endGame();
        return prev;
      }

      const newSnake = [next, ...prev];

      if (next.x === food.x && next.y === food.y) {
        setScore(s => s + 10);
        playTone(600);
        triggerParticles(next);
        setFood(generateFood(newSnake));
        setSpeed(s => Math.max(70, s - 3));
      } else {
        newSnake.pop();
      }

      return newSnake;
    });
  }, [direction, queuedDirection, food, generateFood]);

  useEffect(() => {
    if (!running) return;
    intervalRef.current = setInterval(gameTick, speed);
    return () => clearInterval(intervalRef.current!);
  }, [running, speed, gameTick]);

  /* ---------------------------
     Controls
  ---------------------------- */

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const map: Record<string, Direction> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
      };
      if (map[e.key]) {
        e.preventDefault();
        setQueuedDirection(map[e.key]);
      }
    };

    window.addEventListener("keydown", handleKey, { passive: false });
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  const swipe = useSwipeable({
    onSwipedUp: () => setQueuedDirection("UP"),
    onSwipedDown: () => setQueuedDirection("DOWN"),
    onSwipedLeft: () => setQueuedDirection("LEFT"),
    onSwipedRight: () => setQueuedDirection("RIGHT"),
    trackMouse: true,
  });

  /* ---------------------------
     Particles
  ---------------------------- */

  function triggerParticles(pos: Position) {
    const burst = Array.from({ length: 12 }).map(() => ({
      x: pos.x,
      y: pos.y,
    }));
    setParticles(burst);
    setTimeout(() => setParticles([]), 400);
  }

  /* -------------------------
     Fullscreen Restore
  -------------------------- */

  function toggleFullscreen() {
    const el = containerRef.current;
    if (!el) return;

    if (!document.fullscreenElement) {
      el.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }

  useEffect(() => {
    const handler = () => {
      const active = !!document.fullscreenElement;
      setIsFullscreen(active);
      document.body.style.overflow = active ? "hidden" : "auto";
      if (active) containerRef.current?.focus();
    };

    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  /* -------------------------
     Procedural Music Engine
  -------------------------- */

  function startMusic() {
    if (musicRef.current) return;

    const ctx = new AudioContext();
    musicRef.current = ctx;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.value = 90;

    gain.gain.value = 0.05;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    // Subtle evolving modulation
    setInterval(() => {
      osc.frequency.value = 80 + Math.random() * 40;
    }, 800);
  }

  function stopMusic() {
    musicRef.current?.close();
    musicRef.current = null;
  }

  /* ---------------------------
     Game State
  ---------------------------- */

  function startGame() {
    setSnake([
      { x: 10, y: 10 },
      { x: 10, y: 11 },
      { x: 10, y: 12 },
    ]);
    setDirection("UP");
    setQueuedDirection(null);
    setScore(0);
    setSpeed(INITIAL_SPEED);
    setGameOver(false);
    setRunning(true);
    startMusic();
  }

  function endGame() {
    stopMusic();
    playTone(200, 300);
    setRunning(false);
    setGameOver(true);
    saveScore(score);
  }

  /* ---------------------------
     UI
  ---------------------------- */

  return (
    <motion.div
      ref={containerRef}
      tabIndex={0}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative ${
        isFullscreen
          ? "fixed inset-0 z-50 bg-black flex flex-col items-center justify-center"
          : "mt-10 max-w-3xl mx-auto rounded-2xl bg-black p-6 shadow-2xl text-white"
      }`}
    >
      {/* Header (hide in immersive fullscreen if desired) */}
      {!isFullscreen && (
        <div className="text-white text-xl font-semibold mb-6">
          🐍 Snake Dev Arcade
        </div>
      )}
  
      {/* Fullscreen HUD */}
      {isFullscreen && (
        <>
          <div className="absolute top-6 left-8 text-white text-lg font-semibold">
            🐍 Snake Dev Arcade
          </div>
  
          <div className="absolute bottom-6 left-8 text-white">
            Score: {score}
          </div>
  
          <div className="absolute bottom-6 right-8 text-white">
            Speed: {Math.round(1000 / speed)}
          </div>
        </>
      )}
  
      {/* ---------- GAME BOARD ---------- */}
      <div
        {...swipe}
        className="relative rounded-xl overflow-hidden"
        style={{
          width: isFullscreen
            ? Math.min(window.innerWidth, window.innerHeight) * 0.9
            : 560,
          height: isFullscreen
            ? Math.min(window.innerWidth, window.innerHeight) * 0.9
            : 560,
          background:
            "repeating-linear-gradient(0deg,#111 0px,#111 1px,transparent 1px,transparent 28px), repeating-linear-gradient(90deg,#111 0px,#111 1px,transparent 1px,transparent 28px)",
        }}
      >
        {/* Snake */}
        {snake.map((seg, i) => (
          <motion.div
            key={i}
            layout
            transition={{ type: "spring", stiffness: 300 }}
            className={`absolute ${
              i === 0
                ? "bg-emerald-400 shadow-[0_0_12px_#34d399]"
                : "bg-emerald-500"
            }`}
            style={{
              width:
                (isFullscreen
                  ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                  : 560) / GRID,
              height:
                (isFullscreen
                  ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                  : 560) / GRID,
              left:
                seg.x *
                ((isFullscreen
                  ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                  : 560) /
                  GRID),
              top:
                seg.y *
                ((isFullscreen
                  ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                  : 560) /
                  GRID),
            }}
          >
            {i === 0 && (
              <div className="absolute flex gap-1 top-1 left-1">
                <div className="w-2 h-2 bg-black rounded-full" />
                <div className="w-2 h-2 bg-black rounded-full" />
              </div>
            )}
          </motion.div>
        ))}
  
        {/* Food */}
        <motion.div
          layout
          className="absolute bg-pink-500 rounded-full shadow-[0_0_20px_#ec4899]"
          style={{
            width:
              (isFullscreen
                ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                : 560) / GRID,
            height:
              (isFullscreen
                ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                : 560) / GRID,
            left:
              food.x *
              ((isFullscreen
                ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                : 560) /
                GRID),
            top:
              food.y *
              ((isFullscreen
                ? Math.min(window.innerWidth, window.innerHeight) * 0.9
                : 560) /
                GRID),
          }}
        />
  
        {/* Game Over */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center"
            >
              <h3 className="text-2xl mb-3">Game Over</h3>
              <p className="mb-2">{getRank(score)}</p>
              <button
                onClick={startGame}
                className="px-6 py-2 bg-indigo-600 rounded-lg"
              >
                Restart
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
  
      {/* Controls (hide in fullscreen) */}
      {!isFullscreen && (
        <>
          <div className="flex justify-between mt-4 text-white">
            <span>Score: {score}</span>
            <span>Speed: {Math.round(1000 / speed)}</span>
          </div>
  
          <div className="flex gap-4 mt-4">
            <button
              onClick={startGame}
              className="px-4 py-2 bg-indigo-600 rounded-lg"
            >
              {running ? "Restart" : "Start"}
            </button>
  
            <button
              onClick={toggleFullscreen}
              className="px-4 py-2 bg-zinc-700 rounded-lg"
            >
              Fullscreen
            </button>
          </div>
  
          <div className="mt-6">
            <h4 className="font-semibold mb-2">🏆 Leaderboard</h4>
            {leaderboard.map((s, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{i + 1}.</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </motion.div>
  );
}
