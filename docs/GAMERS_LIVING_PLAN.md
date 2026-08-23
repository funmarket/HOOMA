# HOOMA Gamers Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/gamers-foundation`
Baseline main SHA at plan creation: `60bde2aff23c491ea43ef95b716cd5e838053ce1`

## Purpose

This is the canonical living implementation plan for the HOOMA Gamers domain. It must be updated after every successfully completed implementation slice so future agents can resume from repository state instead of reconstructing work from chat history.

Before every slice, reconcile this plan with current `main`, open PRs, contracts, API routes, services, repositories, Prisma schema/migrations, frontend routes/components, design-system sources, and tests. Repository truth wins.

## Non-negotiable rules

- Work only in `funmarket/HOOMA` for this implementation.
- Treat `funmarket/HoomaUltimate` as reference-only.
- Fix and build at the source. No patches, wrappers, duplicate paths, or workaround layers.
- No guessing. Inspect current implementation before each change.
- Canonical HOOMA `User` remains the only account identity.
- `GAMER` is an identity facet, not an authorization role.
- `PLAYER` and `GAMER` are separate domains; never store gamer data in `PlayerProfile`.
- `Team` and `GamerSquad` are separate domains; never reuse Team membership, Coach authority, TeamChallenge, or Team service ownership for Gamers.
- Keep server-side authorization and privacy authoritative.
- Use real Prisma migrations for schema changes; never substitute `prisma db push` or direct production DB patching.
- No fake production data or fake online/activity state.
- No permanent Gamers chat workaround. Integrate Whistle only when current HOOMA has a canonical shared Whistle domain.
- Preserve Telegram/web auth and shared backend data.
- Respect existing HOOMA design tokens, safe areas, touch targets, accessibility, and bottom navigation.
- Re-check open PRs before editing shared files, especially Home, App routing, Prisma, contracts, and Platform Admin.
- A slice is not complete until validation is run and this plan is updated with evidence.

## Product promise

**FIND YOUR NEXT OPPONENT**

Secondary: **Challenge. Play. Prove it. Build your Squad.**

Core loop: Discover -> Gamer Card -> Challenge -> Play externally -> Submit/confirm result -> Build Squad -> trustworthy per-game record/ranking.

## Visual direction

Competitive, premium, modern football-gaming presentation inspired by EA SPORTS FC / console / esports interfaces without cloning them.

- Current HOOMA pitch-black / graphite surfaces, electric-lime accents, white text, restrained gold.
- Large game artwork/logos, strong competitive typography, VS treatments, platform chips, score treatments, subtle grid/noise.
- No childish visuals, excessive glow, unreadable neon-on-neon, or fake live indicators.
- Reuse shared CSS variables/primitives; add shared abstractions only when truly repeated.
- Mobile-first for Telegram widths, scaling cleanly to current app max width.

## Verified baseline at creation

- `main` SHA: `60bde2aff23c491ea43ef95b716cd5e838053ce1`.
- Canonical identity contracts and Prisma enum already include `GAMER`.
- Profile UI already allows Gamer as a selected identity.
- Home has a disabled Gamers Quick Action because no real `/gamers` route exists.
- API v1 router has no Gamers router.
- Prisma has no Gamer game/profile/challenge/squad models.
- No canonical shared Whistle module currently exists for Gamers.
- Open PRs at creation: #53 Home presentation, #33 Pitch owner drafts, stale #26 Pitch. Avoid Home edits while #53 is active unless reconciled first.

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
- Platform Admin = app-level authority for game catalog moderation and later dispute tooling.

Shared infrastructure is allowed; shared business ownership is not.

## Target data model

### GamerGame
Canonical game catalog owned by Platform Admin.

Fields target: `id`, `slug`, `name`, `normalizedName`, `description`, `logoUrl`, `coverUrl`, optional `publisher`, supported platforms, active/status, featured, timestamps.

Users must not directly create duplicate canonical games. Add a moderated game-suggestion flow later only if needed.

### GamerProfile
One Gamer Card per `(userId, gameId)`.

Fields target: gamer tag, short game bio, `CASUAL | COMPETITIVE | RANKED`, `openToChallenge`, optional region/language/play-time metadata, optional showcase image URL, timestamps. Canonical display name/avatar/username remain on the HOOMA account/profile sources.

