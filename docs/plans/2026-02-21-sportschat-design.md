# SportsChat — Design Document

## One-Liner

A voice-first AI companion that follows NBA games in real-time, providing personalized commentary and answering questions at your expertise level — beginner, casual, or hardcore.

---

## The Core Thesis

Sports broadcasts are one-size-fits-all. A lifelong fan and a first-time viewer hear the same commentary. SportsChat makes watching sports **conversational and personal** — you talk to an AI that knows the game state, adapts to your knowledge level, and answers any question in real-time.

This is the future of human-computer interaction: ambient, voice-first AI that enhances a live experience without replacing it.

---

## Key Features

### 1. Expertise-Adaptive Commentary
Three modes with fundamentally different system prompts:

| Mode | Focus | Example |
|------|-------|---------|
| **Beginner** | Rules, terminology, celebrating moments | "That was a 3-pointer! The shot was taken from behind the arc — the curved line — so it's worth 3 points instead of 2." |
| **Casual** | Player stories, rivalries, hype, fun stats | "Jokic with the no-look to Murray — that's the Nuggets' bread and butter. Best 2-man game in the league." |
| **Hardcore** | Advanced analytics, matchups, strategy | "They're switching to zone. Smart — Boston's at 28% from three tonight, so clogging the paint forces cold outside shots." |

### 2. Proactive + Reactive AI
- **Proactive**: AI automatically comments on notable plays as they happen (scores, blocks, steals, timeouts, momentum shifts)
- **Reactive**: User asks questions anytime ("Why was that a foul?", "How is LeBron doing tonight?", "What's a pick-and-roll?")

### 3. Voice-First Interaction
- Hold-to-talk voice input via Web Speech API
- AI responses spoken aloud via TTS
- Text input/output as fallback and visual record

### 4. Live Game Dashboard
- Real-time scoreboard with quarter and game clock
- Scrolling play-by-play feed
- Key player stat lines

---

## Data Strategy

### Replay Approach (Primary)

Pre-download play-by-play data from real NBA games using the free `nba_api` Python package (NBA.com data). Replay at accelerated speed during the demo.

**Advantages:**
- Completely free (no API costs)
- Deterministic — we know exactly what plays happen
- Can pick the most exciting games (buzzer beaters, comebacks)
- Can control pacing for the demo
- No dependency on a game happening during judging

**Pre-selected games:** Download 2-3 exciting recent games. Pick ones with:
- Close scores / lead changes
- Star players with big stat lines
- Dramatic late-game moments

### Data Format

Each game exported as a JSON file containing:
```json
{
  "game_info": {
    "game_id": "0022400123",
    "date": "2026-02-15",
    "home_team": { "id": 1, "name": "Lakers", "abbreviation": "LAL" },
    "away_team": { "id": 2, "name": "Celtics", "abbreviation": "BOS" }
  },
  "play_by_play": [
    {
      "period": 1,
      "clock": "11:42",
      "event_type": "FIELD_GOAL_MADE",
      "description": "Tatum 26' 3PT Jump Shot (3 PTS)",
      "team": "BOS",
      "player": "Jayson Tatum",
      "score_home": 0,
      "score_away": 3,
      "elapsed_seconds": 18
    }
  ],
  "box_score": {
    "home_players": [...],
    "away_players": [...]
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     BROWSER (React)                      │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ Game Dashboard│  │ AI Commentary│  │ Voice Control  │  │
│  │ - Scoreboard  │  │ - Live feed  │  │ - Mic button   │  │
│  │ - Play feed   │  │ - Highlights │  │ - TTS output   │  │
│  │ - Player stats│  │ - Explanations│ │ - Level toggle │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                  │                  │           │
│         └──────────────────┼──────────────────┘           │
│                            │                              │
│                    ┌───────▼────────┐                     │
│                    │ Game Simulator  │                     │
│                    │ (replays PBP)   │                     │
│                    └───────┬────────┘                     │
├────────────────────────────┼─────────────────────────────┤
│                     SERVER (API Routes)                   │
│                            │                              │
│              ┌─────────────▼──────────────┐              │
│              │      Claude API Call        │              │
│              │  System prompt includes:    │              │
│              │  - Expertise level          │              │
│              │  - Recent play-by-play      │              │
│              │  - Game context/score       │              │
│              │  - User's question (if any) │              │
│              └────────────────────────────┘              │
│                                                          │
│              ┌────────────────────────────┐              │
│              │   Pre-loaded Game Data     │              │
│              │   (JSON from nba_api)      │              │
│              └────────────────────────────┘              │
└──────────────────────────────────────────────────────────┘
```

### Key Simplification

**No multi-agent pipeline.** One Claude API call with a well-crafted system prompt that adapts based on expertise level. For a hackathon, one smart prompt beats four mediocre agents.

