"use client";

import { useRef, useState, useCallback } from "react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}

type ListeningState = "idle" | "listening" | "processing";

export default function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const [state, setState] = useState<ListeningState>("idle");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setState("processing");
      onTranscript(text);
      // Reset to idle after a short delay so the user sees the processing state
      setTimeout(() => setState("idle"), 600);
    };

    recognition.onerror = () => {
      setState("idle");
    };

    recognition.onend = () => {
      // Only reset if we didn't already transition to processing
      setState((prev) => (prev === "listening" ? "idle" : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
    setState("listening");
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  // Check browser support
  if (
    typeof window !== "undefined" &&
    !window.SpeechRecognition &&
    !window.webkitSpeechRecognition
  ) {
    return null; // Hide button if not supported, text input is the fallback
  }

  const stateStyles = {
    idle: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white border-zinc-700",
    listening:
      "bg-red-600 text-white border-red-500 shadow-lg shadow-red-600/30 scale-110",
    processing:
      "bg-yellow-600 text-white border-yellow-500",
  };

  return (
    <button
      onMouseDown={startListening}
      onMouseUp={stopListening}
      onMouseLeave={stopListening}
      onTouchStart={(e) => {
        e.preventDefault();
        startListening();
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        stopListening();
      }}
      disabled={disabled}
      className={`relative flex items-center justify-center w-12 h-12 rounded-full border transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed select-none ${stateStyles[state]}`}
      title="Hold to talk"
    >
      {/* Pulsing ring when listening */}
      {state === "listening" && (
        <span className="absolute inset-0 rounded-full border-2 border-red-400 animate-ping opacity-40" />
      )}

      {/* Mic icon */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
        <line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    </button>
  );
}
