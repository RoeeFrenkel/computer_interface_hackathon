# SportsChat — Architecture & Implementation Spec

## Project Structure

```
sportschat/
├── app/
│   ├── layout.tsx                # Root layout, fonts, dark theme
│   ├── page.tsx                  # Main app page — game + commentary panels
│   ├── globals.css               # Tailwind + custom dark theme styles
│   └── api/
│       └── commentary/
│           └── route.ts          # POST: game context → Claude → commentary
│
├── components/
│   ├── Scoreboard.tsx            # Team names, scores, quarter, clock
│   ├── PlayByPlay.tsx            # Scrolling list of recent plays
│   ├── PlayerStats.tsx           # Top player stat lines (pts/reb/ast)
│   ├── CommentaryFeed.tsx        # AI commentary messages with timestamps
│   ├── VoiceInput.tsx            # Hold-to-talk mic button + STT
│   ├── TextInput.tsx             # Text input bar at bottom
│   └── ExpertiseToggle.tsx       # Beginner / Casual / Hardcore selector
│
├── lib/
│   ├── game-simulator.ts         # Core: reads PBP JSON, emits events on timer
│   ├── claude.ts                 # API wrapper: builds prompt, calls Claude
│   ├── prompts.ts                # System prompts for all 3 expertise levels
│   ├── speech.ts                 # Web Speech API wrappers (STT + TTS)
│   └── types.ts                  # All shared TypeScript types
│
├── data/
│   ├── games/                    # Pre-downloaded game JSON files
│   │   └── [game-name].json      # PBP + box score data
│   └── scripts/
│       └── download_games.py     # One-time Python script to fetch via nba_api
│
├── .env.local                    # ANTHROPIC_API_KEY
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## Detailed Component Specs

### 1. Game Simulator (`lib/game-simulator.ts`)

The heart of the app. A class that replays pre-loaded play-by-play data.

```typescript
interface GameSimulator {
  // State
  currentPlayIndex: number;
  isPlaying: boolean;
  speed: number; // 1 = real-time, 10 = 10x speed
  gameData: GameData;

  // Methods
  start(): void;
  pause(): void;
  resume(): void;
  setSpeed(speed: number): void;
  skipTo(playIndex: number): void;

  // Events (callback-based or EventEmitter)
  onPlay(callback: (play: PlayEvent) => void): void;
  onScoreChange(callback: (score: Score) => void): void;
  onPeriodChange(callback: (period: number) => void): void;
}
```

**How it works:**
- Loads a game JSON file
- Uses `setInterval` to advance through plays
- Interval timing = `(play.elapsed_seconds - prevPlay.elapsed_seconds) / speed * 1000`
- At demo speed (10x), a 2.5-hour game replays in ~15 minutes
- Emits events that the UI components subscribe to

### 2. API Route (`app/api/commentary/route.ts`)

Single POST endpoint that handles both proactive and reactive commentary.

```typescript
// Request body
interface CommentaryRequest {
  type: "proactive" | "reactive";
  expertise: "beginner" | "casual" | "hardcore";
  game_state: {
    home_team: string;
    away_team: string;
    home_score: number;
    away_score: number;
    period: number;
    clock: string;
  };
  recent_plays: PlayEvent[];    // Last 15-20 plays for context
  player_stats: PlayerStat[];   // Current box score leaders
  new_plays?: PlayEvent[];      // Only for proactive: the plays to comment on
  question?: string;            // Only for reactive: user's question
}

