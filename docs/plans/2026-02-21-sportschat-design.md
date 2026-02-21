# SportsChat — Design Document

## One-Liner

A voice-first AI companion that watches sports with you, answering questions and providing commentary adapted to your expertise level — powered by Gemini's native video understanding.

---

## The Core Thesis

Sports broadcasts are one-size-fits-all. A lifelong fan and a first-time viewer hear the same commentary. SportsChat makes watching sports **conversational and personal** — you talk to an AI that has seen the same video you're watching, adapts to your knowledge level, and answers any question in real-time.

This is the future of human-computer interaction: ambient, voice-first AI that enhances a live experience without replacing it.

---

## How It Works

### Pipeline

**Before everything (app load):**
1. A ~2 min NBA highlight clip is loaded into the browser video player (frontend)
2. The same video file is uploaded to Gemini as context (backend) — Gemini natively ingests video, no frame extraction needed

**For every user request:**
1. User's voice input is transcribed to text (Web Speech API)
2. The text + current video timestamp + expertise level are sent to the backend
3. Backend calls Gemini with: the pre-loaded video context + engineered prompt + user question + timestamp
4. Gemini's response is displayed as an overlay box on the video
5. Response is also spoken aloud via TTS (on by default, with mute/unmute toggle)

```
┌──────────────────────────────────────────────────────┐
│                    BROWSER                            │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │                                                 │  │
│  │              NBA VIDEO PLAYER                   │  │
│  │                                                 │  │
│  │   ┌───────────────────────────────────┐         │  │
│  │   │ 🤖 "That was a pick and roll!     │         │  │
│  │   │ The big man sets a screen and     │         │  │
│  │   │ then 'rolls' toward the basket..."│         │  │
│  │   └───────────────────────────────────┘         │  │
│  │                                                 │  │
│  │  ▶ ━━━━━━━━━●━━━━━━━━━━━  1:12 / 2:00          │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
│  [🎤 Hold to ask]    [Beginner ▾]    [🔊 Mute]       │
│                                                       │
└───────────────────────┬───────────────────────────────┘
                        │
                  POST /api/ask
                { question, timestamp, expertise }
                        │
                        ▼
┌───────────────────────────────────────────────────────┐
│                    SERVER                              │
│                                                       │
│  ┌─────────────────────────────────────────────────┐  │
│  │              Gemini 2.0 Flash                   │  │
│  │                                                 │  │
│  │  Inputs:                                        │  │
│  │  - Pre-uploaded video file (full ~2 min clip)   │  │
│  │  - System prompt (expertise-adapted)            │  │
│  │  - User question + current timestamp            │  │
│  │                                                 │  │
│  │  Output:                                        │  │
│  │  - Contextual answer (2-4 sentences)            │  │
│  └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘
```

---

## Key Features

### 1. Expertise-Adaptive Responses

| Mode | Focus | Example Response |
|------|-------|-----------------|
| **Beginner** | Rules, terminology, celebrate moments | "That was a 3-pointer! The shot was taken from behind the arc — the curved line on the court — so it's worth 3 points instead of 2." |
| **Casual** | Player stories, rivalries, hype, fun stats | "Jokic with the no-look to Murray — that's the Nuggets' bread and butter. Best 2-man game in the league." |
| **Hardcore** | Advanced analytics, matchups, strategy | "They're switching to zone. Smart — clogging the paint forces outside shots when they're shooting cold from three." |

### 2. Voice-First Interaction
- Hold-to-talk voice input (Web Speech API)
- AI responses spoken aloud via TTS (SpeechSynthesis API)
- Mute/unmute toggle for TTS
- Text fallback for both input and output

### 3. Video-Native AI Context
- Gemini ingests the entire 2-min clip — it actually "sees" the game
- Responses reference specific visual moments, players, and plays
- Timestamp awareness: the AI knows where in the video the user currently is and won't spoil future events

---

## Tech Stack

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | API routes + React in one package |
| Styling | Tailwind CSS | Fast iteration, dark theme trivial |
| AI | Gemini 2.0 Flash | Native video input, fast, cheap, massive context window |
| Voice STT | Web Speech API | Free, zero deps, Chrome-native |
| Voice TTS | SpeechSynthesis API | Free, browser-native |
| Video | HTML5 `<video>` element | Standard, reliable, gives us `currentTime` |
| Deployment | Vercel | Free, instant |

