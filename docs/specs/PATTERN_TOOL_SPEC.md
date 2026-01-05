# Pattern Development Platform - Specification

> **Project**: Hyperliquid Trading App - Pattern Validation Tool
> **Created**: 2025-01-05
> **Status**: Planning Complete, Ready to Build

---

## Table of Contents

1. [Overview](#overview)
2. [Problem Statement](#problem-statement)
3. [Core Features](#core-features)
4. [Data Model](#data-model)
5. [Architecture](#architecture)
6. [Technical Stack](#technical-stack)
7. [UI/UX Design](#uiux-design)
8. [Build Phases](#build-phases)
9. [Testing Strategy](#testing-strategy)
10. [Future Considerations](#future-considerations)

---

## Overview

### What is this?

A collaborative pattern validation platform for developing and refining trading pattern detection algorithms. Think "Google Docs for trading patterns" - real-time collaboration, commenting, corrections, and full audit trails.

### Why build this?

1. **20+ patterns to validate** - Chat-based validation is too slow
2. **Need expert input** - Share with other traders for feedback
3. **Unified tool** - Same interface for pattern building, backtesting, live trading
4. **Traceability** - Every change logged so Claude can understand what went wrong

### Who uses it?

- **Primary**: Dobri (pattern developer)
- **Secondary**: Trading friends (reviewers/collaborators)
- **Tertiary**: Claude Code (reads corrections to improve algorithms)

---

## Problem Statement

### Current Pain Points

1. **Slow feedback loop**: Validating patterns via chat requires describing each issue in words
2. **No visual comparison**: Can't easily compare bot's detection vs correct detection
3. **No collaboration**: Can't share with other traders for second opinions
4. **No audit trail**: Changes aren't tracked, hard to understand what went wrong
5. **No persistence**: Each session starts fresh, no history

### Desired Workflow

```
1. Bot detects patterns (swings, BOS, etc.) on chart
2. User sees detections visually on chart
3. User clicks incorrect detection → marks as wrong
4. User shows where correct detection should be
5. User explains WHY it's wrong (comment)
6. User shares with friend for review
7. Friend adds their comments
8. Export all corrections → feed to Claude to fix algorithm
9. Repeat until patterns are accurate
```

---

## Core Features

### Must Have (MVP)

| # | Feature | Description |
|---|---------|-------------|
| 1 | **Chart Display** | Candlestick chart with timeframe switcher (1m, 5m, 15m, 1h, 4h, 1d) |
| 2 | **Bot Detections** | Show pattern detections as markers on chart |
| 3 | **Correction: Move** | Click marker → drag to correct position |
| 4 | **Correction: Delete** | Click marker → mark as "shouldn't exist" |
| 5 | **Correction: Add** | Click empty space → add missing detection |
| 6 | **Comments** | Attach explanation to any correction |
| 7 | **Threaded Replies** | Reply to comments (like Google Docs) |
| 8 | **Pattern Switcher** | Dropdown to switch: Swings, BOS, MSB, Range, etc. |
| 9 | **Real-time Sync** | Multiple users see changes live |
| 10 | **User Auth** | Login to identify who made changes |
| 11 | **ULID Tracking** | Every entity has unique ID for tracing |
| 12 | **Full History** | Every action logged with who/when/what |
| 13 | **Export JSON** | Export corrections in format Claude can read |

### Should Have (Post-MVP)

| # | Feature | Description |
|---|---------|-------------|
| 14 | **Attachments** | Upload screenshots to comments |
| 15 | **Resolve/Unresolve** | Mark corrections as addressed |
| 16 | **Filter View** | Show all / unresolved only / by author |
| 17 | **Session Management** | Create/load/archive review sessions |
| 18 | **Sharing Controls** | Invite specific users, public links |

### Nice to Have (Future)

| # | Feature | Description |
|---|---------|-------------|
| 19 | **Drawing Tools** | Fibonacci, trendlines, zones |
| 20 | **Tauri Desktop** | Desktop app wrapper |
| 21 | **Backtest Integration** | Run backtest with corrected patterns |
| 22 | **Live Trading Integration** | Use validated patterns in live engine |

---

## Data Model

### Core Principle: Event Sourcing Lite

Store every action as an event. This enables:
- **Retroactive computation**: Add XP system later, compute from past events
- **Full audit trail**: See exactly what happened and when
- **Undo/redo**: Replay events forward/backward
- **Debugging**: Understand why something is in current state

### Entities

#### PatternSession
```
Root entity for a review session.

Fields:
- id: ULID
- symbol: string ("BTC", "ETH")
- timeframe: string ("1m", "5m", "15m", "1h", "4h", "1d")
- startTime: datetime
- endTime: datetime
- patternType: string ("swings", "bos", "msb", "range", "false_breakout")
- patternVersion: string (which algorithm version)
- createdBy: userId
- sharedWith: userId[]
- isPublic: boolean
- status: "in_progress" | "resolved" | "archived"
- title: string (optional)
- description: string (optional)
- createdAt: datetime
- updatedAt: datetime
```

#### PatternDetection
```
A detection made by the bot algorithm.

Fields:
- id: ULID
- sessionId: FK
- candleIndex: int
- candleTime: datetime
- price: float
- detectionType: string ("swing_high", "swing_low", "bos_bullish", etc.)
- structure: string (optional, "HH", "HL", "LH", "LL")
- confidence: float (optional)
- canvasX: float (optional, for rendering)
- canvasY: float (optional)
- status: "pending" | "confirmed" | "rejected" | "moved"
- metadata: JSON (algorithm-specific data)
- createdAt: datetime
```

#### PatternCorrection
```
A correction made by a user.

Fields:
- id: ULID
- sessionId: FK
- detectionId: FK (null if adding new)
- userId: FK
- correctionType: "move" | "delete" | "add" | "confirm"
- originalIndex: int (optional)
- originalTime: datetime (optional)
- originalPrice: float (optional)
- correctedIndex: int (optional)
- correctedTime: datetime (optional)
- correctedPrice: float (optional)
- correctedType: string (optional, if changing type)
- reason: text (required explanation)
- attachments: JSON ([{id, url, type, name}])
- status: "pending" | "applied" | "disputed"
- resolvedAt: datetime (optional)
- resolvedBy: userId (optional)
- createdAt: datetime
- updatedAt: datetime
```

#### PatternComment
```
A comment on a detection, correction, or general.

Fields:
- id: ULID
- sessionId: FK
- detectionId: FK (optional)
- correctionId: FK (optional)
- parentId: FK (optional, for replies)
- userId: FK
- content: text
- attachments: JSON
- canvasX: float (optional, for positional comments)
- canvasY: float (optional)
- candleTime: datetime (optional)
- resolved: boolean
- resolvedAt: datetime (optional)
- resolvedBy: userId (optional)
- editedAt: datetime (optional)
- editCount: int
- createdAt: datetime
- updatedAt: datetime
```

#### PatternEvent
```
Every action logged for audit trail.

Fields:
- id: ULID
- sessionId: FK
- userId: FK
- eventType: string (e.g., "detection_created", "correction_made", "comment_added")
- entityType: string (optional, "detection", "correction", "comment")
- entityId: ULID (optional)
- payload: JSON (full event data, before/after snapshots)
- createdAt: datetime
```

### Indexes

```
PatternSession:
- (createdBy, status)
- (patternType, status)

PatternDetection:
- (sessionId, detectionType)
- (candleTime)

PatternCorrection:
- (sessionId, status)
- (userId)
- (detectionId)

PatternComment:
- (sessionId)
- (detectionId)
- (correctionId)
- (parentId)

PatternEvent:
- (sessionId, createdAt)
- (entityId)
```

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PATTERN TOOL (Web App)                   │
│                                                             │
│  Next.js 15 + React 19 + TypeScript                        │
│  Real-time: Supabase Realtime or Upstash Redis             │
│  Database: PostgreSQL (Neon)                                │
│  Auth: NextAuth.js                                          │
│  Storage: Cloudflare R2 (attachments)                       │
│                                                             │
│  NO trading secrets here - safe to be public                │
└─────────────────────────────────────────────────────────────┘
                              │
                              │ Export validated patterns
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  TRADING ENGINE (Python)                    │
│                                                             │
│  Runs on local server (Dell Wyse in Bulgaria)              │
│  Has API keys - never exposed to internet                   │
│  Imports corrected patterns from Pattern Tool               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Security Boundary

- **Pattern Tool**: Public-facing web app, no secrets, uses public candle data
- **Trading Engine**: Local only, has API keys, executes trades

### Folder Structure

```
/hyperliquid-app
├── /trading_engine        # Python trading engine (existing)
│   ├── /patterns          # Pattern detection algorithms
│   ├── /indicators        # Technical indicators
│   └── ...
│
├── /pattern-tool          # NEW: Next.js web app
│   ├── /src
│   │   ├── /app           # Next.js App Router
│   │   │   ├── /api       # API routes
│   │   │   ├── /auth      # Auth pages
│   │   │   ├── /session   # Review session pages
│   │   │   └── ...
│   │   ├── /components    # React components
│   │   │   ├── /ui        # Base UI components
│   │   │   ├── /chart     # Chart components
│   │   │   ├── /markers   # Detection markers
│   │   │   ├── /comments  # Comment system
│   │   │   └── ...
│   │   ├── /lib           # Utilities
│   │   │   ├── auth.ts
│   │   │   ├── db.ts
│   │   │   ├── realtime.ts
│   │   │   └── ...
│   │   ├── /hooks         # Custom hooks
│   │   └── /types         # TypeScript types
│   ├── /prisma            # Database schema
│   ├── /e2e               # Playwright tests
│   └── package.json
│
└── /src                   # Existing Tauri app (unchanged)
```

---

## Technical Stack

| Layer | Technology | Reason |
|-------|------------|--------|
| **Framework** | Next.js 15 (App Router) | Modern, same as dobrilab |
| **Runtime** | React 19 | Latest, concurrent features |
| **Language** | TypeScript (strict) | Type safety |
| **Styling** | Tailwind CSS v4 | Fast, consistent |
| **Charts** | TradingView Lightweight Charts | Free, capable |
| **Database** | PostgreSQL (Neon) | Reliable, familiar |
| **ORM** | Prisma | Type-safe, migrations |
| **Auth** | NextAuth.js v5 | Battle-tested, OAuth support |
| **Real-time** | Supabase Realtime or Redis pub/sub | Google Docs-like sync |
| **Storage** | Cloudflare R2 | Cheap, fast (for attachments) |
| **Testing** | Playwright | E2E, comprehensive |
| **IDs** | ULID | Sortable, unique, traceable |

---

## UI/UX Design

### Design Principles

1. **Clean & Professional** - Like Linear, Figma, Google Docs
2. **Information Dense** - Show what matters, hide what doesn't
3. **Fast Interactions** - Click, correct, done
4. **Real-time Feel** - See others' changes instantly
5. **Mobile Friendly** - Works on tablet for on-the-go review

### Key Screens

#### 1. Session List (Home)
```
┌─────────────────────────────────────────────────────────────┐
│  Pattern Tool                           [+ New Session] [👤]│
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  My Sessions                                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ BTC 4H Swings - Dec 2024          In Progress  ●    │   │
│  │ 15 detections, 3 corrections      Updated 2h ago    │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ ETH 1H BOS Review                 Resolved     ✓    │   │
│  │ 8 detections, 8 confirmed         Updated 1d ago    │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Shared With Me                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SOL Range Detection (from @trader1)                 │   │
│  │ Needs your review                 Updated 30m ago   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### 2. Review Session (Main View)
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back   BTC 4H Swings              [Swings ▼] [Share] [⋮]│
├───────────────────────────────────────────────┬─────────────┤
│                                               │  Comments   │
│                                               │             │
│     📈 CHART WITH CANDLESTICKS               │  [Filter ▼] │
│                                               │             │
│        ↓ SH (LH)                             │  ┌─────────┐│
│       /\                                      │  │ @dobri  ││
│      /  \    ↑ SL (HL)                       │  │ This    ││
│     /    \  /                                 │  │ swing...││
│    /      \/                                  │  └─────────┘│
│                                               │             │
│   [Click marker to correct]                   │  ┌─────────┐│
│   [Click empty to add]                        │  │ @trader ││
│                                               │  │ I think ││
│                                               │  │ ...     ││
├───────────────────────────────────────────────┤  └─────────┘│
│  [1m] [5m] [15m] [1h] [4h] [1d]    🔍 Zoom   │             │
└───────────────────────────────────────────────┴─────────────┘
```

#### 3. Correction Modal
```
┌─────────────────────────────────────────────────┐
│  Correct Detection                          ✕  │
├─────────────────────────────────────────────────┤
│                                                 │
│  Detection: Swing High at $98,000              │
│  Time: Dec 15, 2024 08:00                      │
│                                                 │
│  What's wrong?                                  │
│  ○ Wrong position (I'll show correct spot)     │
│  ○ Shouldn't exist (delete it)                 │
│  ● Correct (confirm it's right)                │
│                                                 │
│  Reason (required):                             │
│  ┌───────────────────────────────────────────┐ │
│  │ The actual high was 3 candles earlier,    │ │
│  │ bot detected the retest not the high      │ │
│  └───────────────────────────────────────────┘ │
│                                                 │
│  [📎 Attach screenshot]                        │
│                                                 │
│  [Cancel]                    [Save Correction] │
└─────────────────────────────────────────────────┘
```

---

## Build Phases

### Phase 1: Project Setup
- [ ] Create Next.js 15 project in `/pattern-tool`
- [ ] Set up TypeScript strict mode
- [ ] Set up Tailwind CSS v4
- [ ] Set up Prisma with Neon
- [ ] Create database schema (all models)
- [ ] Run initial migration
- [ ] Set up ULID generation
- **Tests**: Schema validation, ULID generation

### Phase 2: Authentication
- [ ] Set up NextAuth.js v5
- [ ] Add Google OAuth provider
- [ ] Add email/password provider
- [ ] Create auth middleware
- [ ] Create login/signup pages
- **Tests**: Login flow, protected routes

### Phase 3: Chart Foundation
- [ ] Install TradingView Lightweight Charts
- [ ] Create Chart component
- [ ] Fetch candle data from Hyperliquid API
- [ ] Implement timeframe switcher
- [ ] Add zoom/pan controls
- **Tests**: Chart renders, timeframe switches, data loads

### Phase 4: Session Management
- [ ] Create session list page
- [ ] Create new session flow
- [ ] Load session with candle data
- [ ] Save session to database
- **Tests**: CRUD operations for sessions

### Phase 5: Bot Detections
- [ ] Create Python API endpoint to run pattern detection
- [ ] Display detections as markers on chart
- [ ] Different marker styles per detection type
- [ ] Click marker to select
- **Tests**: Detections render, click selects

### Phase 6: Corrections System
- [ ] Create correction modal
- [ ] Implement "move" correction (click new position)
- [ ] Implement "delete" correction
- [ ] Implement "add" detection
- [ ] Save corrections to database
- [ ] Update markers to show correction status
- **Tests**: All correction types work, persist to DB

### Phase 7: Comments System
- [ ] Create comments sidebar
- [ ] Add comment to detection
- [ ] Add comment to correction
- [ ] Threaded replies
- [ ] Edit/delete comments
- **Tests**: CRUD for comments, threading works

### Phase 8: Real-time Collaboration
- [ ] Set up Supabase Realtime (or Redis pub/sub)
- [ ] Subscribe to session changes
- [ ] Broadcast corrections in real-time
- [ ] Broadcast comments in real-time
- [ ] Show who's online
- **Tests**: Two browsers see same changes

### Phase 9: Event Logging
- [ ] Log all actions to PatternEvent table
- [ ] Create event viewer (audit log)
- [ ] Export events as JSON
- **Tests**: All actions logged, export works

### Phase 10: Sharing & Export
- [ ] Share session with specific users
- [ ] Generate public link
- [ ] Export corrections as JSON for Claude
- [ ] Export session as report
- **Tests**: Sharing permissions, export format

### Phase 11: Polish
- [ ] File attachments (screenshots)
- [ ] Resolve/unresolve corrections
- [ ] Filter views
- [ ] Pattern type switcher
- [ ] Mobile responsiveness
- **Tests**: All features work on mobile

---

## Testing Strategy

### Test Types

| Type | Tool | Coverage |
|------|------|----------|
| E2E | Playwright | All user flows |
| Component | Vitest + React Testing Library | UI components |
| API | Playwright or Vitest | API routes |
| Schema | Prisma | Database migrations |

### E2E Test Files

```
/e2e
├── auth.setup.ts              # Create authenticated session
├── 01-auth.spec.ts            # Login, logout, signup
├── 02-sessions.spec.ts        # Create, list, delete sessions
├── 03-chart.spec.ts           # Chart rendering, timeframes
├── 04-detections.spec.ts      # View detections
├── 05-corrections.spec.ts     # Move, delete, add corrections
├── 06-comments.spec.ts        # Add, reply, resolve comments
├── 07-realtime.spec.ts        # Multi-user sync
├── 08-export.spec.ts          # Export JSON
└── 09-sharing.spec.ts         # Share with users
```

### Test Approach

1. **Test-first where possible**: Write test, then implement
2. **Every feature gets a test**: No untested code
3. **CI runs all tests**: Block merge if tests fail
4. **Visual regression**: Screenshot tests for chart

---

## Future Considerations

### Backtest Integration
Once patterns are validated, export them to the Python trading engine for backtesting. The correction history helps tune algorithm parameters.

### Live Trading
Validated patterns can be used in the live trading engine. The same pattern definitions work for backtest and live.

### Pattern Marketplace
Share validated pattern configurations with other traders. They can import your swing detection settings.

### AI-Assisted Correction
Use Claude to suggest corrections based on patterns it learned from previous sessions.

---

## Appendix

### Swing Detection Algorithm (Current)

```python
# Break-confirmation logic
# Swing LOW confirmed when price breaks ABOVE previous swing high
# Swing HIGH confirmed when price breaks BELOW previous swing low

# See: /trading_engine/patterns/swings.py
```

### Export Format (for Claude)

```json
{
  "session": {
    "id": "01JGXYZ...",
    "symbol": "BTC",
    "timeframe": "4h",
    "patternType": "swings",
    "patternVersion": "1.0.0"
  },
  "corrections": [
    {
      "id": "01JG...",
      "type": "move",
      "detection": {
        "id": "01JG...",
        "type": "swing_high",
        "candleTime": "2024-12-15T08:00:00Z",
        "price": 98000
      },
      "correctedTo": {
        "candleTime": "2024-12-15T00:00:00Z",
        "price": 97500
      },
      "reason": "Bot detected the retest, not the actual high. The real swing high was 3 candles earlier.",
      "author": "dobri"
    }
  ],
  "comments": [
    {
      "id": "01JG...",
      "detectionId": "01JG...",
      "content": "This pattern keeps getting detected wrong because...",
      "author": "trader_friend"
    }
  ]
}
```

### Related Files

- `/trading_engine/patterns/swings.py` - Swing detection algorithm
- `/trading_engine/patterns/structure_breaks.py` - BOS/MSB detection
- `/trading_engine/patterns/range_detector.py` - Range detection
- `/trading_engine/patterns/false_breakout.py` - False breakout detection

---

## Changelog

| Date | Change |
|------|--------|
| 2025-01-05 | Initial specification created |
