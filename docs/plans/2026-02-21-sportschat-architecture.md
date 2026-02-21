# SportsChat — Architecture & Implementation Spec

## Project Structure

```
sportschat/
├── app/
│   ├── layout.tsx              # Root layout, fonts, dark theme
│   ├── page.tsx                # Main page: video + overlay + controls
│   ├── globals.css             # Tailwind + custom styles
│   └── api/
│       └── ask/
│           └── route.ts        # POST: question + timestamp + expertise → Gemini → answer
│
├── components/
│   ├── VideoPlayer.tsx         # HTML5 video with ref for currentTime
│   ├── AnswerOverlay.tsx       # Floating answer box over the video
│   ├── VoiceInput.tsx          # Hold-to-talk mic button + STT
│   ├── ExpertiseToggle.tsx     # Beginner / Casual / Hardcore segmented control
│   └── MuteToggle.tsx          # TTS on/off toggle
│
├── lib/
│   ├── gemini.ts               # Gemini API: video upload + query
│   ├── prompts.ts              # System prompts for 3 expertise levels
│   ├── speech.ts               # Web Speech API wrappers (STT + TTS)
│   └── types.ts                # Shared TypeScript types
│
├── public/
│   └── highlights/
│       └── game.mp4            # ~2 min NBA highlight clip
│
├── .env.local                  # GEMINI_API_KEY
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## API Contract

```typescript
// POST /api/ask

// Request
interface AskRequest {
  question: string;
  timestamp: number;       // video.currentTime (seconds)
  expertise: "beginner" | "casual" | "hardcore";
}

// Response
interface AskResponse {
  answer: string;
}
```

---

## Component Specs

### 1. VideoPlayer.tsx

**Purpose:** Play the highlight clip and expose `currentTime` for timestamp context.

```typescript
interface VideoPlayerProps {
  src: string;                           // Path to video file
  videoRef: React.RefObject<HTMLVideoElement>;  // Ref to read currentTime
}
```

- Standard HTML5 `<video>` with native controls (play/pause/seek)
- `videoRef` exposed to parent so other components can read `currentTime`
- Positioned as the main visual element, full-width
- The overlay sits absolutely positioned on top of this

### 2. AnswerOverlay.tsx

**Purpose:** Display AI responses as a floating box over the video.

```typescript
interface AnswerOverlayProps {
  answer: string | null;       // null = hidden
  isLoading: boolean;          // show "thinking..." state
}
```

- Positioned bottom-left or bottom-right of the video container
- Semi-transparent dark background with backdrop blur
- Rounded corners, subtle shadow
- Fade in when new answer arrives, fade out after ~10 seconds or on dismiss
- Loading state: pulsing dots or "Thinking..." text
- Max width ~60% of video to not obscure too much

**Visual spec:**
```
┌───────────────────────────────────┐
│ 🤖                                │
│ "That was a 3-pointer! The shot   │
│ was taken from behind the arc —   │
│ worth 3 points instead of 2."    │
└───────────────────────────────────┘
```

- Background: `bg-black/70 backdrop-blur-md`
- Text: `text-white text-sm`
- Border: `border border-white/10 rounded-xl`
- Padding: `p-4`

### 3. VoiceInput.tsx

**Purpose:** Hold-to-talk button that captures speech and returns text.

```typescript
interface VoiceInputProps {
  onTranscript: (text: string) => void;
  disabled: boolean;
}
```

- Large circular mic button
- States: idle (gray), listening (red + pulsing), processing (yellow)
- Hold to talk: `onMouseDown` / `onTouchStart` → start recognition, `onMouseUp` / `onTouchEnd` → stop
- Uses `webkitSpeechRecognition` with `continuous: false`, `interimResults: false`
- On final result → call `onTranscript(text)`

### 4. ExpertiseToggle.tsx

**Purpose:** Switch between Beginner / Casual / Hardcore modes.

```typescript
interface ExpertiseToggleProps {
  level: ExpertiseLevel;
  onChange: (level: ExpertiseLevel) => void;
}

type ExpertiseLevel = "beginner" | "casual" | "hardcore";
```

- Three-segment toggle/pill button
- Labels: "Beginner", "Casual", "Hardcore"
- Active segment highlighted with accent color
- Positioned in the control bar below the video

### 5. MuteToggle.tsx

**Purpose:** Toggle TTS audio on/off.

```typescript
interface MuteToggleProps {
  isMuted: boolean;
  onToggle: () => void;
}
```

- Simple speaker icon button
- Speaker with sound waves when unmuted, crossed out when muted
- Positioned in the control bar

---

## Backend: Gemini Integration (`lib/gemini.ts`)

### Video Upload Strategy

Upload the video file to Gemini's Files API once on first request. Cache the file reference for all subsequent requests.

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let cachedFile: { uri: string; mimeType: string } | null = null;

export async function ensureVideoUploaded(): Promise<{ uri: string; mimeType: string }> {
  if (cachedFile) return cachedFile;

  const uploadResult = await ai.files.upload({
    file: "public/highlights/game.mp4",
    config: { mimeType: "video/mp4" },
  });

  // Wait for processing to complete
  let file = uploadResult;
  while (file.state === "PROCESSING") {
    await new Promise((r) => setTimeout(r, 2000));
    file = await ai.files.get({ name: file.name });
  }

  cachedFile = { uri: file.uri, mimeType: "video/mp4" };
  return cachedFile;
}

export async function askAboutGame(
  question: string,
  timestamp: number,
  expertise: ExpertiseLevel
): Promise<string> {
  const videoFile = await ensureVideoUploaded();
  const systemPrompt = buildPrompt(expertise, timestamp);

  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: [
      {
        role: "user",
        parts: [
          { fileData: videoFile },
          { text: systemPrompt + "\n\nUser question: " + question },
        ],
      },
    ],
  });

  return response.text;
}
```

