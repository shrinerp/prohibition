# Prohibition

## Project Overview
5-player async bootlegging web strategy game set during Prohibition (1920–1933).

## Tech Stack
- **Backend:** Hono.js + Cloudflare Workers
- **Database:** Cloudflare D1 (SQL)
- **Frontend:** React + Tailwind CSS + Phaser.js
- **Notifications:** 3mails

## How to Build / Test / Run
- `npm run dev` — local dev via wrangler
- `npm test` — run test suite
- `npm run deploy` — deploy to Cloudflare Workers
- `npm run db:migrate` — apply D1 migrations

## Issue Scopes
- `game`: core game mechanics
- `db`: database schema and migrations
- `auth`: authentication and sessions
- `map`: map engine and city graph
- `api`: external API integrations
- `ui`: frontend

## Architecture Rules
- Workers use Cloudflare bindings (D1) — never direct DB connections
- All secrets via `wrangler secret put` — never hardcoded
- TDD: write tests first
