"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Copy, Check, Mail } from "lucide-react";

export default function ErrorFooter() {
  const [copied, setCopied] = useState(false);
  const [glitch, setGlitch] = useState(false);
  const [uptime, setUptime] = useState(0);

  const errorCode = "TECHHUB_404_NOT_FOUND";
  const buildVersion = "v2.4.1 • build 98f2a";
  const [serverTimestamp, setServerTimestamp] = useState<string | null>(null);

useEffect(() => {
  setServerTimestamp(new Date().toISOString());
}, []);

  /* -------------------------
     Copy to clipboard
  -------------------------- */
  const handleCopy = async () => {
    await navigator.clipboard.writeText(errorCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /* -------------------------
     Fake Uptime Counter
  -------------------------- */
  useEffect(() => {
    const interval = setInterval(() => {
      setUptime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  /* -------------------------
     Glitch Flicker every 10s
  -------------------------- */
  useEffect(() => {
    const glitchInterval = setInterval(() => {
      setGlitch(true);
      setTimeout(() => setGlitch(false), 300);
    }, 10000);

    return () => clearInterval(glitchInterval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.6 }}
      className="mt-16 w-full max-w-2xl text-xs"
    >
      <div className="
        relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4
        rounded-2xl border border-border
        bg-background/60 backdrop-blur-xl
        px-6 py-4
        shadow-sm
      ">
        {/* LEFT SIDE */}
        <div className="flex flex-col gap-2">

          {/* Error Code */}
          <div className="flex items-center gap-3">

            {/* Status Dot */}
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>

            {/* Copyable Code */}
            <div className="relative group">
              <motion.button
                onClick={handleCopy}
                animate={glitch ? { x: [-2, 2, -2, 0] } : {}}
                transition={{ duration: 0.2 }}
                className="
                  flex items-center gap-2 font-mono tracking-wider
                  text-muted-foreground hover:text-foreground
                  transition
                "
              >
                {errorCode}
                {copied ? (
                  <Check size={14} className="text-green-500" />
                ) : (
                  <Copy size={14} className="opacity-60 group-hover:opacity-100 transition" />
                )}
              </motion.button>

              {/* Tooltip */}
              <div className="
                absolute -top-7 left-1/2 -translate-x-1/2
                rounded-md bg-black text-white px-2 py-1 text-[10px]
                opacity-0 group-hover:opacity-100
                transition pointer-events-none
              ">
                Click to copy
              </div>
            </div>
          </div>

          {/* Build + Timestamp */}
          <div className="text-muted-foreground space-x-2">
            <span>{buildVersion}</span>
            <span>•</span>
            <span>{serverTimestamp ?? "Loading..."}</span>
          </div>

        </div>

        {/* RIGHT SIDE */}
        <div className="flex flex-col sm:items-end gap-2">

          {/* Uptime */}
          <div className="text-muted-foreground font-mono">
            Uptime: {formatTime(uptime)}
          </div>

          {/* Report Link */}
          <a
            href={`mailto:support@techhub.cafe?subject=404 Error Report&body=Error Code: ${errorCode}%0D%0ABuild: ${buildVersion}%0D%0ATimestamp: ${serverTimestamp}`}
            className="
              flex items-center gap-1
              text-primary hover:underline
              transition
            "
          >
            <Mail size={14} />
            Report this error
          </a>

        </div>
      </div>
    </motion.div>
  );
}

/* -------------------------
   Helper: Format uptime
-------------------------- */
function formatTime(seconds: number) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${hrs.toString().padStart(2, "0")}:${mins
    .toString()
    .padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