### GamerPlatformIdentity
Gameplay IDs (EA ID, PSN, Xbox, Nintendo, Steam, Epic, game-specific username/mobile ID, Other). Model provider/type + handle/value + visibility; do not add one nullable column per provider.

### GamerSocialLink
Social/contact links (Discord, Kik, YouTube, Twitch, TikTok, Other). Per-link privacy: `PUBLIC | MATCHED_ONLY | PRIVATE`. Backend response shaping enforces visibility.

### GamerChallenge
V1 1v1, same-game only. States: `PENDING`, `ACCEPTED`, `DECLINED`, `CANCELLED`, `EXPIRED`, `RESULT_PENDING`, `COMPLETED`, `DISPUTED`.

Rules: no self challenge; same active game; target eligibility; no duplicate unresolved pair either direction; server-authorized concurrency-safe transitions; rematch creates a new row.

### GamerResultSubmission
First reporter never determines truth. Opponent confirms/contests; conflicts become `DISPUTED`; screenshot is evidence only; no OCR truth; draw is explicit with no winner profile.

### GamerSquad / GamerSquadMembership
Game-specific community with name/tag/description/logoUrl/bannerUrl and `OPEN | REQUEST | INVITE_ONLY`. Membership references `GamerProfile`; creator becomes `LEADER + ACTIVE` atomically. Initial roles: `LEADER`, `MEMBER` only.

### Later ratings
`GamerRating` and `GamerRatingHistory` only after result truth is stable. Rating is per game only; never global cross-game Elo.

## Media URL policy

For game/squad/profile/result media: HTTPS only; reject unsafe schemes; backend must not blindly server-fetch user URLs; frontend provides designed broken-image fallbacks and lazy/async loading where applicable. Do not create Gamers-only storage.

## Frontend architecture

- Home Gamers Quick Action enabled only after a real `/gamers` route exists and Home conflicts are reconciled.
- `/gamers`: hero, My Gamer Cards, real game catalog, search/filter as needed, real counts, empty/loading/error states.
- `/gamers/games/:gameId`: `Challengers | Squads | Arena | Rankings` (Rankings only when implemented). No fake global Whistle tab.
- Gamer Card flow: choose game -> gamer identity -> gameplay identities -> social links -> privacy -> preview/publish.
- Public Gamer Profile: canonical avatar/account identity + gamer tag/game/play style/open state/completed record/privacy-filtered handles+links/squads/challenge CTA.
- Challengers: platform/play-style/region/open filters where data supports them.
- Arena is a projection over `GamerChallenge`, never a standalone table.
- Squad creation includes game/name/tag/description/logo URL/banner URL/join policy/social links/live preview.
- Public Squad page + private member HQ with backend-owned leader/member permissions.

## API target

Dedicated `/api/v1/gamers` router with domain rate limit.

Public: games, game detail, challengers, public Gamer Profile, public Squads.
Protected: Gamer Card CRUD, platform identities, social links/privacy, challenge lifecycle, Arena, results, Squad lifecycle.
Platform Admin: canonical game catalog management under existing app-admin authority; no second generic Gamers admin role.

## Recommended source structure

- `packages/contracts/src/gamers.ts`
- `apps/api/src/modules/gamers/{domain,application,infrastructure,http}` following current repository conventions
- `apps/miniapp/src/features/gamers/...` plus Gamer pages/components following current feature conventions

Do not force this exact shape if source inspection shows a more canonical neighboring pattern.

## Whistle rule

Do not create GamerChat, GamerMessage, SquadChat, Arena comments, or a permanent feed workaround. When current HOOMA contains canonical shared Whistle, integrate Gamers through it, preferably private `GAMER_SQUAD` context for active Squad members under global Whistle rules.

## Implementation phases

### G0 - Source lock and coordination
Status: **IN PROGRESS**

- [x] Confirm target repo `funmarket/HOOMA`.
- [x] Re-check current main.
- [x] Re-check open PR conflicts.
- [x] Confirm identity already contains GAMER.
- [x] Confirm no Gamers API/schema domain exists.
- [x] Confirm no shared Whistle domain currently available.
- [x] Create `feat/gamers-foundation` from current main.
- [x] Create this living plan.
- [ ] Inspect current package scripts/quality gates.
- [ ] Inspect exact current Prisma/User relations and migration conventions immediately before schema editing.
- [ ] Inspect current app-admin patterns before game-catalog writes.

