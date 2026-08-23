# HOOMA Gamers Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/gamers-game-catalog`
Current baseline main SHA: `56e11e5c565a98899ef8d177b10af09f9839e16b`

## Purpose

This is the canonical living implementation plan for HOOMA Gamers. Update it
after every successful implementation slice so another agent can resume from
repository state without reconstructing chat history.

Before every slice, reconcile this plan with current `main`, open PRs,
contracts, API routes, services, repositories, Prisma schema and migrations,
frontend routes/components, design-system sources, and tests. Repository truth
wins.

## Non-negotiable rules

- Work only in `funmarket/HOOMA` for this implementation.
- Treat `funmarket/HoomaUltimate` as reference-only.
- Fix/build at the source; no patches, duplicate paths, or workaround layers.
- Inspect current implementation before each change; do not guess.
- Canonical HOOMA `User` remains the only account identity.
- `GAMER` is an identity facet, not an authorization role.
- Keep Gamer data out of `PlayerProfile`.
- Keep `Team` and `GamerSquad` as separate domains.
- Never reuse Team membership, Coach authority, or `TeamChallenge` for Gamers.
- Keep server-side authorization and privacy authoritative.
- Use real Prisma migrations; never use `prisma db push` in production.
- Never patch the production database directly.
- Do not introduce fake data, fake rankings, or fake online/activity state.
- Do not create a permanent Gamers chat workaround.
- Integrate Whistle only through the canonical shared Whistle domain.
- Preserve Telegram and web authentication over the shared backend.
- Respect HOOMA design tokens, safe areas, accessibility, and bottom nav.
- Re-check open PRs before touching shared sources.
- A slice is complete only after validation passes and this plan is updated.

## Product promise

**FIND YOUR NEXT OPPONENT**

Secondary promise: **Challenge. Play. Prove it. Build your Squad.**

Core loop:
Discover -> Gamer Card -> Challenge -> Play externally -> Confirm result ->
Build Squad -> trustworthy per-game record and ranking.

## Verified architecture

- `GAMER` already exists in canonical identity contracts and Prisma.
- Profile UI already allows Gamer as a selected identity.
- Platform Admin is the canonical app-level authority boundary.
- `packages/database/prisma.config.ts` sets `schema: 'prisma'`.
- The full `packages/database/prisma/` schema folder is authoritative.
- Domain schema files may live under `packages/database/prisma/models/`.
- The committed timestamped migration chain is authoritative.
- Home PR #53 is merged and must remain preserved.
- No canonical shared Whistle domain is currently available for Gamers.

## Architectural invariants

- `User` = canonical account.
- `UserProfileIdentity(GAMER)` = identity facet only.
- `PlayerProfile` = football-player data only.
- `GamerProfile` = one user's identity for one video game.
- `Team` = football team.
- `GamerSquad` = game-specific gamer community.
- `TeamChallenge` = football-team challenge.
- `GamerChallenge` = gamer-vs-gamer competition.
- Coach/Assistant authority = Teams only.
- Gamer Squad Leader authority = Gamers only.
- Platform Admin = game catalog moderation and later dispute tooling.

Shared infrastructure is allowed. Shared business ownership is not.

## Target data model

### GamerGame

Canonical game catalog owned by Platform Admin.

Current fields: `id`, `slug`, `name`, `normalizedName`, `description`,
`logoUrl`, `coverUrl`, optional `publisher`, supported platforms, status,
featured state, and timestamps.

`slug` and `normalizedName` are database-unique. Users must not create duplicate
canonical games directly.

### GamerProfile

One Gamer Card per `(userId, gameId)`. It will hold game-specific gamer tag,
bio, play style, challenge availability, optional region/language/play-time
metadata, optional showcase media, and timestamps. Canonical account name,
username, and avatar remain on HOOMA identity sources.

### GamerPlatformIdentity

Store gameplay identities as provider/type plus handle/value and visibility.
Examples: EA ID, PSN, Xbox, Nintendo, Steam, Epic, mobile/game username, Other.
Do not add one nullable database column for every provider.

### GamerSocialLink

Store Discord, Kik, YouTube, Twitch, TikTok, and Other separately from gameplay
identities. Per-link privacy is `PUBLIC`, `MATCHED_ONLY`, or `PRIVATE`, enforced
by backend response shaping.

### GamerChallenge

V1 is same-game 1v1. States: `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`,
`EXPIRED`, `RESULT_PENDING`, `COMPLETED`, `DISPUTED`.

Rules: no self challenge, active game, target eligibility, no duplicate
unresolved pair, concurrency-safe transitions, and new records for rematches.

### GamerResultSubmission

The first reporter never determines truth alone. The opponent confirms or
contests. Conflicts become `DISPUTED`. Screenshots are evidence only. OCR never
decides results. Draws are explicit and have no winner profile.

### GamerSquad and GamerSquadMembership

Game-specific community with name, tag, description, `logoUrl`, `bannerUrl`,
and `OPEN`, `REQUEST`, or `INVITE_ONLY` join policy. Membership references
`GamerProfile`. Creator becomes `LEADER` + `ACTIVE` atomically.

### Later ratings

Add per-game ratings only after result truth is stable. Never use one global
cross-game rating.

## Media URL policy

- Accept HTTPS media URLs only.
- Reject unsafe protocols.
- Do not blindly server-fetch arbitrary user URLs.
- Use safe broken-image fallbacks and lazy/async image loading.
- Do not create Gamers-only media storage.

## Frontend target

- `/gamers` = hero, My Gamer Cards, real catalog, and honest states.
- `/gamers/games/:gameId` = Challengers, Squads, Arena, later Rankings.
- Do not add a fake global Whistle tab.
- Arena is a projection over `GamerChallenge`, never its own table.
- Squads have public pages plus private member HQs.

