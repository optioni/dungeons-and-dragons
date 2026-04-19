# OpenSpec Change Dependency Graph

## Completed (archived)

- `bootstrap-monorepo` — done
- `auth` — done
- `srd-seed` — done
- `character-system` — done
- `campaign-setup` — done
- `session-and-llm` — done
- `game-engine` — done
- `memory-system` — done
- `world-system` — done
- `in-game-date-fix` — done
- `merchant-stock-context` — done

## Open Changes

```
                    ┌─────────────────────────────────────────────────────┐
                    │           (all prior changes complete)               │
                    └──────────┬──────────────────┬────────────────────────┘
                               │                  │
                               ▼                  ▼
                    in-game-date-fix        merchant-stock-context
                               │
                               ▼
          ┌────────────────────┼────────────────────────┐
          │                   │                         │
          ▼                   ▼                         ▼
   quest-system        random-encounters      permadeath-campaign-end
          │                                             │
          ▼                                             ▼
   dungeon-system                          interactive-stream-signals
                                                        │
          ┌─────────────────────────────────────────────┤
          │                                             │
          ▼                                             ▼
   npc-episodic-memory                        web-game-view
                                                        │
                                                        ▼
                                             campaign-info-pages
                                             web-world-map
```

## Dependency Tiers

| Tier | Change | Blocked by |
|------|--------|------------|
| 0 ✓ | `srd-seed` | nothing |
| 1 ✓ | `character-system` | srd-seed |
| 1 ✓ | `campaign-setup` | srd-seed, auth ✓ |
| 2 ✓ | `session-and-llm` | campaign-setup, character-system, auth ✓ |
| 3 ✓ | `game-engine` | session-and-llm + all prior |
| 3 ✓ | `memory-system` | session-and-llm, campaign-setup |
| 4 ✓ | `world-system` | memory-system, game-engine, campaign-setup |
| 5 ✓ | `in-game-date-fix` | world-system, game-engine |
| 5 ✓ | `merchant-stock-context` | session-and-llm, world-system |
| 6 | `quest-system` | game-engine, campaign-setup, character-system |
| 6 | `random-encounters` | game-engine, world-system, srd-seed |
| 6 | `permadeath-campaign-end` | game-engine, session-and-llm, memory-system |
| 6 | `npc-episodic-memory` | world-system, memory-system |
| 7 | `dungeon-system` | quest-system, world-system, game-engine |
| 7 | `interactive-stream-signals` | session-and-llm, game-engine, permadeath-campaign-end |
| 7 | `web-game-view` | session-and-llm, game-engine |
| 7 | `web-world-map` | game-engine, memory-system |
| 8 | `campaign-info-pages` | character-system, memory-system, game-engine, world-system, web-game-view |

## Recommended Order

1. `in-game-date-fix` — fixes silent world tick bug; unblocks correct NPC scheduling everywhere
2. `merchant-stock-context` + `npc-episodic-memory` in parallel — both extend existing systems with no new deps on each other
3. `quest-system` + `random-encounters` + `permadeath-campaign-end` in parallel — independent feature additions
4. `dungeon-system` + `interactive-stream-signals` + `web-game-view` + `web-world-map` in parallel — depend on tier 6 being done
5. `campaign-info-pages` — depends on web-game-view for nav/layout consistency
