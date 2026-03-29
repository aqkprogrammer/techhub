import { useEffect, useState } from "react";

export default function useTypingEffect(lines: string[]) {
  const [displayedText, setDisplayedText] = useState("");
  const [currentLine, setCurrentLine] = useState(0);
  const [charIndex, setCharIndex] = useState(0);

  useEffect(() => {
    if (currentLine >= lines.length) return;

    if (charIndex < lines[currentLine].length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + lines[currentLine][charIndex]);
        setCharIndex((prev) => prev + 1);
      }, 35);
      return () => clearTimeout(timeout);
    } else {
      const delay = setTimeout(() => {
        setDisplayedText((prev) => prev + "\n");
        setCurrentLine((prev) => prev + 1);
        setCharIndex(0);
      }, 600);
      return () => clearTimeout(delay);
    }
  }, [charIndex, currentLine, lines]);

  return displayedText;
}