### G1 - Canonical game catalog and Gamers landing
Status: **NOT STARTED**

- [ ] GamerGame contracts and safe URL validation.
- [ ] Prisma GamerGame + real migration.
- [ ] Repository/service rules for normalized unique names/slugs and active catalog reads.
- [ ] Public `/api/v1/gamers/games` reads.
- [ ] Platform Admin catalog management.
- [ ] `/gamers` route + real landing.
- [ ] Real game cards + loading/error/empty/image fallbacks.
- [ ] Enable Home Gamers action only after Home conflict is reconciled.
- [ ] Validation passes.
- [ ] Update this plan with PR/SHA evidence.

### G2 - Gamer Cards and privacy
Status: **NOT STARTED**

- [ ] GamerProfile + GamerPlatformIdentity + GamerSocialLink migrations.
- [ ] unique `(userId, gameId)`.
- [ ] backend PUBLIC/MATCHED_ONLY/PRIVATE shaping.
- [ ] CRUD APIs + create flow + public profile + My Gamer Cards.
- [ ] no Gamer data in PlayerProfile.
- [ ] validation + plan update.

### G3 - Challenger discovery
Status: **NOT STARTED**

- [ ] game-specific challenger read model and filters.
- [ ] challenger cards.
- [ ] backend-only privacy enforcement.
- [ ] honest challenge availability state.
- [ ] validation + plan update.

### G4 - Gamer challenge and Arena
Status: **NOT STARTED**

- [ ] GamerChallenge migration.
- [ ] same-game/no-self/open rules.
- [ ] duplicate unresolved-pair protection.
- [ ] concurrency-safe transitions.
- [ ] challenge UI + Arena projection.
- [ ] no Arena table.
- [ ] validation + plan update.

### G5 - Human-confirmed results
Status: **NOT STARTED**

- [ ] GamerResultSubmission migration.
- [ ] submit/confirm/contest rules.
- [ ] first reporter cannot complete truth alone.
- [ ] conflict => DISPUTED.
- [ ] screenshot evidence never auto-decides.
- [ ] draw support + completed record projection.
- [ ] rematch creates new challenge.
- [ ] validation + plan update.

### G6 - Gamer Squads
Status: **NOT STARTED**

- [ ] GamerSquad + Membership migrations.
- [ ] membership references GamerProfile and same-game domain.
- [ ] creator LEADER+ACTIVE atomically.
- [ ] join policy + backend permissions.
- [ ] logo/banner URL form and fallbacks.
- [ ] create/public/HQ flows + leadership transfer.
- [ ] validation + plan update.

### G7 - Rankings, hardening, moderation
Status: **NOT STARTED**

- [ ] rankings only after G5 is stable.
- [ ] per-game rating only; COMPLETED results only.
- [ ] deterministic transparent rating logic/history as needed.
- [ ] Platform Admin dispute tooling if needed.
- [ ] security/concurrency/performance review.
- [ ] validation + plan update.

### G8 - Shared Whistle integration
Status: **BLOCKED ON SHARED WHISTLE DOMAIN**

- [ ] Re-check main for canonical shared Whistle.
- [ ] Integrate `GAMER_SQUAD` through shared rules only.
- [ ] active Squad membership required.
- [ ] no permanent body/history outside shared Whistle behavior.
- [ ] validation + plan update.

## Acceptance gates

Identity/boundaries: one User; GAMER grants no admin authority; GamerProfile separate from PlayerProfile; no Team authority or TeamChallenge reuse.

Profiles/privacy: one GamerProfile per user/game; platform IDs separate from social links; backend privacy enforced; MATCHED_ONLY never leaked.

Challenges/results: same game; no self; no duplicate unresolved pair; correct participant authorization; concurrency-safe transitions; first reporter not truth; conflict disputed; only COMPLETED affects record/rating.

Squads: game-specific; membership references same-game GamerProfile; atomic creator leadership; non-leader cannot manage; safe explicit leadership transfer.

Media: unsafe schemes rejected; no blind server fetch; broken images degrade safely.

Integration: no fake data/stats/online/rankings; `/gamers` works before Home action is enabled; Telegram/web share backend truth; migrations and quality gates pass.

## Completed implementation log

No implementation slice completed yet. Append dated entries here after each successful slice with branch/PR/merge SHA, files/domains changed, validation evidence, and next exact resume point.
