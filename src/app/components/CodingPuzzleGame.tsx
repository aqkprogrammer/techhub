"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";

const challenges = [
  { question: "Reverse this string: 'react'", answer: "tcaer" },
  { question: "What is 2 ** 5 ?", answer: "32" },
  { question: "What hook runs after render in React?", answer: "useeffect" },
  { question: "What keyword declares a constant in JS?", answer: "const" }
];

export default function CodingPuzzleGame() {
  const [challenge, setChallenge] = useState(challenges[0]);
  const [input, setInput] = useState("");
  const [timeLeft, setTimeLeft] = useState(30);
  const [status, setStatus] = useState<"playing" | "won" | "lost">("playing");

  const [xp, setXp] = useState(0);
  const level = Math.floor(xp / 100) + 1;
  const xpProgress = xp % 100;

  useEffect(() => {
    setChallenge(
      challenges[Math.floor(Math.random() * challenges.length)]
    );
  }, []);

  useEffect(() => {
    if (status !== "playing") return;

    if (timeLeft === 0) {
      setStatus("lost");
      return;
    }

    const timer = setTimeout(() => setTimeLeft((p) => p - 1), 1000);
    return () => clearTimeout(timer);
  }, [timeLeft, status]);

  const triggerConfetti = () => {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 }
    });
  };

  const checkAnswer = () => {
    if (input.toLowerCase().trim() === challenge.answer) {
      setStatus("won");
      setXp((prev) => prev + 50);
      triggerConfetti();
    } else {
      setStatus("lost");
    }
  };

  const resetGame = () => {
    setChallenge(
      challenges[Math.floor(Math.random() * challenges.length)]
    );
    setInput("");
    setTimeLeft(30);
    setStatus("playing");
  };

  const timerPercent = (timeLeft / 30) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-12 w-full max-w-md rounded-2xl bg-card border border-border shadow-xl p-8"
    >
      {/* Level + XP */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-muted-foreground mb-2">
          <span>Level {level}</span>
          <span>{xpProgress}/100 XP</span>
        </div>

        <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary"
            animate={{ width: `${xpProgress}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>
      </div>

      <h3 className="text-lg font-semibold text-foreground">
        🎮 30-Second Dev Challenge
      </h3>

      <p className="text-sm text-muted-foreground mt-2 mb-6">
        Solve before the timer hits zero!
      </p>

      {status === "playing" && (
        <>
          {/* Timer Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>⏳ {timeLeft}s</span>
              <span>Think fast!</span>
            </div>

            <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-red-500"
                animate={{ width: `${timerPercent}%` }}
                transition={{ ease: "linear" }}
              />
            </div>
          </div>

          <p className="mb-4 text-foreground font-medium">
            {challenge.question}
          </p>

          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Type your answer..."
          />

          <button
            onClick={checkAnswer}
            className="mt-5 w-full rounded-lg bg-primary text-primary-foreground py-3 font-medium hover:opacity-90 transition"
          >
            Submit
          </button>
        </>
      )}

      {status === "won" && (
        <div className="text-center">
          <p className="text-green-500 font-semibold text-lg">
            🎉 You Won! +50 XP
          </p>

          <button
            onClick={resetGame}
            className="mt-6 px-6 py-3 rounded-lg bg-primary text-primary-foreground"
          >
            Play Again
          </button>
        </div>
      )}

      {status === "lost" && (
        <div className="text-center">
          <p className="text-red-500 font-semibold">
            ❌ Time’s up or incorrect!
          </p>

          <button
            onClick={resetGame}
            className="mt-6 px-6 py-3 rounded-lg bg-primary text-primary-foreground"
          >
            Retry
          </button>
        </div>
      )}
    </motion.div>
  );
}
