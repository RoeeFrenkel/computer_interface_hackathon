"use client";

import { useEffect, useState } from "react";

interface AnswerOverlayProps {
  answer: string | null;
  isLoading: boolean;
}

export default function AnswerOverlay({ answer, isLoading }: AnswerOverlayProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (answer || isLoading) {
      setVisible(true);
    }
  }, [answer, isLoading]);

  if (!visible) return null;

  return (
    <div
      className={`absolute bottom-20 left-4 right-4 md:left-6 md:right-auto md:max-w-[60%] z-10 transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="bg-black/75 backdrop-blur-md border border-white/10 rounded-xl p-4 shadow-2xl">
        {isLoading ? (
          <div className="flex items-center gap-2 text-zinc-300">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:0ms]" />
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:150ms]" />
              <span className="w-2 h-2 bg-orange-400 rounded-full animate-bounce [animation-delay:300ms]" />
            </div>
            <span className="text-sm">Thinking...</span>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-orange-400 text-sm font-semibold">SportsChat</span>
              <button
                onClick={() => setVisible(false)}
                className="ml-auto text-zinc-500 hover:text-zinc-300 text-xs"
              >
                dismiss
              </button>
            </div>
            <p className="text-white text-sm leading-relaxed">{answer}</p>
          </div>
        )}
      </div>
    </div>
  );
}
