# Gamers Reference Port Design

**Date:** 2026-09-28  
**Writable repository:** `funmarket/HOOMA`  
**Read-only reference:** uploaded `HoomaUltimate-a4fd3d933bcfe57e49029024e1357da135432f0d.zip`

## Goal

Adopt the Gamers behavior from the exact HoomaUltimate reference snapshot into current HOOMA without mutating the reference and without destroying HOOMA's richer existing Gamer Card data model.

## Authority and precedence

1. The uploaded HoomaUltimate snapshot is the behavioral source of truth for Gamers discovery, challenge lifecycle, Arena, direct Gamer Whistle, EA FC match verification, Gamer onboarding semantics, and Gamer presentation.
2. Current HOOMA architecture remains authoritative for workspace layout, authentication middleware, shared API client, platform-admin boundary, Prisma schema location, UI shell, and existing persisted Gamer Card fields that do not conflict with the reference behavior.
3. Where current HOOMA Gamers behavior conflicts with the reference product behavior, the reference behavior wins.
4. Existing HOOMA Gamer Card data must be migrated/preserved, not destructively replaced.

## Product behavior to port

- Independent `/gamers` route family.
- Global sections: `GAMERS | CHALLENGERS | ARENA | GAME CATALOG`.
- Cross-game discovery and open-to-challenge filtering.
- Game hub route `/gamers/games/:gameSlug` with `CHALLENGERS | SQUADS | ARENA | RANKINGS`; only implemented reference sections are interactive.
- Shared Gamer HUD card reused across global and game-specific discovery.
- Shared Match Card reused by local and global Arena.
- Authenticated missing-game contribution.
- One GamerProfile per user/game; canonical HOOMA User remains the only account.
- Canonical GAMER identity gates Gamer participation actions.
- Same-game 1v1 GamerChallenge with no self challenge, no duplicate unresolved pair, server-authorized accept/decline/cancel.
- Public global Arena exposes accepted active-game matches only.
- Direct Gamer Whistle reuses the existing shared Whistle engine with a server-derived unordered pair context.
- EA SPORTS FC Mobile accepted challenges can publish a six-digit room code, submit proof-backed results, reconcile matching/conflicting submissions, and expose Platform Admin dispute resolution.

## Target adaptation

Current HOOMA already stores richer Gamer Card fields: gamerTag, bio, playStyle, privacy, region/language/preferred times, platform identities, and social links. These remain persisted. Reference `handle` semantics map to the canonical `gamerTag` field.

The current single `apps/miniapp` frontend remains the only frontend. Reference components are ported into `apps/miniapp/src/features/gamers` and current routing rather than adding a parallel `packages/frontend` runtime.

The current API router/container/auth conventions remain in place. Reference repository/service rules are adapted into those boundaries.

## Persistence

Extend the current Prisma schema non-destructively with:

- GamerChallenge and GamerChallengeStatus.
- GamerMatchSession, GamerMatchSubmission, GamerMatchSessionStatus, GamerMatchSide, GamerMatchResolution.
- required relations/indexes/check constraints through timestamped migrations.

Existing GamerGame/GamerProfile tables remain canonical and are extended only where required by reference behavior.

## Shared dependencies

### Identity

Use current `UserProfileIdentity(GAMER)`. Add the narrow additive Gamer enrollment operation needed by the reference onboarding flow without replacing full profile state.

### Whistle

Extend the existing Redis Whistle store/service with a Gamer-direct scope. Keep the existing global daily quota and expiry semantics; do not create Gamer messaging tables.

### Object storage

Add the minimal shared S3-compatible storage package required by reference match-proof handling. This is shared infrastructure, not a Gamers-only storage implementation.

### Worker

Add a minimal HOOMA worker workspace whose initial owned job is Gamer match reconciliation every 15 seconds. It uses the canonical database package and does not duplicate API business logic.

## Safety and migration rules

- No mutation of HoomaUltimate or the uploaded ZIP.
- No direct edits to `main`.
- No production `db push`.
- No destructive rename/drop of current Gamer Card columns.
- No fake online presence, rank, XP, external-game telemetry, or shadow Gamer accounts.
- No Gamer-specific duplicate chat system.
- No merge/deploy without separate authorization.

## Verification

Use the reference Gamer tests as behavioral acceptance material, adapted to current HOOMA test conventions. Each behavior slice follows RED -> implementation -> GREEN. Final gate is HOOMA CI on the exact branch head plus exact changed-file audit.
