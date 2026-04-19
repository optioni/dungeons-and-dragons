## Why

The web app is the only way to play, but an SSH server would let you connect from any terminal with zero installation — `ssh play@localhost` and you're in. This is a focused experiment to validate server-side TUI rendering over SSH as a fun alternative client.

## What Changes

- New `apps/ssh/` package — SSH server using `ssh2` + `blessed` rendering the TUI server-side, streaming ANSI output to the connected terminal
- Calls NestJS services directly — no GraphQL layer needed, bypasses the web client entirely
- Auth via SSH password mapped to an existing JWT user (no new auth model)
- PTY resize events propagate from the client terminal to the server-side renderer

## Capabilities

### New Capabilities
- `ssh-server`: SSH TCP server that allocates a PTY, renders the D&D TUI using `blessed` on the server, and streams ANSI output to the connected terminal — full narrative panel, character sidebar, and player input over a raw SSH connection

### Modified Capabilities

## Impact

- New `apps/ssh/` app — `ssh2`, `blessed`, Node process
- No changes to `apps/api/`, `apps/web/`, or any existing GraphQL API
- Direct injection of `SessionModule` and `AuthModule` services from the API
