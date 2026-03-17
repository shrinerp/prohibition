# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

5-player async bootlegging strategy game set during Prohibition (1920–1933). Players produce alcohol, trade on city markets, bribe officials, claim territory, and evade police across 52 seasons.

## Commands

```bash
npm run dev          # Local dev via wrangler (Worker + D1)
npm run deploy       # Build frontend then deploy Worker to Cloudflare
npm test             # Run Vitest test suite
npm run typecheck    # tsc --noEmit

# Frontend only
cd src/frontend && npx vite build   # Build SPA to dist/frontend/

# Database migrations (remote)
npx wrangler d1 migrations apply prohibition --remote
# If a migration is blocked by a pre-existing conflict, apply directly:
npx wrangler d1 execute prohibition --remote --command "ALTER TABLE ..."
```

**Deploy** always runs `build:frontend` first — never deploy without it.

## Architecture

**Backend:** Single Cloudflare Worker (Hono.js) at `src/index.ts`
- `src/routes/auth.ts` — register, login, logout (bcrypt + session cookie, 30-day TTL)
- `src/routes/games.ts` — all game API endpoints; the `POST /:id/turn` handler is the core turn engine (~540 lines)
- `src/services/` — AuthService, GameService (game creation/start), notifications
- `src/middleware/` — sessionAuth (validates cookie → userId), ageGate (21+ check on register)

**Frontend:** React 19 SPA built with Vite, served via Cloudflare Assets binding (`ASSETS`)
- All routes are client-side; the Worker catch-all delegates unmatched requests to `env.ASSETS.fetch()` for SPA routing
- `src/frontend/src/pages/GamePage.tsx` is the main game UI — all in-game interactions, dialogs, and state live here

**Game logic modules** (`src/game/`):
| File | Responsibility |
|------|---------------|
| `characters.ts` | 10 character classes, modifier chain (heat, movement, cargo, production, bribe duration) |
| `movement.ts` | Vehicle specs (`VEHICLES`, `VEHICLE_PRICES`), movement resolution, road traversal |
| `police.ts` | Encounter roll, submit/bribe/run resolution, heat calculation, spot bribe cost |
| `production.ts` | `DISTILLERY_TIERS` (tier 1–5: output 4/8/14/22/34, costs 200/500/1k/2k/4k) |
| `mapEngine.ts` | K-nearest road generation, connectivity repair, Dijkstra pathfinding |

**Database:** Cloudflare D1 (SQLite), binding `PROHIBITIONDB`. Key tables:
- `games` — status (lobby/active/ended), current_player_index, current_season
- `game_players` — vehicle, cash, heat, jail_until_season, pending_police_encounter (JSON), display_name
- `game_cities` — owner_player_id, claim_cost, bribe_player_id/expires_season; joined to `city_pool` for name/tier/lat/lon/primary_alcohol
- `city_inventory` — alcohol stockpiled by distilleries (produced each season rollover)
- `distilleries` — player_id + city_id + tier; all owned stills, not just home city
- `market_prices` — regenerated each season; city's primary alcohol at 0.65× base price

## Key Patterns

**Turn engine flow** (`POST /:id/turn`):
1. Verify it's the player's turn (`turn_order === current_player_index`)
2. Loop through submitted actions array (move, buy, sell, pickup, claim_city, upgrade_still, upgrade_vehicle, bribe_official, police_resolve, stay, skip)
3. Police encounters are two-phase: move sets `pending_police_encounter` and returns early; next request must be `police_resolve`
4. After all actions: advance `current_player_index`, auto-skip NPC slots
5. On season rollover (`nextIndex === 0`): run distillery production via batch INSERT, regenerate market prices, expire bribes

**Cargo capacity** — always look up `VEHICLES[playerRow.vehicle].cargoSlots` from `movement.ts`; never hardcode 8

**City claiming** — on `claim_city`: delete prior owner's distillery, insert Tier-1 distillery for new owner; season rollover picks it up automatically

**Market dialog** — actions are batched client-side with optimistic UI updates; one POST to `/turn` fires on dialog close, then `fetchAll()`

**NPC names** — assigned on `startGame` from themed pool (Big Al, Lucky Luciano, etc.); stored in `display_name`

## Schema Notes

- `game_cities.id` is the in-game city ID (not `city_pool.id`) — always join `game_cities gc JOIN city_pool cp ON gc.city_pool_id = cp.id`
- `distilleries` has `UNIQUE(player_id, still_number)` — use `INSERT OR IGNORE` when granting a new still
- Migration 0003 has a pre-existing duplicate column conflict on remote; apply new columns with `wrangler d1 execute --command` directly
