"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";

const SNIPPETS = [
  "const sum = (a, b) => a + b;",
  "useEffect(() => { fetchData(); }, []);",
  "for (let i = 0; i < arr.length; i++) {}",
  "if (!user) return redirect('/login');",
  "async function fetchData() { await fetch('/api'); }"
];

export default function SpeedTypingChallenge() {
  const [snippet, setSnippet] = useState("");
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [status, setStatus] = useState<"idle" | "playing" | "finished">("idle");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [streak, setStreak] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSnippet(SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]);
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    if (timeLeft === 0) {
      setStatus("finished");
      return;
    }

    const timer = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, status]);

  const startGame = () => {
    setInput("");
    setTimeLeft(30);
    setStatus("playing");
    setStartTime(Date.now());
    setStreak(0);
  };

  const resetGame = () => {
    setSnippet(SNIPPETS[Math.floor(Math.random() * SNIPPETS.length)]);
    setInput("");
    setTimeLeft(30);
    setStatus("idle");
    setStartTime(null);
    setStreak(0);
  };

  // 🔥 Streak logic
  useEffect(() => {
    if (!input) return;

    const lastIndex = input.length - 1;
    if (snippet[lastIndex] === input[lastIndex]) {
      setStreak((prev) => prev + 1);
    } else {
      setStreak(0);
    }
  }, [input, snippet]);

  const accuracy = useMemo(() => {
    if (!input.length) return 100;
    let correct = 0;
    for (let i = 0; i < input.length; i++) {
      if (input[i] === snippet[i]) correct++;
    }
    return Math.round((correct / input.length) * 100);
  }, [input, snippet]);

  const wpm = useMemo(() => {
    if (!startTime) return 0;
    const minutes = (Date.now() - startTime) / 1000 / 60;
    const words = input.length / 5;
    return minutes > 0 ? Math.round(words / minutes) : 0;
  }, [input, startTime]);

  // 🌈 Neon gradient timer
  const timerPercent = (timeLeft / 30) * 100;

  const timerColor =
    timeLeft > 15
      ? "from-green-400 to-blue-500"
      : timeLeft > 7
      ? "from-yellow-400 to-orange-500"
      : "from-red-500 to-pink-600";

  const renderSnippet = () =>
    snippet.split("").map((char, index) => {
      let style = "text-muted-foreground";

      if (index < input.length) {
        style =
          input[index] === char
            ? "text-green-500"
            : "text-red-500 bg-red-500/10 rounded";
      }

      return (
        <span key={index} className={style}>
          {char}
        </span>
      );
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-16 w-full max-w-xl rounded-2xl bg-card border border-border shadow-xl p-8"
    >
      <h3 className="text-xl font-semibold text-foreground">
        ⚡ Advanced Speed Typing Challenge
      </h3>

      {status === "idle" && (
        <button
          onClick={startGame}
          className="mt-6 w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium"
        >
          Start Challenge
        </button>
      )}

      {status === "playing" && (
        <>
          {/* 🌈 Neon Timer */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>⏳ {timeLeft}s</span>
              <span>🔥 Streak: {streak}</span>
            </div>

            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className={`h-full bg-gradient-to-r ${timerColor}`}
                animate={{ width: `${timerPercent}%` }}
                transition={{ ease: "linear" }}
              />
            </div>
          </div>

          {/* 🧠 Snippet Display */}
          <div
            ref={containerRef}
            className="relative bg-muted/50 border border-border rounded-lg p-4 font-mono text-sm leading-relaxed mb-4"
          >
            {renderSnippet()}

            {/* 👻 Ghost Caret */}
            <motion.span
              className="absolute w-[2px] bg-primary"
              animate={{
                opacity: [0, 1, 0]
              }}
              transition={{
                repeat: Infinity,
                duration: 1
              }}
              style={{
                height: "1.2em",
                left: `${input.length * 8}px`,
                top: "16px"
              }}
            />
          </div>

          {/* ✍️ Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            rows={4}
            autoFocus
          />

          {/* 📊 Live Stats */}
          <div className="flex justify-between mt-4 text-sm text-muted-foreground">
            <span>🎯 Accuracy: {accuracy}%</span>
            <span>⚡ WPM: {wpm}</span>
          </div>
        </>
      )}

      {status === "finished" && (
        <div className="mt-6 rounded-xl bg-muted/40 border border-border p-6 text-center">
          <h4 className="text-lg font-semibold text-foreground mb-3">
            🏆 Results
          </h4>

          <div className="flex justify-between text-sm mb-2">
            <span>Accuracy</span>
            <span>{accuracy}%</span>
          </div>

          <div className="flex justify-between text-sm mb-2">
            <span>WPM</span>
            <span>{wpm}</span>
          </div>

          <div className="flex justify-between text-sm mb-2">
            <span>Best Streak</span>
            <span>{streak}</span>
          </div>

          <button
            onClick={resetGame}
            className="mt-6 w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium"
          >
            Try Again
          </button>
        </div>
      )}
    </motion.div>
  );
}
