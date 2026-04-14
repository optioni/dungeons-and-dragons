# OpenSpec Change Dependency Graph

## Completed (archived)

- `bootstrap-monorepo` — done
- `auth` — done

## Open Changes

```
srd-seed
    │
    ├──▶ character-system ──┐
    │                       │
    └──▶ campaign-setup ────┼──▶ session-and-llm ──┐
             │              │         │              │
             │    auth ─────┘         │              ▼
             │    (done)              ├──▶ game-engine ──┐
             │                        │       │           │
             │                        │       ▼           │
             │                   memory-system ◀──────────┤
             │                        │                   │
             │                        ├──▶ world-system ◀─┘
             │                        │
             │                        └──▶ quest-system
             │
             ├──▶ web-game-view (needs session-and-llm + game-engine)
             └──▶ web-world-map (needs game-engine + memory-system)
```

## Dependency Tiers

| Tier | Change | Blocked by |
|------|--------|------------|
| 0 (ready now) | `srd-seed` | nothing |
| 1 | `character-system` | srd-seed |
| 1 | `campaign-setup` | srd-seed, auth ✓ |
| 2 | `session-and-llm` | campaign-setup, character-system, auth ✓ |
| 3 | `game-engine` | session-and-llm + all prior |
| 3 | `memory-system` | session-and-llm, campaign-setup |
| 4 | `world-system` | memory-system, game-engine, campaign-setup |
| 4 | `quest-system` | game-engine, campaign-setup, character-system |
| 4 | `web-game-view` | session-and-llm, game-engine |
| 4 | `web-world-map` | game-engine, memory-system |

## Recommended Order

1. `srd-seed` — no dependencies, unblocks everything
2. `character-system` + `campaign-setup` in parallel (both only need srd-seed)
3. `session-and-llm`
4. `game-engine` + `memory-system` in parallel
5. `world-system` + `quest-system` + `web-game-view` + `web-world-map` in parallel