// Response body
interface CommentaryResponse {
  commentary: string;           // The AI's response text
  highlight?: boolean;          // Whether this is a "big moment" worth extra emphasis
}
```

**Implementation:**
- Build system prompt from expertise level (import from `prompts.ts`)
- Inject game state, recent plays, and player stats into the prompt
- For proactive: ask Claude to comment on the new plays
- For reactive: ask Claude to answer the user's question
- Return JSON response (no streaming needed — responses are short)

### 3. System Prompts (`lib/prompts.ts`)

Three exported functions that return system prompts. Each shares a base structure but with level-specific instructions.

```typescript
function buildSystemPrompt(
  expertise: ExpertiseLevel,
  gameState: GameState,
  recentPlays: PlayEvent[],
  playerStats: PlayerStat[]
): string
```

**Beginner prompt additions:**
- "Explain basketball terms when you use them (e.g., 'a turnover means the team lost the ball')"
- "Celebrate big moments simply and enthusiastically"
- "Never assume knowledge of rules — explain why things matter"
- "Use analogies to make concepts relatable"

**Casual prompt additions:**
- "Share player backstories and rivalries when relevant"
- "Reference season stats and standings for context"
- "Use natural, excited sports fan language"
- "Point out momentum shifts and game narratives"

**Hardcore prompt additions:**
- "Reference advanced stats: PER, TS%, usage rate, pace, net rating"
- "Analyze matchup advantages and defensive schemes"
- "Discuss coaching decisions and strategic adjustments"
- "Compare tonight's performance to season averages"

### 4. Speech Module (`lib/speech.ts`)

Thin wrappers around Web Speech API.

```typescript
// Speech-to-Text
function startListening(onResult: (text: string) => void, onError: (err: Error) => void): void;
function stopListening(): void;

// Text-to-Speech
function speak(text: string, options?: { rate?: number; pitch?: number }): Promise<void>;
function stopSpeaking(): void;
function isSpeaking(): boolean;
```

**STT notes:**
- Uses `webkitSpeechRecognition` (Chrome)
- `continuous: false`, `interimResults: false` (wait for final result)
- Triggered by hold-to-talk button (mousedown → start, mouseup → stop)

**TTS notes:**
- Uses `window.speechSynthesis`
- Select a natural-sounding voice if available (prefer "Google US English" or similar)
- Rate: 1.1 (slightly faster than default for natural commentary feel)
- Queue management: if new commentary arrives while speaking, finish current sentence then switch

### 5. UI Components

#### Scoreboard.tsx
```
Props: { homeTeam, awayTeam, homeScore, awayScore, period, clock }
```
- Large, centered score display
- Team abbreviations with team-color accents
- Quarter and clock underneath
- Updates reactively from game simulator

#### PlayByPlay.tsx
```
Props: { plays: PlayEvent[], maxVisible: number }
```
- Reverse-chronological list (newest at top)
- Auto-scrolls as new plays arrive
- Color-coded by team
- Play type icons (🏀 score, 🛑 turnover, ✋ foul, ⏸ timeout)
- Max ~10 visible, older plays scroll off

#### PlayerStats.tsx
```
Props: { players: PlayerStat[], homeTeam, awayTeam }
```
- Shows top 3 players per team by points
- Format: "Name: Xp Yr Za" (points, rebounds, assists)
- Updates as plays update the running stats

#### CommentaryFeed.tsx
```
Props: { messages: CommentaryMessage[] }
```
- Chat-like feed of AI commentary
- Proactive commentary in a different style than Q&A responses
- Subtle animation on new messages (fade-in)
- Auto-scroll to bottom
- Highlight markers for big moments

#### VoiceInput.tsx
```
Props: { onTranscript: (text: string) => void, disabled: boolean }
```
- Large circular mic button
- Hold to talk (mousedown/touchstart → listen, mouseup/touchend → stop)
- Visual states: idle, listening (pulsing), processing
- Returns transcribed text to parent

#### ExpertiseToggle.tsx
```
Props: { level: ExpertiseLevel, onChange: (level: ExpertiseLevel) => void }
```
- Three-option segmented control
- Labels: "Beginner 🌱", "Casual 🏀", "Hardcore 📊"
- Positioned in header bar

---

## Data Pipeline

### Python Download Script (`data/scripts/download_games.py`)

```python
# Uses nba_api to fetch:
# 1. Game finder: search for recent exciting games
# 2. Play-by-play: full event log for a game
# 3. Box score: player stats for the game
# 4. Export as JSON in our format

