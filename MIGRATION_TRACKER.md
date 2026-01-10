# Tauri → Web Migration Tracker

**Started:** January 10, 2026
**Goal:** Transfer full Tauri desktop trading app functionality to web app

---

## Migration Phases

### Phase 1: Foundation (Stores & Types) - COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Create exchange types | DONE | `/web/src/stores/types.ts` |
| Create tradeStore | DONE | `/web/src/stores/tradeStore.ts` |
| Create appStore | DONE | `/web/src/stores/appStore.ts` |
| Create settingsStore | DONE | `/web/src/stores/settingsStore.ts` |
| Create exchangeStore | DONE | `/web/src/stores/exchangeStore.ts` |
| Create stores index | DONE | `/web/src/stores/index.ts` |

### Phase 2: Position Sizing Logic - COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Create position-sizing.ts | DONE | `/web/src/lib/position-sizing.ts` |
| Iterative PNL verification | DONE | `verifyAndAdjustPnl()` function |
| Liquidation calculations | DONE | `validateTrade()` with warnings |
| Fee calculations | DONE | Taker fees included in PNL |

### Phase 3: Trading Dashboard UI
| Task | Status | Notes |
|------|--------|-------|
| Trade entry form | DONE | `TradingFormPnl.tsx` with real-time validation |
| Position preview panel | DONE | Shows qty, margin, liq, R:R in TradingFormPnl |
| Confirmation modal | DONE | Before execution in TradingFormPnl |
| Positions list | DONE | Tab-based view in PositionsList |
| Orders list | DONE | Tab-based view in PositionsList |
| Trade history | Pending | Past trades |

### Phase 4: API Integration
| Task | Status | Notes |
|------|--------|-------|
| Wire trade execution | Pending | Entry → SL → TP sequence |
| Wire position fetching | Pending | Real-time updates |
| Wire account info | Pending | Balance, margin |
| Wire price updates | Pending | Live prices |

### Phase 5: Extension Bridge
| Task | Status | Notes |
|------|--------|-------|
| Create /api/extension/settings | Pending | Returns current settings |
| Create /api/extension/position | Pending | Receives position from TV |
| Create /api/extension/execute | Pending | Trade execution |
| Update extension to use web | Pending | Change localhost:3456 to API |

### Phase 6: Polish & Testing
| Task | Status | Notes |
|------|--------|-------|
| Settings UI | Pending | Risk settings, etc. |
| Error handling | Pending | User-friendly errors |
| Loading states | Pending | Proper UX |
| End-to-end testing | Pending | Full trade flow |

---

## Files Created

### Web App - Stores
- `/web/src/stores/types.ts` - Exchange and trading types
- `/web/src/stores/tradeStore.ts` - Trade form state
- `/web/src/stores/appStore.ts` - App-wide state
- `/web/src/stores/settingsStore.ts` - User settings
- `/web/src/stores/exchangeStore.ts` - Exchange data (prices, positions)
- `/web/src/stores/index.ts` - Store exports

### Web App - Trading Logic
- `/web/src/lib/position-sizing.ts` - DONE - Core PNL-based position sizing

### Web App - Trading UI Components
- `/web/src/components/trading/TradingFormPnl.tsx` - DONE - PNL-based trading form
- `/web/src/components/trading/PositionsList.tsx` - UPDATED - Tab-based positions/orders view
- `/web/src/app/trading/page.tsx` - UPDATED - Uses new TradingFormPnl, tab switcher

---

## Key Differences: Tauri vs Web

| Feature | Tauri | Web |
|---------|-------|-----|
| Auth | Local password + biometric | OAuth + wallet password |
| Storage | Tauri secure store | Encrypted DB (Prisma) |
| Credentials | Stored locally | Per-user in DB |
| Extension comm | localhost:3456 | API routes |
| Updates | Tauri auto-updater | Auto-deploy from GitHub |

---

## Current Progress

**Last Updated:** January 10, 2026 - Phase 3 mostly complete

Currently working on: Phase 4 - API Integration

**Completed:**
- Phase 1: Zustand stores (tradeStore, appStore, settingsStore, exchangeStore)
- Phase 2: Position sizing logic with PNL verification
- Phase 3: Trading dashboard UI (TradingFormPnl, PositionsList tabs)
