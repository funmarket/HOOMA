# HOOMA Gamers Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/gamers-cards-privacy-v1`
Current baseline main SHA: `8b513bae15649794cc396812b2d1b47675fd5b7d`

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
- Any authenticated HOOMA User can create a Gamer Card; Player, Team, admin, or pre-existing Gamer identity is never an eligibility gate.
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
- Team Control Room PR #62 is merged and its `/teams/:teamId/control` route is preserved.
- Gamers landing PR #64 is merged at `8b513bae15649794cc396812b2d1b47675fd5b7d` and deployed.
- Open Whistle PR #61 owns shared Redis/container/v1-router files; G2 intentionally avoids those files.

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

Platform Admin catalog behavior merged in PR #60:

- `POST /api/v1/app-admin/gamers/games`
- `PATCH /api/v1/app-admin/gamers/games/:gameId`
- existing `PlatformAdminService.requirePlatformAdmin` is the only authorization boundary
- name normalization and slug generation remain owned by the Gamers domain
- renaming a game regenerates both canonical `normalizedName` and `slug`
- Prisma unique races become stable `GAMER_GAME_CONFLICT` responses
- missing updates become stable `GAMER_GAME_NOT_FOUND` responses
- status and featured changes use the same canonical update path
- no new admin role, Team authority, repository, schema, or migration was introduced

## Current Gamer Card foundation

PR #65 establishes the first G2 slice:

- `GamerProfile` persists one Gamer Card per `(userId, gameId)`.
- `GamerPlatformIdentity` stores gameplay IDs separately from football Player data.
- `GamerSocialLink` stores Discord/Kik/YouTube/Twitch/TikTok/Other links separately from gameplay IDs.
- `PUBLIC | MATCHED_ONLY | PRIVATE` exists for the card and individual links.
- `CASUAL | COMPETITIVE | RANKED` play style is canonical.
- creating a Gamer Card requires canonical authentication and an active `GamerGame`, nothing else.
- creation atomically records the existing `GAMER` identity facet without creating a second account.
- public Gamer Card reads expose only PUBLIC cards and PUBLIC child links.
- `MATCHED_ONLY` remains hidden until an accepted GamerChallenge relationship exists; G2 does not fake that relationship.
- social URLs are HTTPS-only at the contract boundary.
- `/gamers` now exposes real My Gamer Cards and a real Create Gamer Card flow.

## Future domain models

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
- Gamer Card creation is available to every authenticated HOOMA User.
- Full Gamer Card editing and standalone public Gamer Card presentation remain to be completed in G2.
- `/gamers/games/:gameId` = Challengers, Squads, Arena, and later Rankings.
- No fake global Whistle tab.
- Arena is a projection over `GamerChallenge`, never a standalone table.
- Squads have public pages plus private member HQs.

## API target

Use dedicated `/api/v1/gamers` routes with a Gamers rate-limit scope. Public reads cover games,
game detail, challengers, Gamer Profiles, and Squads. Protected routes cover Gamer Cards,
connections, challenges, Arena, results, and Squad lifecycle.

Current G2 Gamer Card routes:

- `GET /api/v1/gamers/profiles/mine`
- `POST /api/v1/gamers/profiles`
- `GET /api/v1/gamers/profiles/mine/:profileId`
- `PATCH /api/v1/gamers/profiles/:profileId`
- `GET /api/v1/gamers/profiles/:profileId`

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

Status: **COMPLETE**

- [x] GamerGame contracts and HTTPS media validation.
- [x] Prisma GamerGame model and real migration.
- [x] Repository/service normalization helpers and public catalog reads.
- [x] Public `/api/v1/gamers/games` routes.
- [x] Platform Admin catalog create/update/status/featured management.
- [x] `/gamers` route and real landing page.
- [x] Real game cards with loading/error/empty/image fallbacks.
- [x] Enable Home Gamers action only after the real route exists.
- [x] Merge PR #64 and verify Railway production deployment at `8b513bae15649794cc396812b2d1b47675fd5b7d`.