# Dependencies: nba_api, json
# Run: python data/scripts/download_games.py
# Output: data/games/{game-name}.json
```

**Key nba_api endpoints used:**
- `nba_api.stats.endpoints.LeagueGameFinder` — find games
- `nba_api.stats.endpoints.PlayByPlayV2` — full play-by-play
- `nba_api.stats.endpoints.BoxScoreTraditionalV2` — player stats

### Game Data JSON Schema

```typescript
interface GameData {
  game_info: {
    game_id: string;
    date: string;
    home_team: { name: string; abbreviation: string; };
    away_team: { name: string; abbreviation: string; };
    final_score: { home: number; away: number; };
  };
  play_by_play: PlayEvent[];
  box_score: {
    home_players: PlayerStat[];
    away_players: PlayerStat[];
  };
}

interface PlayEvent {
  index: number;
  period: number;
  clock: string;             // "11:42"
  elapsed_seconds: number;   // seconds since game start
  event_type: string;        // "FIELD_GOAL_MADE", "FOUL", "TURNOVER", etc.
  description: string;       // "Tatum 26' 3PT Jump Shot (3 PTS)"
  team: string | null;       // team abbreviation or null
  player: string | null;     // player name or null
  score_home: number;
  score_away: number;
  is_scoring_play: boolean;
}

interface PlayerStat {
  player_name: string;
  team: string;
  minutes: number;
  points: number;
  rebounds: number;
  assists: number;
  steals: number;
  blocks: number;
  turnovers: number;
  fg_made: number;
  fg_attempted: number;
  three_made: number;
  three_attempted: number;
  ft_made: number;
  ft_attempted: number;
}
```

---

## State Management

All state lives in React `useState`/`useReducer` in the main page component. No external state library needed.

```typescript
interface AppState {
  // Game state
  gameData: GameData | null;
  currentPlayIndex: number;
  isPlaying: boolean;
  playbackSpeed: number;

  // Derived from play-by-play
  currentScore: { home: number; away: number };
  currentPeriod: number;
  currentClock: string;
  recentPlays: PlayEvent[];      // last 20 plays
  runningPlayerStats: PlayerStat[]; // updated as plays come in

  // AI state
  expertise: ExpertiseLevel;
  commentary: CommentaryMessage[];
  isAiLoading: boolean;

  // Voice state
  isListening: boolean;
  isSpeaking: boolean;
}
```

---

## Commentary Trigger Logic

```typescript
// In the main page component:

const PROACTIVE_BATCH_SIZE = 4;  // Comment every 4 plays
let playsSinceLastCommentary = 0;

function onNewPlay(play: PlayEvent) {
  // Update UI state
  updateScore(play);
  addToPlayFeed(play);
  updatePlayerStats(play);

  playsSinceLastCommentary++;

  // Trigger proactive commentary every N plays
  // OR immediately on "big" events
  const isBigMoment = play.event_type === "FIELD_GOAL_MADE" && play.description.includes("3PT")
    || play.description.toLowerCase().includes("dunk")
    || play.description.toLowerCase().includes("block");

  if (playsSinceLastCommentary >= PROACTIVE_BATCH_SIZE || isBigMoment) {
    const newPlays = getPlaysSince(lastCommentaryIndex);
    requestProactiveCommentary(newPlays);
    playsSinceLastCommentary = 0;
  }
}
```

---

## Error Handling

Keep it simple for a hackathon:

1. **Claude API fails** → Show "Thinking..." for 3 seconds, then "Couldn't generate commentary. Try asking a question!" in the feed
2. **Web Speech API not supported** → Hide mic button, show text-only input
3. **TTS fails** → Silently fall back to text-only (commentary still appears in feed)
4. **Game data fails to load** → Show game picker with available JSON files

---

## Performance Budget

| Operation | Target | Notes |
|-----------|--------|-------|
| Claude commentary call | <2.5s | Short prompts, short responses |
| Game simulator tick | <1ms | Pure JS, no API calls |
| UI re-render on play | <16ms | React is fast for this |
| STT processing | <1s | Browser-native |
| TTS start | <200ms | Browser-native |

---

## What We're NOT Building

- Multi-game dashboard
- Historical game browser
- User accounts/preferences persistence
- Real live game connection
- Mobile app
- Betting odds or fantasy integration
- Social features
- Player comparison tools
- Tests (hackathon)
