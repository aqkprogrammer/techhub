import { useEffect } from "react";

export default function useCountdown(
  timeLeft: number,
  setTimeLeft: (value: number) => void,
  onEnd: () => void,
  active: boolean
) {
  useEffect(() => {
    if (!active) return;
    if (timeLeft === 0) {
      onEnd();
      return;
    }

    const timer = setTimeout(() => {
      setTimeLeft(timeLeft - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [timeLeft, active]);
}