## API target

Use dedicated `/api/v1/gamers` routes with a Gamers rate-limit scope. Public
reads cover games, game detail, challengers, Gamer Profiles, and Squads.
Protected routes cover Gamer Cards, connections, challenges, Arena, results,
and Squad lifecycle.

Platform Admin owns canonical game catalog management through existing app-level
authority. Do not create a second generic Gamers admin role.

## Recommended source structure

- `packages/contracts/src/gamers.ts`
- `packages/database/prisma/models/gamers.prisma`
- `apps/api/src/modules/gamers/{domain,application,infrastructure,http}`
- `apps/miniapp/src/features/gamers/...`

## Whistle rule

Do not create `GamerChat`, `GamerMessage`, `SquadChat`, Arena comments, or a
permanent feed workaround. When shared Whistle exists, integrate Gamers through
that shared domain, preferably private `GAMER_SQUAD` context for active Squad
members.

## Implementation phases

### G0 - Source lock and coordination

Status: **COMPLETE**

- [x] Confirm `funmarket/HOOMA` and repository boundaries.
- [x] Re-check current main/open PR conflicts.
- [x] Confirm canonical `GAMER` identity exists.
- [x] Confirm no prior Gamers API/database domain exists.
- [x] Confirm no shared Whistle domain currently exists.
- [x] Inspect CI, Prisma schema-folder, migrations, and Platform Admin.
- [x] Merge living plan + GamerGame contracts in PR #57.

### G1 - Canonical game catalog and Gamers landing

Status: **IN PROGRESS**

- [x] GamerGame contracts and HTTPS-only media validation.
- [x] Prisma `GamerGame` model and real migration.
- [ ] Repository/service normalized name/slug rules and catalog reads.
- [ ] Public `/api/v1/gamers/games` reads.
- [ ] Platform Admin catalog management.
- [ ] `/gamers` route and real landing page.
- [ ] Real game cards with loading/error/empty/image fallbacks.
- [ ] Enable Home Gamers action after the route exists.
- [ ] Complete G1 full validation and update final evidence.

### G2 - Gamer Cards and privacy

Status: **NOT STARTED**

- [ ] GamerProfile, GamerPlatformIdentity, GamerSocialLink migrations.
- [ ] Unique `(userId, gameId)`.
- [ ] Backend PUBLIC/MATCHED_ONLY/PRIVATE enforcement.
- [ ] CRUD, create flow, public profile, and My Gamer Cards.

### G3 - Challenger discovery

Status: **NOT STARTED**

- [ ] Game-specific challenger read model and filters.
- [ ] Challenger cards and honest availability state.
- [ ] Backend-owned privacy.

### G4 - Gamer challenge and Arena

Status: **NOT STARTED**

- [ ] GamerChallenge migration and lifecycle.
- [ ] Same-game/no-self/eligibility/duplicate protections.
- [ ] Concurrency-safe transitions and Arena projection.
- [ ] No Arena table.

### G5 - Human-confirmed results

Status: **NOT STARTED**

- [ ] GamerResultSubmission migration.
- [ ] Submit/confirm/contest rules.
- [ ] First reporter cannot decide truth alone.
- [ ] Conflict => `DISPUTED`; screenshots remain non-authoritative.
- [ ] Draws, record projection, and new-record rematches.

### G6 - Gamer Squads

Status: **NOT STARTED**

- [ ] GamerSquad and GamerSquadMembership migrations.
- [ ] Same-game GamerProfile membership.
- [ ] Atomic creator leadership and join-policy permissions.
- [ ] Logo/banner URL flow, public page, HQ, leadership transfer.

### G7 - Rankings, hardening, moderation

Status: **NOT STARTED**

- [ ] Ranking only after stable G5 result truth.
- [ ] Completed results only; per-game rating only.
- [ ] Platform Admin dispute tooling if needed.
- [ ] Security, concurrency, and performance review.

### G8 - Shared Whistle integration

Status: **BLOCKED ON SHARED WHISTLE DOMAIN**

- [ ] Re-check main for canonical shared Whistle.
- [ ] Add `GAMER_SQUAD` only through shared rules.
- [ ] Require active Squad membership and preserve transient-history rules.

## Acceptance gates

Identity/boundaries:
One User; GAMER grants no admin authority; GamerProfile stays separate from
PlayerProfile; Team authority and TeamChallenge are never reused.

Privacy:
Gameplay IDs remain separate from social links; backend privacy is authoritative;
MATCHED_ONLY never leaks.

Challenges/results:
Same game, no self, no duplicate unresolved pair, correct authorization,
concurrency-safe transitions, human-confirmed truth, disputed conflicts, and
completed-only records/ratings.

Squads:
Same-game GamerProfile membership, atomic creator leadership, backend-owned
management permissions, and safe explicit leadership transfer.

Media/integration:
Unsafe protocols rejected; no blind server fetch; no fake data/stats/online
state/rankings; Telegram and web share backend truth; migrations and full CI
must pass before merge.

## Completed implementation log

### 2026-08-23 - Foundation merged

- PR #57: living plan + GamerGame contracts.
- CI #449: full success.
- Merge SHA: `56e11e5c565a98899ef8d177b10af09f9839e16b`.

### 2026-08-23 - GamerGame schema validated

- PR #58: canonical game catalog schema + migration.
- Code head validated by CI #452: full success.
- Prisma validation/generation, migration deploy/status, tests, formatting,
  build, and security all passed.
- This plan-only checkpoint is the final change before PR #58 merge.

### Current resume point

Finish final CI for this plan checkpoint, merge PR #58, then branch from the
new `main` for GamerGame repository/service normalization and public
`/api/v1/gamers/games` reads. Platform Admin catalog writes follow after the
public read boundary is stable.
