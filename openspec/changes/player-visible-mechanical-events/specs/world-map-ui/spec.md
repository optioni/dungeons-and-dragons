## ADDED Requirements

### Requirement: Travel and discovery visible events refresh map-facing state safely
The world map and play route SHALL treat `PLAYER_VISIBLE_EVENT` records with category `TRAVEL` or `DISCOVERY` as player-facing signals that map state may have changed. The UI SHALL refresh or reconcile discovered map data from the owner-scoped world map read model rather than trusting visible event payloads as the source of hidden location truth.

#### Scenario: Location discovery event prompts map refresh
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `DISCOVERY` and kind `LOCATION_DISCOVERED` is reconciled after a turn
- **THEN** the play or map UI can show a discovery annotation and refresh map data so the newly discovered location appears through the normal fog-of-war read model

#### Scenario: Travel event updates current location display
- **WHEN** a `PLAYER_VISIBLE_EVENT` with category `TRAVEL` and kind `TRAVEL_COMPLETED` is reconciled after a turn
- **THEN** the play or map UI can update current-location feedback from durable campaign and map data

#### Scenario: Discovery event does not reveal frontier details
- **WHEN** a visible discovery or travel event is rendered
- **THEN** the UI does not reveal undiscovered frontier location names, descriptions, current state, NPCs, or world events outside the owner-scoped map read model