### Game Simulator

A client-side timer that reads pre-loaded play-by-play JSON and emits events at configurable speed:
- Normal speed: events at real-time intervals
- Demo speed: events every 2-3 seconds (compresses a full game into ~5 minutes)
- Can pause/resume/skip to exciting moments

### AI Interaction Model

**Two triggers for Claude calls:**

1. **Proactive commentary** — Every 3-5 play events, batch them and send to Claude with the system prompt for the current expertise level. Get back a 1-2 sentence commentary. This runs automatically.

2. **Reactive Q&A** — User asks a question via voice or text. Send the question + full game context (score, last 20 plays, player stats, expertise level) to Claude. Get back a focused answer.

Both return text that is:
- Displayed in the commentary panel
- Spoken aloud via TTS (if voice is enabled)

### Claude System Prompt Structure

```
You are SportsChat, an AI sports commentator for NBA games.

EXPERTISE LEVEL: {beginner|casual|hardcore}

{level-specific instructions}

CURRENT GAME STATE:
- {home_team} {home_score} vs {away_team} {away_score}
- Period: {period}, Clock: {clock}
- Key stats: {top player lines}

RECENT PLAYS:
{last 15-20 play descriptions}

RULES:
- Keep responses to 1-3 sentences for proactive commentary
- For questions, answer in 2-5 sentences max
- Always reference specific plays/players from the current game
- Match your energy to the moment (exciting play = excited tone)
- {level-specific rules}
```

---

## UI Design

```
┌────────────────────────────────────────────────────────┐
│  🏀 SportsChat          [Beginner ▾]     ◉ Following   │
├──────────────────────────────┬─────────────────────────┤
│                              │                         │
│   LAKERS  87                 │   🤖 AI Commentary      │
│   CELTICS 91                 │                         │
│   Q4 · 3:42                  │   "Tatum just hit a     │
│                              │   step-back three! For   │
│   ─────────────────────      │   beginners: a step-back│
│                              │   is when..."            │
│   PLAY-BY-PLAY               │                         │
│   ▸ Tatum 3PT (28pts)       │   ─────────────────     │
│   ▸ James drives, layup     │                         │
│   ▸ Timeout - LAL           │   💬 Ask me anything:   │
│   ▸ Brown steal, fast break │   ┌───────────────────┐ │
│   ▸ Davis block              │   │                   │ │
│                              │   └───────────────────┘ │
│   PLAYER STATS               │   🎤 [Hold to talk]     │
│   Tatum: 28p 7r 5a          │                         │
│   James: 31p 8r 10a         │                         │
│   Davis: 22p 12r 4b         │                         │
│                              │                         │
├──────────────────────────────┴─────────────────────────┤
│  🎤  Ask something or hold to talk...            ➤    │
└────────────────────────────────────────────────────────┘
```

### Visual Design
- Dark theme (sports broadcast aesthetic)
- Team colors for score area
- Smooth scroll on play-by-play feed
- Commentary feed with subtle fade-in animations
- Pulsing mic indicator when listening
- Expertise level as a dropdown/toggle in the header

---

## Tech Stack

| Layer | Choice | Reasoning |
|-------|--------|-----------|
| Framework | Next.js 14 (App Router) | API routes + React, single package |
| Styling | Tailwind CSS | Fast iteration, dark theme trivial |
| AI | Claude Sonnet 4.6 via Anthropic SDK | Best reasoning for nuanced commentary |
| Voice STT | Web Speech API | Free, zero deps, Chrome-native |
| Voice TTS | Web Speech API / SpeechSynthesis | Free fallback; upgrade to OpenAI TTS if time |
| NBA Data | `nba_api` (Python) → pre-export JSON | Free, complete historical PBP |
| Data Prep | Python script (run once before hackathon) | Download + format game data |
| Deployment | Vercel | Free, instant, reliable |

---

## Project Structure