### G2 - Gamer Cards and privacy

Status: **IN PROGRESS**

- [x] GamerProfile, GamerPlatformIdentity, GamerSocialLink contracts and Prisma models.
- [x] Real migration `20260823233000_add_gamer_profiles`.
- [x] Unique `(userId, gameId)`.
- [x] Any authenticated canonical User can create a Gamer Card; no Gamer-role authorization gate.
- [x] Active GamerGame required for creation.
- [x] Creation records the existing `GAMER` identity facet atomically.
- [x] Backend `PUBLIC | MATCHED_ONLY | PRIVATE` primitives and public-response enforcement.
- [x] Gameplay identities and social links have independent visibility.
- [x] Gamer Card create/update/mine/public API boundaries.
- [x] Real Create Gamer Card flow and My Gamer Cards on `/gamers`.
- [x] Permanent service tests for eligibility, duplicate prevention, inactive-game rejection, and privacy shaping.
- [x] Full code validation on head `e8fa602a5a5eb63b9d2b6858bd57139499c11a85` with CI #552; 97/97 tests, migration deploy, formatting, build, security, and migration consistency all passed.
- [ ] Full owner edit UI for existing Gamer Cards.
- [ ] Standalone public Gamer Card UI.
- [ ] UI for multiple gameplay identities/social links rather than one optional item during initial creation.
- [ ] Implement `MATCHED_ONLY` disclosure only after canonical accepted GamerChallenge context exists.

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

### 2026-08-23 - Platform Admin catalog management merged

- PR #60: canonical Platform Admin GamerGame create/update/status/featured management.
- CI #486: full success on code head `c7618ad5390215d9d4c96074d20e5ff67019fbdf`.
- Final CI #487 passed after the living-plan checkpoint.
- Merge SHA: `6e406be7381006caa5fffdee696f02d445f228f1`.
- All 90 tests passed; Prisma, migration deploy/status, architecture, lint, typecheck, formatting,
  build, and security passed.

### 2026-08-23 - Gamers landing and Home wiring merged

- PR #64: real `/gamers` Mini App landing and Home Quick Action wiring.
- CI #536: full success on code head `cde8add0343066e623cf55ba8dd1e12bedf59f85`.
- Final CI #537 passed after the living-plan checkpoint.
- Merge SHA: `8b513bae15649794cc396812b2d1b47675fd5b7d`.
- Railway HOOMA Mini App production deployed that exact merge SHA successfully.

### 2026-08-23 - G2 Gamer Card foundation validated

- PR #65: authenticated Gamer Card persistence, API, privacy foundation, and interactive creation flow.
- Coordinated around open Whistle PR #61 by making no changes to Redis, bootstrap container, server, or v1 router ownership.
- Migration `20260823233000_add_gamer_profiles` creates GamerProfile, GamerPlatformIdentity, and GamerSocialLink with canonical foreign keys and indexes.
- Any authenticated HOOMA User can create a Gamer Card for an active game; no Player/Team/admin/Gamer-role gate exists.
- Public response shaping hides non-public cards and non-public platform/social data.
- Temporary formatter diagnostics were fully removed before the validated code head.
- CI #552: full success on code head `e8fa602a5a5eb63b9d2b6858bd57139499c11a85`.
- 97/97 tests passed; Prisma validate/generate, architecture, lint, typecheck, migration deploy, formatting, build, security, and migration consistency all passed.
- This is a coherent G2 foundation slice, not full G2 completion.

### Current resume point

Run final CI for this living-plan-only checkpoint and merge PR #65 if green. Verify both the HOOMA
API and HOOMA Mini App Railway production services deploy the resulting main SHA. Then continue G2
with owner editing, multi-link management, and standalone public Gamer Card presentation before
starting challenger discovery. Re-check open PR ownership first.
