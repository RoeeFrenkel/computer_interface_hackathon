"use client";

import { useState, useEffect, useRef } from "react";
import { ExpertiseLevel } from "@/lib/types";
import AnswerOverlay from "@/components/AnswerOverlay";
import ExpertiseToggle from "@/components/ExpertiseToggle";
import MuteToggle from "@/components/MuteToggle";
import VoiceInput from "@/components/VoiceInput";

export default function Home() {
  // Setup state
  const [url, setUrl] = useState("");
  const [setupStatus, setSetupStatus] = useState<"checking" | "idle" | "downloading" | "uploading" | "ready" | "error">("checking");
  const [setupMessage, setSetupMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // App state
  const [expertise, setExpertise] = useState<ExpertiseLevel>("beginner");
  const [isMuted, setIsMuted] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [question, setQuestion] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Check if video exists on load
  useEffect(() => {
    fetch("/api/download-video")
      .then((res) => res.json())
      .then((data) => {
        if (data.loaded) {
          setSetupStatus("ready");
          setSetupMessage(`Video loaded (${data.sizeMB} MB)`);
        } else {
          setSetupStatus("idle");
        }
      })
      .catch(() => setSetupStatus("idle"));
  }, []);

  async function handleDownload() {
    if (!url.trim()) return;
    setSetupStatus("downloading");
    setSetupMessage("Downloading video... this may take a minute");

    try {
      const res = await fetch("/api/download-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        setSetupStatus("ready");
        setSetupMessage(data.message);
      } else if (data.needsManualUpload) {
        setSetupStatus("error");
        setSetupMessage(data.error);
      } else {
        setSetupStatus("error");
        setSetupMessage(data.error || "Download failed");
      }
    } catch {
      setSetupStatus("error");
      setSetupMessage("Download failed — try uploading the file instead");
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setSetupStatus("uploading");
    setSetupMessage("Uploading video...");

    const formData = new FormData();
    formData.append("video", file);

    try {
      const res = await fetch("/api/upload-video", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setSetupStatus("ready");
        setSetupMessage(data.message);
      } else {
        setSetupStatus("error");
        setSetupMessage(data.error || "Upload failed");
      }
    } catch {
      setSetupStatus("error");
      setSetupMessage("Upload failed");
    }
  }

  async function handleAsk(text?: string) {
    const q = text || question;
    if (!q.trim() || isLoading) return;

    const timestamp = videoRef.current?.currentTime ?? 0;

    setIsLoading(true);
    setAnswer(null);
    setQuestion("");

    try {
      const res = await fetch("/api/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q.trim(),
          timestamp,
          expertise,
        }),
      });
      const data = await res.json();

      if (data.answer) {
        setAnswer(data.answer);
        // TTS via ElevenLabs
        if (!isMuted) {
          // Stop any currently playing audio
          if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current = null;
          }
          fetch("/api/tts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: data.answer }),
          })
            .then((res) => {
              if (!res.ok) throw new Error("TTS failed");
              return res.blob();
            })
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              const audio = new Audio(url);
              audioRef.current = audio;
              audio.onended = () => URL.revokeObjectURL(url);
              audio.play();
            })
            .catch(() => {
              // Silent fallback — text overlay is already showing
            });
        }
      } else {
        setAnswer(data.error || "Couldn't get a response. Try again!");
      }
    } catch {
      setAnswer("Something went wrong. Try again!");
    } finally {
      setIsLoading(false);
    }
  }

  // ---------- SETUP SCREEN ----------
  if (setupStatus !== "ready") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black text-white gap-8 p-8">
        {setupStatus === "checking" ? (
          <p className="text-zinc-400">Loading...</p>
        ) : (
          <>
            <div className="text-center">
              <h1 className="text-4xl font-bold mb-2">SportsChat</h1>
              <p className="text-zinc-400">Load an NBA highlight video to get started</p>
            </div>

            <div className="w-full max-w-lg flex flex-col gap-3">
              <label className="text-sm text-zinc-400">Paste a YouTube URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
                  disabled={setupStatus === "downloading" || setupStatus === "uploading"}
                  onKeyDown={(e) => e.key === "Enter" && handleDownload()}
                />
                <button
                  onClick={handleDownload}
                  disabled={!url.trim() || setupStatus === "downloading" || setupStatus === "uploading"}
                  className="rounded-lg bg-orange-600 px-6 py-3 font-medium hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {setupStatus === "downloading" ? "Downloading..." : "Download"}
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full max-w-lg">
              <div className="flex-1 h-px bg-zinc-800" />
              <span className="text-zinc-500 text-sm">or</span>
              <div className="flex-1 h-px bg-zinc-800" />
            </div>

            <div className="w-full max-w-lg">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/mp4,video/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={setupStatus === "downloading" || setupStatus === "uploading"}
                className="w-full rounded-lg border-2 border-dashed border-zinc-700 px-6 py-8 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {setupStatus === "uploading" ? "Uploading..." : "Drop a video file or click to upload"}
              </button>
            </div>

            {setupMessage && (
              <p className={`text-sm ${setupStatus === "error" ? "text-red-400" : "text-zinc-400"}`}>
                {setupMessage}
              </p>
            )}
          </>
        )}
      </div>
    );
  }

  // ---------- MAIN APP ----------
  return (
    <div className="flex flex-col min-h-screen bg-black text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <h1 className="text-lg font-bold tracking-tight">
          <span className="text-orange-500">Sports</span>Chat
        </h1>
        <div className="flex items-center gap-3">
          <ExpertiseToggle level={expertise} onChange={setExpertise} />
          <MuteToggle isMuted={isMuted} onToggle={() => {
            const next = !isMuted;
            setIsMuted(next);
            if (next && audioRef.current) {
              audioRef.current.pause();
              audioRef.current = null;
            }
          }} />
        </div>
      </header>

      {/* Video + Overlay container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="relative w-full max-w-5xl">
          <video
            ref={videoRef}
            src="/highlights/game.mp4"
            controls
            className="w-full rounded-xl border border-zinc-800"
          />
          <AnswerOverlay answer={answer} isLoading={isLoading} />
        </div>
      </main>

      {/* Bottom input bar */}
      <footer className="border-t border-zinc-800 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <VoiceInput onTranscript={handleAsk} disabled={isLoading} />
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAsk()}
            placeholder="Ask about the game... or hold the mic to talk"
            className="flex-1 rounded-lg bg-zinc-900 border border-zinc-700 px-4 py-3 text-white placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            disabled={isLoading}
          />
          <button
            onClick={() => handleAsk()}
            disabled={!question.trim() || isLoading}
            className="rounded-lg bg-orange-600 px-6 py-3 font-medium hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? "..." : "Ask"}
          </button>
        </div>
      </footer>
    </div>
  );
}
