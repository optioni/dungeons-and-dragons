# OpenSpec Change Dependency Graph

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
| 6 ✓ | `quest-system` | game-engine, campaign-setup, character-system |
| 6 ✓ | `random-encounters` | game-engine, world-system, srd-seed |
| 6 ✓ | `permadeath-campaign-end` | game-engine, session-and-llm, memory-system |
| 6 ✓ | `npc-episodic-memory` | world-system, memory-system |
| 7 ✓ | `dungeon-system` | quest-system, world-system, game-engine |
| 7 | `character-inner-monologue` | character-system, campaign-setup, session-and-llm |
| 7 ✓ | `interactive-stream-signals` | session-and-llm, game-engine, permadeath-campaign-end ✓, web-game-view |
| 8 | `web-game-view` | session-and-llm, game-engine |
| 9 | `campaign-info-pages` | character-system, memory-system, game-engine, world-system |
| 10 | `web-world-map` | campaign-setup, game-engine, memory-system, campaign-info-pages |
| 11 | `tui-client` | auth, character-system, campaign-setup, session-and-llm, game-engine |
| 12 | `ssh-tui-server` | auth, session-and-llm, game-engine, tui-client |
