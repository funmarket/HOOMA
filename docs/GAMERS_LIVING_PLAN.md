# HOOMA Gamers Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/gamers-game-catalog`
Current baseline main SHA: `56e11e5c565a98899ef8d177b10af09f9839e16b`

## Purpose

This is the canonical living implementation plan for the HOOMA Gamers domain.
Update it after every successful implementation slice so another agent can
resume from repository state without reconstructing work from chat history.

Before every slice, reconcile this plan with current `main`, open PRs,
contracts, API routes, services, repositories, Prisma schema and migrations,
frontend routes and components, design-system sources, and tests.
Repository truth wins.

## Non-negotiable rules

- Work only in `funmarket/HOOMA` for this implementation.
- Treat `funmarket/HoomaUltimate` as reference-only.
- Fix and build at the source; do not add patches or workaround layers.
- Inspect current implementation before each change; do not guess.
- Canonical HOOMA `User` remains the only account identity.
- `GAMER` is an identity facet, not an authorization role.
- Keep Gamer data out of `PlayerProfile`.
- Keep `Team` and `GamerSquad` as separate domains.
- Never reuse Team membership, Coach authority, or `TeamChallenge` for Gamers.
- Keep server-side authorization and privacy authoritative.
- Use real Prisma migrations; never use `prisma db push` in production.
- Never patch the production database directly.
- Do not introduce fake production data or fake online/activity state.
- Do not create a permanent Gamers chat workaround.
- Integrate Whistle only through the canonical shared Whistle domain.
- Preserve Telegram and web authentication over the shared backend data.
- Respect HOOMA design tokens, safe areas, accessibility, and bottom nav.
- Re-check open PRs before editing shared files.
- Do not call a slice complete until validation passes and this plan is updated.

## Product promise

**FIND YOUR NEXT OPPONENT**

Secondary promise: **Challenge. Play. Prove it. Build your Squad.**

Core loop:
Discover -> Gamer Card -> Challenge -> Play externally -> Confirm result ->
Build Squad -> trustworthy per-game record and ranking.

## Visual direction

Build a premium football-gaming presentation inspired by modern console and
esports interfaces without cloning another product.

- Use HOOMA pitch-black and graphite surfaces.
- Use electric-lime accents, white text, and restrained gold.
- Use large game artwork, competitive typography, VS treatments, and chips.
- Avoid excessive glow, unreadable neon, childish visuals, and fake live state.
- Reuse shared CSS variables and UI primitives.
- Design mobile-first for Telegram, then scale to the current app max width.

## Verified baseline

- `GAMER` already exists in the canonical identity contract and Prisma enum.
- Profile UI already lets a user select Gamer as an identity.
- There is no canonical Gamers API or database domain on current main.
- There is no shared Whistle domain available for Gamers on current main.
- Home had a disabled Gamers Quick Action because `/gamers` did not exist.
- Home PR #53 has merged and must be preserved when Home is later updated.
- Platform Admin is the canonical app-level authority boundary.
- `packages/database/prisma.config.ts` sets `schema: 'prisma'`.
- The full `packages/database/prisma/` schema folder is authoritative.
- Existing domain schema files live under `packages/database/prisma/models/`.
- The committed timestamped migration chain is authoritative.

## Architectural invariants

- `User` = canonical account.
- `UserProfileIdentity(GAMER)` = identity facet only.
- `PlayerProfile` = football-player data only.
- `GamerProfile` = one user's identity for one video game.
- `Team` = football team.
- `GamerSquad` = game-specific gamer community.
- `TeamChallenge` = football-team challenge.
- `GamerChallenge` = gamer-vs-gamer competition.
- Coach and Assistant authority = Teams only.
- Gamer Squad Leader authority = Gamers only.
- Platform Admin = game catalog moderation and later dispute tooling.

Shared infrastructure is allowed. Shared business ownership is not.

## Target data model

### GamerGame

Canonical game catalog owned by Platform Admin.

Target fields include `id`, `slug`, `name`, `normalizedName`, `description`,
`logoUrl`, `coverUrl`, optional `publisher`, supported platforms, status,
featured state, and timestamps.

Users must not create duplicate canonical games directly.

### GamerProfile

One Gamer Card per `(userId, gameId)`.

Target data includes gamer tag, short bio, play style, challenge availability,
optional region/language/play-time metadata, optional showcase image, and
timestamps. Canonical display name, username, and avatar remain account data.

### GamerPlatformIdentity

