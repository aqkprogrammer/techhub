import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSwipeable } from "react-swipeable";
import TerminalIntro from "./TerminalIntro";
import PlayfulTerminal from "./PlayfulTerminal";
import CodingPuzzleGame from "./CodingPuzzleGame";
import SpeedTypingChallenge from "./SpeedTypingChallenge";
import SnakeGame from "./SnakeGame";

type Tab = "intro" | "cli" | "puzzle" | "typing" | "snake";

export default function GamesPanel() {
  const [active, setActive] = useState<Tab>("intro");

  const tabs: { key: Tab; label: string }[] = [
    { key: "intro", label: "🖥 Intro" },
    { key: "cli", label: "💻 CLI" },
    { key: "puzzle", label: "🎮 Puzzle" },
    { key: "typing", label: "⚡ Typing" },
    { key: "snake", label: "🐍 Snake" }
  ];

  // Swipe Support
  const handlers = useSwipeable({
    onSwipedLeft: () => moveTab(1),
    onSwipedRight: () => moveTab(-1),
    trackMouse: true
  });

  const moveTab = (direction: number) => {
    const index = tabs.findIndex((t) => t.key === active);
    const nextIndex = index + direction;

    if (nextIndex >= 0 && nextIndex < tabs.length) {
      setActive(tabs[nextIndex].key);
    }
  };

  return (

      <div className="flex-1 overflow-hidden">
    <div {...handlers} className="flex flex-col h-full w-full">

      {/* ---------- Segmented Control ---------- */}
      <div className="flex justify-center mb-8 px-4">
  <div className="
    relative flex w-full max-w-xl
    rounded-full
    bg-muted
    p-1
    shadow-inner
    overflow-hidden
  ">

    {/* Animated Active Pill */}
    <motion.div
      layoutId="active-pill"
      transition={{ type: "spring", stiffness: 500, damping: 35 }}
      className="
        absolute top-1 bottom-1 rounded-full
        bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500
        shadow-lg
      "
      style={{
        width: `${100 / tabs.length}%`,
        left: `${(tabs.findIndex(t => t.key === active) * 100) / tabs.length}%`
      }}
    />

    {tabs.map((tab) => (
      <SegmentButton
        key={tab.key}
        active={active === tab.key}
        onClick={() => setActive(tab.key)}
      >
        {tab.label}
      </SegmentButton>
    ))}
  </div>
</div>

      {/* ---------- Content ---------- */}
      <div className="flex-1 overflow-hidden relative min-w-[30rem]">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.25 }}
            className="h-full"
          >
            {active === "intro" && <TerminalIntro />}
            {active === "cli" && <PlayfulTerminal />}
            {active === "puzzle" && <CodingPuzzleGame />}
            {active === "typing" && <SpeedTypingChallenge />}
            {active === "snake" && <SnakeGame />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
    </div>
  );
}

function SegmentButton({
  children,
  active,
  onClick
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      className={`
        relative z-10 flex-1
        flex items-center justify-center gap-2
        py-2.5
        text-sm font-medium
        whitespace-nowrap
        transition-colors duration-200
        ${
          active
            ? "text-white"
            : "text-muted-foreground hover:text-foreground"
        }
      `}
    >
      {children}
    </motion.button>
  );
}