---

## API Contract

The single interface between frontend and backend:

```typescript
// POST /api/ask

// Request
interface AskRequest {
  question: string;                                    // Transcribed user question
  timestamp: number;                                   // video.currentTime in seconds
  expertise: "beginner" | "casual" | "hardcore";       // Current selected level
}

// Response
interface AskResponse {
  answer: string;                                      // Gemini's response text
}
```

---

## Project Structure

```
sportschat/
├── app/
│   ├── layout.tsx              # Root layout, fonts, dark theme
│   ├── page.tsx                # Main page: video player + overlay + controls
│   ├── globals.css             # Tailwind + custom styles
│   └── api/
│       └── ask/
│           └── route.ts        # POST endpoint: question + timestamp → Gemini → answer
│
├── components/
│   ├── VideoPlayer.tsx         # HTML5 video player with overlay positioning
│   ├── AnswerOverlay.tsx       # Floating answer box on top of video
│   ├── VoiceInput.tsx          # Hold-to-talk mic button + Web Speech API STT
│   ├── ExpertiseToggle.tsx     # Beginner / Casual / Hardcore selector
│   └── MuteToggle.tsx          # TTS mute/unmute button
│
├── lib/
│   ├── gemini.ts               # Gemini API wrapper: upload video, send queries
│   ├── prompts.ts              # System prompts for 3 expertise levels
│   ├── speech.ts               # Web Speech API wrappers (STT + TTS)
│   └── types.ts                # Shared TypeScript types
│
├── public/
│   └── highlights/
│       └── game.mp4            # The ~2 min NBA highlight clip
│
├── .env.local                  # GEMINI_API_KEY
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Gemini Integration Detail

### Video Upload (one-time on server start / first request)

Using the Gemini Files API to upload the video once, then reference it in all subsequent calls:

```typescript
// lib/gemini.ts (pseudocode)

import { GoogleGenerativeAI } from "@google/generative-ai";

let uploadedFile: File | null = null;

async function ensureVideoUploaded(): Promise<File> {
  if (uploadedFile) return uploadedFile;

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const fileManager = genAI.getFileManager();

  uploadedFile = await fileManager.uploadFile("public/highlights/game.mp4", {
    mimeType: "video/mp4",
  });

  // Wait for processing
  while (uploadedFile.state === "PROCESSING") {
    await new Promise(r => setTimeout(r, 2000));
    uploadedFile = await fileManager.getFile(uploadedFile.name);
  }

  return uploadedFile;
}

async function askAboutGame(
  question: string,
  timestamp: number,
  expertise: ExpertiseLevel
): Promise<string> {
  const file = await ensureVideoUploaded();
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
  const systemPrompt = buildPrompt(expertise, timestamp);

  const result = await model.generateContent([
    { fileData: { fileUri: file.uri, mimeType: "video/mp4" } },
    { text: systemPrompt + "\n\nUser question: " + question },
  ]);

  return result.response.text();
}
```

### System Prompt Structure

```
You are SportsChat, a friendly AI sports companion watching an NBA game
with the user. You can see the entire video.

EXPERTISE LEVEL: {beginner|casual|hardcore}

{level-specific instructions — see Key Features section above}

The user is currently at timestamp {timestamp} in the video.
CRITICAL: Only reference events that have happened UP TO this timestamp.
Do not spoil future events.