Store gameplay identities as provider/type plus handle/value and visibility.
Examples include EA ID, PSN, Xbox, Nintendo, Steam, Epic, mobile game ID,
game-specific username, and Other.

Do not add one nullable database column for every provider.

### GamerSocialLink

Store Discord, Kik, YouTube, Twitch, TikTok, and Other separately from gameplay
identities. Per-link privacy is `PUBLIC`, `MATCHED_ONLY`, or `PRIVATE`.
Privacy must be enforced by backend response shaping.

### GamerChallenge

V1 is 1v1 and same-game only.

States:
`PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`,
`RESULT_PENDING`, `COMPLETED`, `DISPUTED`.

Rules include no self challenge, active game requirement, target eligibility,
no duplicate unresolved pair, concurrency-safe transitions, and new records
for rematches.

### GamerResultSubmission

The first reporter never determines truth alone. The opponent confirms or
contests. Conflicts become `DISPUTED`. Screenshots are evidence only. OCR must
not decide results. Draws are explicit and have no winner profile.

### GamerSquad and GamerSquadMembership

A Squad is a game-specific gamer community with name, tag, description,
`logoUrl`, `bannerUrl`, and join policy.

Join policy values:
`OPEN`, `REQUEST`, `INVITE_ONLY`.

Membership references `GamerProfile`. The creator becomes `LEADER` and
`ACTIVE` atomically. Initial roles are `LEADER` and `MEMBER` only.

### Later ratings

Add `GamerRating` and `GamerRatingHistory` only after result truth is stable.
Ratings are per game only and never global cross-game Elo.

## Media URL policy

- Accept HTTPS media URLs only.
- Reject unsafe protocols.
- Do not blindly server-fetch arbitrary user URLs.
- Use safe broken-image fallbacks in the frontend.
- Use lazy and async image loading where appropriate.
- Do not create Gamers-only media storage.

## Frontend target

- `/gamers` = hero, My Gamer Cards, real catalog, and honest states.
- `/gamers/games/:gameId` = Challengers, Squads, Arena, and later Rankings.
- Do not add a fake global Whistle tab.
- Gamer Card flow covers game, gamer identity, gameplay IDs, social links,
  privacy, preview, and publish.
- Public Gamer Profile uses canonical HOOMA presentation plus game data.
- Arena is a projection over `GamerChallenge`, never its own table.
- Squad creation includes logo/banner image URLs and a live preview.
- Squads have a public page plus a private member HQ.

## API target

Use a dedicated `/api/v1/gamers` router with a Gamers rate-limit scope.

Public reads cover games, game detail, challengers, Gamer Profiles, and Squads.
Protected routes cover Gamer Cards, connections, challenges, Arena, results,
and Squad lifecycle.

Platform Admin owns canonical game catalog management through existing app-level
authority. Do not create a second generic Gamers admin role.

## Recommended source structure

- `packages/contracts/src/gamers.ts`
- `packages/database/prisma/models/gamers.prisma`
- `apps/api/src/modules/gamers/{domain,application,infrastructure,http}`
- `apps/miniapp/src/features/gamers/...`
- Gamer pages/components following current Mini App conventions

Do not force this exact shape if current source inspection shows a more
canonical neighboring pattern.

## Whistle rule

Do not create `GamerChat`, `GamerMessage`, `SquadChat`, Arena comments, or a
permanent feed workaround. When shared Whistle exists, integrate Gamers through
that shared domain, preferably with private `GAMER_SQUAD` context for active
Squad members.

## Implementation phases

### G0 - Source lock and coordination

Status: **COMPLETE**

- [x] Confirm target repository `funmarket/HOOMA`.
- [x] Re-check current main and open PR conflicts.
- [x] Confirm identity already contains `GAMER`.
- [x] Confirm no Gamers API/schema domain exists.
- [x] Confirm no shared Whistle domain is currently available.
- [x] Create and merge the Gamers foundation plan and contracts.
- [x] Inspect package scripts and CI quality gates.
- [x] Inspect Prisma schema-folder and migration conventions.
- [x] Inspect current Platform Admin authority boundary.

### G1 - Canonical game catalog and Gamers landing

Status: **IN PROGRESS**

- [x] Add GamerGame contracts and HTTPS-only media validation.
- [ ] Add Prisma `GamerGame` and a real migration.
- [ ] Add normalized unique name/slug repository and service rules.
- [ ] Add public `/api/v1/gamers/games` reads.
- [ ] Add Platform Admin catalog management.
- [ ] Add `/gamers` route and real landing page.
- [ ] Add real game cards and loading/error/empty/image fallback states.
- [ ] Enable Home Gamers action after route and Home reconciliation.
- [ ] Pass full CI.
- [ ] Update this plan with PR and merge evidence.

