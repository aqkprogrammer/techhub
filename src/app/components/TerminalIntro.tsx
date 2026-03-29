import useTypingEffect from "./hooks/useTypingEffect";

export default function TerminalIntro() {
  const lines = [
    ">>> techhub locate --page",
    "Searching routes...",
    "Error: ROUTE_NOT_FOUND",
    "Suggestion: try /interview-questions"
  ];

  const displayedText = useTypingEffect(lines);

  return (
    <div className="mt-10 w-full max-w-md rounded-2xl bg-slate-900 shadow-2xl border border-slate-800 p-5 font-mono text-sm">
      <div className="flex gap-2 mb-3">
        <div className="w-3 h-3 bg-red-500 rounded-full" />
        <div className="w-3 h-3 bg-yellow-400 rounded-full" />
        <div className="w-3 h-3 bg-green-500 rounded-full" />
      </div>

      <pre className="whitespace-pre-wrap text-emerald-400">
        {displayedText}
        <span className="animate-pulse text-white">|</span>
      </pre>
    </div>
  );
}