```
sportschat/
├── app/
│   ├── layout.tsx                # Root layout, fonts, dark theme
│   ├── page.tsx                  # Main app page
│   ├── globals.css               # Tailwind + custom styles
│   └── api/
│       └── commentary/
│           └── route.ts          # POST: sends game context to Claude, returns commentary
│
├── components/
│   ├── Scoreboard.tsx            # Score, quarter, clock display
│   ├── PlayByPlay.tsx            # Scrolling play feed
│   ├── PlayerStats.tsx           # Key player stat lines
│   ├── CommentaryFeed.tsx        # AI commentary messages
│   ├── VoiceInput.tsx            # Mic button + Web Speech API
│   ├── TextInput.tsx             # Text input fallback
│   └── ExpertiseToggle.tsx       # Beginner/Casual/Hardcore selector
│
├── lib/
│   ├── game-simulator.ts         # Reads JSON PBP, emits events on timer
│   ├── claude.ts                 # Claude API wrapper + prompt builder
│   ├── prompts/
│   │   ├── beginner.ts           # Beginner system prompt
│   │   ├── casual.ts             # Casual fan system prompt
│   │   └── hardcore.ts           # Hardcore system prompt
│   ├── speech.ts                 # Web Speech API wrapper (STT + TTS)
│   └── types.ts                  # Shared TypeScript types
│
├── data/
│   ├── games/                    # Pre-downloaded game JSON files
│   │   ├── lakers-celtics-2026-02-15.json
│   │   └── nuggets-warriors-2026-02-10.json
│   └── scripts/
│       └── download_games.py     # Python script to fetch game data via nba_api
│
├── .env.local                    # ANTHROPIC_API_KEY
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Build Timeline (3.5 hours)

| Time | Task | Exit Criteria |
|------|------|---------------|
| 0:00–0:20 | **Data prep**: Run Python script to download 2 games via nba_api → JSON | Two JSON files with PBP + box scores in `data/games/` |
| 0:20–0:50 | **Scaffold + Simulator**: Next.js app, game simulator that reads JSON and emits timed events | Events logging to console at demo speed |
| 0:50–1:20 | **Left panel UI**: Scoreboard, play-by-play feed, player stats — all updating from simulator | Game visually replaying on screen |
| 1:20–2:00 | **Claude integration**: System prompt with 3 expertise modes, proactive commentary every N plays, Q&A endpoint | AI commenting on plays in console |
| 2:00–2:20 | **Right panel UI**: Commentary feed, text input, expertise toggle | Full UI working end-to-end |
| 2:20–2:50 | **Voice**: Web Speech API for STT + TTS, hold-to-talk button | Can talk to it and hear responses |
| 2:50–3:15 | **Polish**: Dark theme, animations, loading states, pick best demo game segment | Looks clean and demo-ready |
| 3:15–3:30 | **Demo**: Record demo video | Done |

---

## Demo Script (2-3 minute video)

### Opening (20 seconds)
"Every sports broadcast assumes you already know everything — or nothing. What if your commentary adapted to YOU?"

### Beat 1: Beginner Mode (40 seconds)
- Start game replay (Lakers vs Celtics)
- Set to Beginner mode
- AI explains: "That was a 3-pointer! The shot was taken from behind the curved line on the court, so it's worth 3 points instead of 2."
- Ask via voice: "What's a pick and roll?"
- AI explains in simple terms with reference to what just happened in the game

### Beat 2: Switch to Hardcore (40 seconds)
- Toggle to Hardcore mode mid-game
- Same game, completely different commentary: "Tatum's true shooting percentage is at 64% tonight — well above his season average of 58%. He's getting clean looks off the high screen."
- Ask: "Should they switch to zone?"
- AI gives strategic analysis grounded in tonight's stats

### Beat 3: The Wow Moment (30 seconds)
- Skip to an exciting play (dunk, buzzer beater, or big block)
- AI reacts with energy matching the moment
- Show the voice interaction — user reacts "WHAT WAS THAT" and AI responds contextually

### Close (20 seconds)
"This is SportsChat. One game. Three completely different experiences. The future of watching sports isn't a better broadcast — it's a personal companion that knows you."

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude latency (2-3s per call) | Commentary feels laggy | Proactive calls run on batched plays (not every play). Skeleton loading. Pre-cache key moments. |
| nba_api data format changes | Can't download game data | Download data BEFORE hackathon. Have backup JSON files ready. |
| Web Speech API browser support | Voice doesn't work | Text input is always available as fallback. Test in Chrome only. |
| TTS sounds robotic | Bad demo impression | Use OpenAI TTS as upgrade if time allows. Or accept browser TTS — judges understand it's a hackathon. |
| Commentary quality varies | AI says something wrong/boring | Tune system prompts carefully. Include "be concise, be energetic" rules. Test with multiple game scenarios. |

---

## What We're NOT Building

- Multi-sport support (NBA only)
- User accounts or persistence
- Real live game connection (replay only)
- Mobile app (responsive web only)
- Betting integration
- Social features (watch with friends)
- Player comparison tools
- Historical game lookup

---

## Success Criteria

The demo succeeds if:
1. Switching expertise levels produces **visibly different** commentary
2. The AI references **specific plays and players** from the game (not generic sports talk)
3. Voice interaction works smoothly at least once during the demo
4. A non-sports-fan watching feels like they'd actually use Beginner mode
5. The "future of HCI" pitch lands — this is about ambient, contextual, voice-first AI

The demo fails if:
1. Commentary is generic and could apply to any game
2. Voice input/output breaks during the demo with no recovery
3. The UI looks like a chatbot rather than a sports companion
4. Latency makes it feel broken (>5 second waits with no feedback)