RULES:
- Keep responses to 2-4 sentences
- Be conversational and energetic
- Reference specific plays, players, and moments you can see in the video
- Match your energy to the moment
- If the user asks about something not visible in the video, say so honestly
```

---

## 3-Person Task Split

### Person A — Backend (Gemini + API)
- Set up Gemini API integration with video upload
- Build `/api/ask` endpoint
- Write and test system prompts for all 3 expertise levels
- Test with varied questions at different timestamps

### Person B — Frontend (Video + Overlay UI)
- HTML5 video player with the highlight clip
- Answer overlay box (positioned on video, backdrop blur, fade animation)
- Bottom control bar: mic button, expertise toggle, mute button
- Wire up to API (can mock responses initially)
- Dark theme, sports broadcast aesthetic

### Person C — Voice + Integration
- Web Speech API: hold-to-talk STT module
- SpeechSynthesis TTS module with mute/unmute
- Integration glue: connect voice output → API call → overlay display → TTS
- End-to-end testing of the full pipeline

---

## Build Timeline (3.5 hours)

### Hour 0:00–0:30 — Setup (all together)
- Scaffold Next.js + Tailwind project
- Find and download a good ~2 min NBA highlight clip
- Agree on API contract (above)
- Set up Gemini API key
- Each person starts their task

### Hour 0:30–2:00 — Parallel Build

| Person A (Backend) | Person B (Frontend) | Person C (Voice + Glue) |
|---|---|---|
| Upload video to Gemini Files API | Build video player component | Build STT module (Web Speech API) |
| Build `/api/ask` endpoint | Build answer overlay with animation | Build TTS module with mute toggle |
| Write 3 expertise-level prompts | Build expertise toggle + mute button | Test voice pipeline in isolation |
| Test: curl the endpoint with questions | Build with mock API responses | Write integration code |

### Hour 2:00–2:45 — Integration
- Connect frontend → real API
- Plug in voice modules
- End-to-end test: speak → overlay appears → answer is spoken
- Test all 3 expertise levels

### Hour 2:45–3:15 — Polish
- Smooth animations on overlay (fade in/out)
- Dark theme polish
- Pick best demo questions for each expertise level
- Rehearse demo flow

### Hour 3:15–3:30 — Record demo video

---

## Demo Script (~2 minutes)

### Opening (15 seconds)
*"Every sports broadcast assumes you already know everything — or nothing. What if your companion adapted to YOU?"*

Show the app: video playing, clean dark UI.

### Beat 1: Beginner Mode (30 seconds)
- Expertise set to Beginner
- Pause at a play, ask via voice: *"What just happened?"*
- AI explains in simple terms with an overlay on the video
- Ask: *"What's a pick and roll?"*
- AI explains simply, referencing what's visible on screen

### Beat 2: Switch to Hardcore (30 seconds)
- Toggle to Hardcore mid-video
- Ask the same kind of question — completely different response style
- AI gives strategic/analytical breakdown
- Show the contrast: same video, same question, different expertise = different answer

### Beat 3: Natural Conversation (20 seconds)
- Ask something fun: *"Who's the best player on the court right now?"*
- AI responds with personality and context from the video
- TTS speaks the answer — feels like talking to a friend

### Close (15 seconds)
*"One game. Three completely different experiences. The future of watching sports isn't a better broadcast — it's a personal companion that knows you."*

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gemini video upload fails or is slow | Can't answer questions | Upload on server start, cache the file reference. Have a pre-uploaded backup file ID. |
| Gemini latency (2-4s) | Overlay feels laggy | Show "thinking..." animation. Responses are short (2-4 sentences). |
| Web Speech API browser compat | Voice doesn't work | Text input is always available. Only demo in Chrome. |
| TTS sounds robotic | Hurts demo impression | Acceptable for hackathon. Upgrade to ElevenLabs/OpenAI TTS if time. |
| Gemini spoils future events | Breaks immersion | System prompt explicitly says "only reference events UP TO timestamp." |
| Gemini hallucinates plays/players | Wrong information | Prompt says "if you can't see it clearly, say so honestly." |

---

## What We're NOT Building

- Proactive/automatic commentary (reactive only — user asks, AI answers)
- Multi-sport support
- User accounts or persistence
- Live game connection
- Mobile app
- Betting or fantasy integration
- Play-by-play feed or scoreboard (the video IS the experience)
- Game simulator

---

## Success Criteria

**The demo succeeds if:**
1. Switching expertise levels produces **visibly different** responses
2. The AI references **specific things visible in the video** (not generic sports talk)
3. Voice interaction works smoothly during the demo
4. A non-sports-fan watching feels like they'd actually use Beginner mode
5. The "future of HCI" pitch lands — ambient, contextual, voice-first AI

**The demo fails if:**
1. Responses are generic and could apply to any game
2. Voice breaks with no text fallback working
3. Latency makes it feel broken (>5 seconds with no feedback)
4. The overlay looks like a chatbot, not a companion