### Prompt Builder (`lib/prompts.ts`)

```typescript
export function buildPrompt(expertise: ExpertiseLevel, timestamp: number): string {
  const base = `You are SportsChat, a friendly AI sports companion watching an NBA game with the user. You can see the entire video.

The user is currently at timestamp ${formatTime(timestamp)} (${Math.round(timestamp)} seconds) in the video.

CRITICAL RULES:
- Only reference events that have happened UP TO this timestamp. Do NOT spoil future events.
- Keep responses to 2-4 sentences. Be conversational.
- Reference specific plays, players, and moments visible in the video.
- If you can't clearly see what the user is asking about, say so honestly.
- Match your energy to the moment (exciting play = excited tone).`;

  const levelInstructions = {
    beginner: `
EXPERTISE LEVEL: Beginner
- Explain basketball terms when you use them (e.g., "a turnover means the team lost the ball")
- Celebrate big moments simply and enthusiastically
- Never assume knowledge of rules — explain why things matter
- Use analogies to make concepts relatable
- If they ask "what happened?", describe the play as if to someone who has never watched basketball`,

    casual: `
EXPERTISE LEVEL: Casual Fan
- Share player backstories and rivalries when relevant
- Reference broader NBA context (standings, season narratives)
- Use natural, excited sports fan language
- Point out momentum shifts and game flow
- Assume basic rule knowledge but explain unusual calls`,

    hardcore: `
EXPERTISE LEVEL: Hardcore
- Reference advanced concepts: spacing, pick-and-roll coverage, transition defense
- Analyze matchup advantages and defensive schemes
- Discuss coaching decisions and strategic adjustments
- Use basketball terminology freely without explanation
- Focus on the "why" behind plays, not just the "what"`,
  };

  return base + levelInstructions[expertise];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}
```

---

## Backend: API Route (`app/api/ask/route.ts`)

```typescript
import { NextRequest, NextResponse } from "next/server";
import { askAboutGame } from "@/lib/gemini";
import { AskRequest, AskResponse } from "@/lib/types";

export async function POST(req: NextRequest) {
  const body: AskRequest = await req.json();
  const { question, timestamp, expertise } = body;

  if (!question || timestamp === undefined || !expertise) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const answer = await askAboutGame(question, timestamp, expertise);
  return NextResponse.json({ answer } satisfies AskResponse);
}
```

---

## Frontend: Speech Module (`lib/speech.ts`)

```typescript
// --- Speech-to-Text ---

let recognition: SpeechRecognition | null = null;

export function startListening(
  onResult: (text: string) => void,
  onError: (err: string) => void
): void {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    onError("Speech recognition not supported");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = "en-US";

  recognition.onresult = (event) => {
    const text = event.results[0][0].transcript;
    onResult(text);
  };

  recognition.onerror = (event) => onError(event.error);
  recognition.start();
}

export function stopListening(): void {
  recognition?.stop();
}

// --- Text-to-Speech ---

export function speak(text: string): void {
  window.speechSynthesis.cancel(); // Stop any current speech
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;

  // Prefer a natural-sounding voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.name.includes("Google US English") || v.name.includes("Samantha")
  );
  if (preferred) utterance.voice = preferred;

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  window.speechSynthesis.cancel();
}
```

---

## Frontend: Main Page State (`app/page.tsx`)

```typescript
interface PageState {
  // UI state
  expertise: ExpertiseLevel;
  isMuted: boolean;

  // Answer state
  currentAnswer: string | null;
  isLoading: boolean;

  // Voice state
  isListening: boolean;
}
```

**Flow:**
1. User holds mic button → `isListening = true`, start STT
2. User releases → `isListening = false`, stop STT, get transcript
3. Read `videoRef.current.currentTime` for timestamp
4. `isLoading = true`, POST to `/api/ask`
5. Response arrives → `currentAnswer = answer`, `isLoading = false`
6. If `!isMuted` → speak the answer via TTS
7. Overlay displays answer, auto-hides after ~10 seconds

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Gemini API fails | Show "Couldn't get an answer. Try again!" in overlay |
| Web Speech API not supported | Hide mic button, show text input fallback |
| TTS fails | Silently fall back to text-only overlay |
| Video fails to load | Show error message with "check video file" hint |
| Gemini video upload still processing | Show "Loading game context..." on first request, retry |

---

## Performance Targets

| Operation | Target |
|-----------|--------|
| Gemini query (with cached video) | < 3 seconds |
| STT transcription | < 1 second |
| TTS start speaking | < 200ms |
| Overlay animation | 300ms fade in/out |

---

## What We're NOT Building

- Proactive/automatic commentary (user-initiated only)
- Play-by-play feed or scoreboard
- Game simulator
- Multi-sport support
- User accounts
- Live game connection
- Mobile app
- Betting/fantasy features
