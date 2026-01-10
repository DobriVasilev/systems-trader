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

### Phase 4: API Integration - COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Wire trade execution | DONE | `/api/trade` - Entry → SL → TP sequence |
| Wire position fetching | DONE | `/api/positions` - Real-time updates |
| Wire account info | DONE | `/api/account` - Balance, margin |
| Wire price updates | DONE | `/api/prices` - Live prices every 5s |

### Phase 5: Extension Bridge - COMPLETE
| Task | Status | Notes |
|------|--------|-------|
| Create /api/extension/settings | DONE | Returns/updates settings |
| Create /api/extension/execute | DONE | PNL-based trade execution |
| Create /api/extension/keys | DONE | API key management |
| Add ExtensionKey Prisma model | DONE | schema.prisma updated |
| Update extension to use web | DONE | v2.0.0 - uses web API with API key auth |

### Phase 6: Polish & Testing
| Task | Status | Notes |
|------|--------|-------|
| Settings UI | DONE | `/trading/settings` - Extension API key management |
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

### Web App - Extension Bridge API
- `/web/src/app/api/extension/settings/route.ts` - DONE - GET/POST settings
- `/web/src/app/api/extension/execute/route.ts` - DONE - Trade execution from extension
- `/web/src/app/api/extension/keys/route.ts` - DONE - API key management
- `/web/prisma/schema.prisma` - UPDATED - Added ExtensionKey model

### Chrome Extension (Updated v2.0.0)
- `/extension/manifest.json` - UPDATED - v2.0.0 with storage permission, popup
- `/extension/content.js` - UPDATED - Uses web API with API key auth
- `/extension/popup.html` - CREATED - API key configuration popup
- `/extension/popup.js` - CREATED - Popup logic

### Settings UI
- `/web/src/app/trading/settings/page.tsx` - Extension API key management

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

**Last Updated:** January 10, 2026 - Phase 5 complete

Currently working on: Extension update (change localhost to web API)

**Completed:**
- Phase 1: Zustand stores (tradeStore, appStore, settingsStore, exchangeStore)
- Phase 2: Position sizing logic with PNL verification
- Phase 3: Trading dashboard UI (TradingFormPnl, PositionsList tabs)
- Phase 4: API integration (trade, positions, account, prices)
- Phase 5: Extension bridge API (settings, execute, keys)