### G2 - Gamer Cards and privacy

Status: **NOT STARTED**

- [ ] Add GamerProfile, GamerPlatformIdentity, and GamerSocialLink migrations.
- [ ] Enforce unique `(userId, gameId)`.
- [ ] Enforce PUBLIC/MATCHED_ONLY/PRIVATE on the backend.
- [ ] Add CRUD, creation flow, public profile, and My Gamer Cards.
- [ ] Verify no Gamer data enters `PlayerProfile`.

### G3 - Challenger discovery

Status: **NOT STARTED**

- [ ] Add game-specific challenger read model and real filters.
- [ ] Add challenger cards.
- [ ] Keep privacy backend-owned.
- [ ] Show honest challenge availability state.

### G4 - Gamer challenge and Arena

Status: **NOT STARTED**

- [ ] Add GamerChallenge migration.
- [ ] Enforce same-game, no-self, and target eligibility rules.
- [ ] Block duplicate unresolved pairs.
- [ ] Make transitions concurrency-safe.
- [ ] Add challenge UI and Arena projection.
- [ ] Do not create an Arena table.

### G5 - Human-confirmed results

Status: **NOT STARTED**

- [ ] Add GamerResultSubmission migration.
- [ ] Add submit, confirm, and contest rules.
- [ ] Prevent the first reporter from deciding truth alone.
- [ ] Resolve conflicting reports to `DISPUTED`.
- [ ] Keep screenshot evidence non-authoritative.
- [ ] Support draws and completed record projection.
- [ ] Make rematch create a new challenge.

### G6 - Gamer Squads

Status: **NOT STARTED**

- [ ] Add GamerSquad and GamerSquadMembership migrations.
- [ ] Reference GamerProfile and enforce the same-game domain.
- [ ] Create Leader + Active membership atomically.
- [ ] Add join policy and backend permissions.
- [ ] Add logo/banner URL form and fallbacks.
- [ ] Add create, public page, HQ, and leadership transfer flows.

### G7 - Rankings, hardening, moderation

Status: **NOT STARTED**

- [ ] Add ranking only after G5 is stable.
- [ ] Count only `COMPLETED` results.
- [ ] Keep rating per game.
- [ ] Add deterministic rating history if needed.
- [ ] Add Platform Admin dispute tooling if needed.
- [ ] Run security, concurrency, and performance review.

### G8 - Shared Whistle integration

Status: **BLOCKED ON SHARED WHISTLE DOMAIN**

- [ ] Re-check main for canonical shared Whistle.
- [ ] Integrate `GAMER_SQUAD` only through shared rules.
- [ ] Require active Squad membership.
- [ ] Preserve shared transient-body and history rules.

## Acceptance gates

Identity and boundaries:
One User; GAMER grants no admin authority; GamerProfile stays separate from
PlayerProfile; Team authority and TeamChallenge are never reused.

Profiles and privacy:
One GamerProfile per user/game; gameplay IDs remain separate from social links;
backend privacy is authoritative; MATCHED_ONLY never leaks.

Challenges and results:
Same game; no self challenge; no duplicate unresolved pair; correct participant
authorization; concurrency-safe transitions; first reporter is not truth;
conflicts are disputed; only completed results affect records or ratings.

Squads:
Game-specific membership references the same-game GamerProfile; creator
leadership is atomic; non-leaders cannot manage; leadership transfer is
explicit and safe.

Media:
Unsafe protocols are rejected; no blind server fetch occurs; broken images
degrade safely.

Integration:
No fake data, stats, online state, or rankings. `/gamers` must work before Home
is enabled. Telegram and web share backend truth. Migrations and full CI must
pass before a slice is marked complete.

## Completed implementation log

### 2026-08-23 - Foundation merged

- PR #57: `feat(gamers): establish living plan and game catalog contracts`.
- Full CI run #449 passed.
- Merge SHA: `56e11e5c565a98899ef8d177b10af09f9839e16b`.
- Added the canonical living plan and GamerGame wire contracts.
- No database/runtime behavior was introduced in that slice.

### Current resume point

Branch: `feat/gamers-game-catalog`.

Implement `GamerGame` in the Prisma schema folder with a real migration, run
full CI through a focused PR, update this plan with the successful evidence,
merge it, then continue with repository/service/public API catalog reads.
