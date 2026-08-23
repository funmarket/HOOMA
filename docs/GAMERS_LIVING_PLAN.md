# HOOMA Gamers Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/gamers-catalog-admin`
Current baseline main SHA: `07b6130173259718473f41d087739b154efcd503`

## Purpose

This is the canonical resumable implementation plan for HOOMA Gamers. Update it after every
successful implementation slice so another agent can continue from repository truth rather than
reconstructing chat history.

Before every slice, reconcile this file with current `main`, open PRs, contracts, API routes,
services, repositories, Prisma schema/migrations, frontend routes/components, design sources, and
tests. Repository truth wins.

## Non-negotiable rules

- Work only in `funmarket/HOOMA`.
- Treat `funmarket/HoomaUltimate` as reference-only.
- Build/fix at the source; no patches, duplicate paths, or workaround layers.
- Inspect current implementation before each change; do not guess.
- Canonical HOOMA `User` remains the only account identity.
- `GAMER` is an identity facet, not an authorization role.
- Keep Gamer data out of `PlayerProfile`.
- Keep `Team`, `GamerSquad`, `TeamChallenge`, and `GamerChallenge` separate.
- Never reuse Coach/Assistant authority for Gamers.
- Keep server authorization/privacy authoritative.
- Use real Prisma migrations; never use production `prisma db push` or DB patching.
- No fake production data, rankings, online state, or permanent Gamer chat workaround.
- Integrate Whistle only through a canonical shared Whistle domain.
- Preserve Telegram/web auth over the same backend truth.
- Re-check open PRs before shared-source changes.
- A slice is complete only after full CI passes and this plan is updated.

## Product promise

**FIND YOUR NEXT OPPONENT**

Secondary: **Challenge. Play. Prove it. Build your Squad.**

Core loop: Discover -> Gamer Card -> Challenge -> Play externally -> Confirm result -> Build Squad
-> trustworthy per-game record/ranking.

## Verified architecture

- Canonical identity contracts and Prisma already contain `GAMER`.
- Profile UI already exposes Gamer as a selected identity.
- Platform Admin is the app-level authority boundary.
- `packages/database/prisma.config.ts` sets `schema: 'prisma'`.
- The complete `packages/database/prisma/` folder is the Prisma schema source.
- Domain schema files may live in `packages/database/prisma/models/`.
- The committed timestamped migration chain is authoritative.
- Home PR #53 is merged and must remain preserved.
- No canonical shared Whistle domain currently exists for Gamers.

## Architectural invariants

- `User` = canonical account.
- `UserProfileIdentity(GAMER)` = identity facet only.
- `PlayerProfile` = football-player data only.
- `GamerProfile` = one user for one video game.
- `Team` = football team.
- `GamerSquad` = game-specific gamer community.
- `TeamChallenge` = football-team challenge.
- `GamerChallenge` = gamer-vs-gamer competition.
- Coach/Assistant authority = Teams only.
- Gamer Squad Leader authority = Gamers only.
- Platform Admin = game catalog moderation and later dispute tooling.

Shared infrastructure is allowed. Shared business ownership is not.

## Current GamerGame foundation

Canonical game catalog fields now persisted:

- `id`
- unique `slug`
- `name`
- unique `normalizedName`
- `description`
- `logoUrl`
- `coverUrl`
- `publisher`
- supported platforms
- `ACTIVE | INACTIVE` status
- featured state
- timestamps

Public API behavior validated in PR #59:

- `GET /api/v1/gamers/games`
- `GET /api/v1/gamers/games/:gameId`
- public reads expose only `ACTIVE` games
- list filters support query, platform, and featured state
- list pagination uses the canonical time/id cursor pattern
- detail accepts canonical id or slug
- Gamers owns its repository/service/controller boundary
- no Team or Platform Admin authority is imported into the Gamers read domain

Platform Admin catalog behavior validated in PR #60:

- `POST /api/v1/app-admin/gamers/games`
- `PATCH /api/v1/app-admin/gamers/games/:gameId`
- existing `PlatformAdminService.requirePlatformAdmin` is the only authorization boundary
- name normalization and slug generation remain owned by the Gamers domain
- renaming a game regenerates both canonical `normalizedName` and `slug`
- Prisma unique races become stable `GAMER_GAME_CONFLICT` responses
- missing updates become stable `GAMER_GAME_NOT_FOUND` responses
- status and featured changes use the same canonical update path
- no new admin role, Team authority, repository, schema, or migration was introduced

## Future domain models

### GamerProfile

One Gamer Card per `(userId, gameId)`. Game-specific tag, bio, play style, challenge availability,
region/language/play-time metadata, showcase media, and timestamps belong here. Canonical account
name, username, and avatar remain on HOOMA identity sources.

### GamerPlatformIdentity

Gameplay identities use provider/type + handle/value + visibility. Examples: EA ID, PSN, Xbox,
Nintendo, Steam, Epic, mobile/game username, Other. Do not add one nullable column per provider.

### GamerSocialLink

Discord, Kik, YouTube, Twitch, TikTok, and Other stay separate from gameplay identities. Per-link
privacy is `PUBLIC`, `MATCHED_ONLY`, or `PRIVATE`, enforced by backend response shaping.

### GamerChallenge

V1 is same-game 1v1. States: `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`,
`RESULT_PENDING`, `COMPLETED`, `DISPUTED`. No self challenge, duplicate unresolved pair, or unsafe
state transition. Rematches create new records.

### GamerResultSubmission

The first reporter never determines truth alone. The opponent confirms/contests. Conflicts become
`DISPUTED`. Screenshots are evidence only. OCR never decides results. Draws are explicit.

### GamerSquad / GamerSquadMembership

A game-specific community with name/tag/description/logo/banner and `OPEN`, `REQUEST`, or
`INVITE_ONLY` join policy. Membership references `GamerProfile`; creator becomes `LEADER + ACTIVE`
atomically.

### Later ratings

Add ratings only after result truth is stable. Rating is per game, never one global cross-game Elo.

## Media URL policy

- HTTPS media URLs only.
- Reject unsafe protocols.
- Never blindly server-fetch arbitrary user URLs.
- Frontend must provide safe broken-image fallbacks and lazy/async loading.
- Do not create Gamers-only media storage.

## Frontend target

- `/gamers` = hero, My Gamer Cards, real catalog, honest loading/error/empty states.
- `/gamers/games/:gameId` = Challengers, Squads, Arena, and later Rankings.
- No fake global Whistle tab.
- Arena is a projection over `GamerChallenge`, never a standalone table.
- Squads have public pages plus private member HQs.

## API target

Use dedicated `/api/v1/gamers` routes with a Gamers rate-limit scope. Public reads cover games,
game detail, challengers, Gamer Profiles, and Squads. Protected routes cover Gamer Cards,
connections, challenges, Arena, results, and Squad lifecycle.

Platform Admin owns canonical game-catalog writes through existing app-level authority. Do not
create a second generic Gamers admin role.

## Implementation phases

### G0 - Source lock and coordination

Status: **COMPLETE**

- [x] Confirm repository and domain boundaries.
- [x] Inspect current main/open PR conflicts.
- [x] Confirm canonical `GAMER` identity exists.
- [x] Confirm no prior Gamers API/database domain existed.
- [x] Confirm no shared Whistle domain currently exists.
- [x] Inspect CI, Prisma schema-folder/migrations, and Platform Admin.
- [x] Merge living plan + GamerGame contracts in PR #57.

### G1 - Canonical game catalog and Gamers landing

Status: **IN PROGRESS**

