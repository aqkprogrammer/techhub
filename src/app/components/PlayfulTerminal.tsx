import { TerminalSquare } from "lucide-react";
import { useState } from "react";

export default function PlayfulTerminal() {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState<string[]>([
    "Welcome to techhub CLI 🧑‍💻",
    "Type 'help' to see available commands."
  ]);

  const handleCommand = () => {
    const command = input.trim().toLowerCase();

    if (command === "help") {
      setOutput((prev) => [
        ...prev,
        "> help",
        "Available commands:",
        "- home",
        "- questions",
        "- coffee ☕"
      ]);
    } else if (command === "home") {
      window.location.href = "/";
    } else if (command === "questions") {
      window.location.href = "/interview-questions";
    } else if (command === "coffee") {
      setOutput((prev) => [...prev, "> coffee", "☕ Refilling your energy..."]);
    } else if (command !== "") {
      setOutput((prev) => [
        ...prev,
        `> ${command}`,
        "Command not found. Try 'help'."
      ]);
    }

    setInput("");
  };

  return (
    <div className="mt-8 w-full max-w-md bg-zinc-900 border border-border rounded-xl p-4 font-mono text-left text-sm shadow-lg">
      <div className="flex items-center gap-2 mb-2 text-muted-foreground">
        <TerminalSquare size={16} />
        techhub-terminal
      </div>

      <div className="min-h-[120px] whitespace-pre-wrap text-green-400">
        {output.join("\n")}
      </div>

      <div className="flex items-center mt-3">
        <span className="text-green-400 mr-2">{">"}</span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCommand()}
          className="flex-1 bg-transparent outline-none text-white"
          placeholder="Type a command..."
        />
      </div>
    </div>
  );
}