#!/usr/bin/env bash
# Debug NPC state for a given game.
# Usage: bash scripts/debug-npcs.sh [GAME_ID]
# With no argument, lists active games.

set -euo pipefail

DB="prohibition"

run() {
  npx wrangler d1 execute "$DB" --remote --json --command "$1" 2>/dev/null \
    | jq -r '.[0].results | if length == 0 then "(no rows)" else (.[0] | keys_unsorted) as $h | ($h | join("\t")), (.[] | [.[$h[]]] | map(tostring) | join("\t")) end'
}

# ── List games (no arg) ────────────────────────────────────────────────────────
if [[ $# -eq 0 ]]; then
  echo "Active games:"
  npx wrangler d1 execute "$DB" --remote --json --command \
    "SELECT id, current_season, current_player_index, player_count FROM games WHERE status='active' ORDER BY rowid DESC LIMIT 10" 2>/dev/null \
    | jq -r '.[0].results[] | "\(.id)  season=\(.current_season)  idx=\(.current_player_index)  players=\(.player_count)"'
  echo ""
  echo "Usage: bash scripts/debug-npcs.sh <GAME_ID>"
  exit 0
fi

GAME="$1"
echo "=== NPC Debug: $GAME ==="

echo ""
echo "── NPC players ───────────────────────────────────────"
run "SELECT gp.id, gp.display_name, gp.character_class, gp.turn_order, gp.cash, gp.heat, cp.name AS current_city, hp.name AS home_city FROM game_players gp JOIN game_cities gc ON gc.id = gp.current_city_id JOIN city_pool cp ON cp.id = gc.city_pool_id JOIN game_cities ghc ON ghc.id = gp.home_city_id JOIN city_pool hp ON hp.id = ghc.city_pool_id WHERE gp.game_id = '$GAME' AND gp.is_npc = 1 ORDER BY gp.turn_order"

echo ""
echo "── NPC distilleries + stockpile ──────────────────────"
run "SELECT gp.display_name AS npc, cp.name AS city, d.tier, ci.alcohol_type, COALESCE(ci.quantity,0) AS stockpile FROM distilleries d JOIN game_players gp ON d.player_id = gp.id JOIN game_cities gc ON d.city_id = gc.id JOIN city_pool cp ON cp.id = gc.city_pool_id LEFT JOIN city_inventory ci ON ci.game_id = '$GAME' AND ci.city_id = d.city_id WHERE gp.game_id = '$GAME' AND gp.is_npc = 1 ORDER BY gp.turn_order, d.city_id"

echo ""
echo "── NPC vehicles ──────────────────────────────────────"
run "SELECT gp.display_name AS npc, v.vehicle_type, cp.name AS vehicle_city FROM vehicles v JOIN game_players gp ON v.player_id = gp.id JOIN game_cities gc ON v.city_id = gc.id JOIN city_pool cp ON cp.id = gc.city_pool_id WHERE v.game_id = '$GAME' AND gp.is_npc = 1 ORDER BY gp.turn_order"

echo ""
echo "── City ownership ────────────────────────────────────"
run "SELECT cp.name, cp.population_tier, COALESCE(gp.display_name, gp.character_class, '(neutral)') AS owner, COALESCE(gp.is_npc,'') AS is_npc, gc.claim_cost FROM game_cities gc JOIN city_pool cp ON cp.id = gc.city_pool_id LEFT JOIN game_players gp ON gc.owner_player_id = gp.id WHERE gc.game_id = '$GAME' ORDER BY gp.is_npc DESC NULLS LAST, cp.name"

echo ""
echo "── NPC turns (last 20) ───────────────────────────────"
run "SELECT t.id, t.season, gp.display_name AS player, t.skipped FROM turns t JOIN game_players gp ON t.player_id = gp.id WHERE t.game_id = '$GAME' AND gp.is_npc = 1 ORDER BY t.id DESC LIMIT 20"

echo ""
echo "── Recent game messages (last 30) ────────────────────"
run "SELECT gm.id, gp.display_name AS player, gp.is_npc, gm.message FROM game_messages gm JOIN game_players gp ON gm.player_id = gp.id WHERE gm.game_id = '$GAME' ORDER BY gm.id DESC LIMIT 30"

echo ""
echo "── Neutral cities adjacent to NPC vehicles ───────────"
run "SELECT gp.display_name AS npc, vc.name AS vehicle_city, adj_cp.name AS adj_city, adj_gc.claim_cost, gp.cash FROM vehicles v JOIN game_players gp ON v.player_id = gp.id AND gp.game_id = '$GAME' AND gp.is_npc = 1 JOIN game_cities gvc ON gvc.id = v.city_id JOIN city_pool vc ON vc.id = gvc.city_pool_id JOIN roads r ON r.game_id = '$GAME' AND (r.from_city_id = v.city_id OR r.to_city_id = v.city_id) JOIN game_cities adj_gc ON adj_gc.id = CASE WHEN r.from_city_id = v.city_id THEN r.to_city_id ELSE r.from_city_id END AND adj_gc.game_id = '$GAME' AND adj_gc.owner_player_id IS NULL JOIN city_pool adj_cp ON adj_cp.id = adj_gc.city_pool_id WHERE v.game_id = '$GAME' ORDER BY gp.display_name, adj_cp.name"

echo ""
echo "Done."