- [x] GamerGame contracts and HTTPS media validation.
- [x] Prisma GamerGame model and real migration.
- [x] Repository/service normalization helpers and public catalog reads.
- [x] Public `/api/v1/gamers/games` routes.
- [x] Platform Admin catalog create/update/status/featured management.
- [ ] `/gamers` route and real landing page.
- [ ] Real game cards with loading/error/empty/image fallbacks.
- [ ] Enable Home Gamers action after the real route exists.
- [ ] Complete final G1 validation/evidence.

### G2 - Gamer Cards and privacy

Status: **NOT STARTED**

- [ ] GamerProfile, GamerPlatformIdentity, GamerSocialLink migrations.
- [ ] Unique `(userId, gameId)`.
- [ ] Backend `PUBLIC | MATCHED_ONLY | PRIVATE` enforcement.
- [ ] CRUD, create flow, public profile, My Gamer Cards.

### G3 - Challenger discovery

Status: **NOT STARTED**

- [ ] Game-specific challenger read model/filters.
- [ ] Challenger cards and honest availability.
- [ ] Backend-owned privacy.

### G4 - Gamer challenge and Arena

Status: **NOT STARTED**

- [ ] GamerChallenge migration/lifecycle.
- [ ] Same-game/no-self/eligibility/duplicate protections.
- [ ] Concurrency-safe transitions and Arena projection.
- [ ] No Arena table.

### G5 - Human-confirmed results

Status: **NOT STARTED**

- [ ] GamerResultSubmission migration.
- [ ] Submit/confirm/contest rules.
- [ ] First reporter cannot decide truth alone.
- [ ] Conflict => `DISPUTED`; screenshots remain non-authoritative.
- [ ] Draws, record projection, new-record rematches.

### G6 - Gamer Squads

Status: **NOT STARTED**

- [ ] GamerSquad and membership migrations.
- [ ] Same-game GamerProfile membership.
- [ ] Atomic creator leadership and join-policy permissions.
- [ ] Logo/banner URL flow, public page, HQ, leadership transfer.

### G7 - Rankings, hardening, moderation

Status: **NOT STARTED**

- [ ] Ranking only after stable result truth.
- [ ] Completed results only; per-game ratings only.
- [ ] Platform Admin dispute tooling if needed.
- [ ] Security/concurrency/performance review.

### G8 - Shared Whistle integration

Status: **BLOCKED ON SHARED WHISTLE DOMAIN**

- [ ] Re-check main for canonical shared Whistle.
- [ ] Add `GAMER_SQUAD` only through shared rules.
- [ ] Require active Squad membership and preserve transient-history rules.

## Completed implementation log

### 2026-08-23 - Foundation merged

- PR #57: living plan + GamerGame contracts.
- CI #449: full success.
- Merge SHA: `56e11e5c565a98899ef8d177b10af09f9839e16b`.

### 2026-08-23 - GamerGame schema merged

- PR #58: canonical game catalog schema + real migration.
- CI #453: final full success.
- Merge SHA: `e5bb2bd3aacb0eea9bd8159cd678cd09e3a43b51`.

### 2026-08-23 - Public catalog API merged

- PR #59: read-only public GamerGame repository/service/API boundary.
- CI #474: final full success after living-plan checkpoint.
- Merge SHA: `07b6130173259718473f41d087739b154efcd503`.

### 2026-08-23 - Platform Admin catalog management validated

- PR #60: canonical Platform Admin GamerGame create/update/status/featured management.
- CI #486: full success on code head `c7618ad5390215d9d4c96074d20e5ff67019fbdf`.
- All 90 tests passed; Prisma, migration deploy/status, architecture, lint, typecheck, formatting,
  build, and security passed.
- A temporary formatter diagnostic used during development was removed before this validated head.
- This living-plan update is the only change after that validated code head.

### Current resume point

Run final CI for this plan-only checkpoint, merge PR #60, then branch from the new `main` for the
real `/gamers` landing page. Re-check open PRs before frontend work. The landing must consume the
public GamerGame API, include honest loading/error/empty/broken-image states, and contain no
hardcoded production game catalog. Enable the Home Gamers Quick Action only after `/gamers` is
functional and validated.
