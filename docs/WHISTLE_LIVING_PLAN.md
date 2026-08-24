# HOOMA Whistle Living Implementation Plan

Last updated: 2026-08-24
Repository: `funmarket/HOOMA`
Release PR: `#61` — **MERGED**
Production release SHA: `f0a1df35373d8fcc6dbbb223735546c5efa92465`

## Purpose

This is the canonical living implementation ledger for HOOMA Whistle. Repository truth wins over chat history. Whistle V1 is now released for the Play/community surface. Future Team and ULTRAS boards must reuse this same domain rather than create parallel implementations.

## Non-negotiable product rules

1. Maximum body: **33 Unicode graphemes** after trimming.
2. Allowance: **11 Whistles per canonical HOOMA user per UTC calendar day across all Whistle contexts combined**.
3. Reset: exactly **00:00 UTC**; never a rolling 24-hour window.
4. Unused allowance never rolls over; every UTC day begins with 11.
5. Whistle bodies are transient and live in **Redis only**.
6. PostgreSQL must never persist Whistle body/history.
7. There is **no Whistle Prisma model or migration**.
8. Daily Redis quota/feed keys expire at the next UTC midnight using absolute expiry.
9. No 24-hour-per-message TTL and no 60-second per-viewer reveal TTL.
10. No permanent archive/history.
11. Notifications, if added later, must never persist the Whistle body.
12. Redis quota enforcement is atomic and global across contexts.
13. If Redis cannot enforce quota, Whistle fails closed while unrelated HOOMA features remain available.
14. Play/community Whistle requires authenticated active-community membership.
15. Future Team and ULTRAS boards reuse this exact shared quota/store/domain.

## Canonical architecture

### Shared contract

`packages/contracts/src/whistle.ts`

Owns constants, grapheme validation, and request/response schemas/types.

### UTC boundary

`apps/api/src/modules/whistle/domain/utc-day.ts`

Owns UTC day identity and exact next-midnight reset calculation.

### Redis runtime/store

- `apps/api/src/infrastructure/redis/client.ts`
- `apps/api/src/modules/whistle/application/whistle-store.ts`
- `apps/api/src/modules/whistle/infrastructure/redis-whistle.store.ts`

Canonical key families:

- `whistle:v1:quota:<YYYY-MM-DD>:<userId>`
- `whistle:v1:feed:<YYYY-MM-DD>:community:<communityId>`
- future Team/ULTRAS feeds use the same day namespace and global quota key

### API

- `apps/api/src/modules/whistle/application/whistle.service.ts`
- `apps/api/src/modules/whistle/http/whistle.controller.ts`

Routes:

- `GET /api/v1/whistles/communities/:communityId`
- `POST /api/v1/whistles/communities/:communityId`

The service reuses canonical authentication, `CommunityService.requireMembership()`, identity presentation, and the shared Redis store.

### Mini App

- `apps/miniapp/src/features/whistle/api.ts`
- `apps/miniapp/src/components/whistle/WhistleBoard.tsx`
- `apps/miniapp/src/components/whistle/WhistleBoard.css`
- `apps/miniapp/src/pages/PlayPage.tsx`

The V1 board is inline below `PlayHero`, preserves the canonical global proximity-ranked Play discovery feed, polls through React Query/shared HTTP architecture, and contains no likes/comments/threads/follows/permanent feed mechanics.

## Implementation ledger

### F1 — Contract + UTC boundary

Status: **VERIFIED COMPLETE**

Proof:

- contract/UTC implementation head `e7b1131ac2e5aa8ddbb25bb8f03ab53f57a35598`
- CI `#481` SUCCESS
- ledger head `7589497638be4e4dfcd9948bb5e7a60874bf7882`, CI `#483` SUCCESS
- permanent tests cover 33/34 boundaries, emoji grapheme clusters, whitespace rejection, UTC midnight and year rollover

Score: **10/10**

### F2 — Redis runtime foundation

Status: **VERIFIED COMPLETE**

Proof:

- pinned node-redis `5.8.2`
- lazy Redis lifecycle and fail-closed runtime
- local/CI Redis `7.4-alpine`
- production `REDIS_URL` validation
- corrected implementation head `38734ddceddf7b43286a3dadb757334765104196`, CI `#508` SUCCESS
- ledger head `43eb3b1a64a03c771f4af793dd5e76180eb24204`, CI `#510` SUCCESS

Score: **10/10**

### F3 — Atomic Redis Whistle store

Status: **VERIFIED COMPLETE**

Proof:

- atomic Lua send uses Redis server `TIME`
- one global user/day quota key
- exact absolute next-midnight `PEXPIREAT`
- 20 simultaneous sends across two scopes produced exactly **11 accepted / 9 limited**
- stale-day reads/writes are rejected
- corrupt/unavailable Redis fails closed
- final head `c97632c9ffc9275f164cd2238cf32c5c9722864b`, CI `#520` SUCCESS
- ledger head `80783a02a638a523f5e67b568a5da74e866f6b47`, CI `#521` SUCCESS

Score: **10/10**

### F4 — Application service + community API

Status: **VERIFIED COMPLETE**

Proof:

- membership gate precedes Redis access
- canonical identity presentation snapshot
- stable `429 WHISTLE_DAILY_LIMIT_REACHED`
- stable `503 WHISTLE_UNAVAILABLE`
- one fresh UTC-window retry across midnight
- shared cross-workspace Zod boundary fixed at source
- permanent service and real HTTP tests
- synchronized implementation head `94ae939e17d117ce14498ede970a86d2178f512b`, CI `#577` SUCCESS
- ledger head `aee7874ef9e3f49e22814352622ba4401545b54b`, CI `#580` SUCCESS

Score: **10/10**

### F5 — Play Whistle Board

Status: **VERIFIED COMPLETE**

Proof:

- synchronized against current global Play/Watch implementation before edits
- inline board below `PlayHero`, before Players/Open Matches
- global proximity-ranked Play discovery preserved
- shared-client GET/POST wrapper; no direct frontend `fetch`
- 15-second React Query polling
- server quota/reset metadata
- shared 33-grapheme counter
- loading/empty/unavailable/send-error/over-limit/exhausted states
- responsive HOOMA vintage styling; no `!important` or arbitrary z-index
- permanent UI source-contract tests
- cleaned implementation head `c228d522b43722b7f5fe31e9866abb0d0f3fc230`, CI `#592` SUCCESS with **144/144 tests**
- ledger head `9694fb5af923a0aaeade5371fc97ada7e1b0fbd8`, CI `#593` SUCCESS

Score: **10/10**

### F6 — Production Redis + release verification

Status: **VERIFIED COMPLETE**

Implemented:

- re-audited live Railway project before writes
- provisioned `HOOMA Redis` from `redis:7.4-alpine` in HOOMA production only
- Redis has private networking endpoint `hooma-redis` and **no public domain**
- no persistent Redis volume was added; Whistle remains transient
- staged API `REDIS_URL=redis://hooma-redis.railway.internal:6379`
- Mini App has no Redis variable
- generic `RATE_LIMIT_STORE` remains unchanged
- Railway documentation exposed the private-DNS socket requirement; `RedisRuntime` was fixed at source with `socket.family = 0`
- updated PR `#61` title/body from stale F1 scope to complete Whistle V1 scope
- PR `#61` was marked ready and merged with expected-head SHA protection

Proof:

- production-compatibility source head `27afc7402dff9e8c9ada0986844a7bf529f03792`
- CI `#594`, run ID `32676163281`: **SUCCESS** through install, preflight, DB validation/generation, architecture, lint, typecheck, migrations, tests, format, build, security and migration checks
- exact merged main SHA: `f0a1df35373d8fcc6dbbb223735546c5efa92465`
- Railway HOOMA Mini App deployment `bda8cfa0-971e-4c13-8ad8-1fe41d74d6e7`: **SUCCESS** on that exact SHA
- Railway HOOMA API deployment `66aecf13-38cf-410e-98b2-90c0e67976d7`: **SUCCESS** on that exact SHA
- API production startup found 14 migrations, reported no pending migrations, and reached `HOOMA API listening on :8080`
- Redis service status is **SUCCESS**, one production replica in `ams`
- final API variable audit confirms `REDIS_URL` exists
- final Mini App variable audit confirms no `REDIS_URL`

Created infrastructure:

- Railway production service `HOOMA Redis` (`fe231b22-3ee0-46ff-8f76-194f921a7d6e`)

Source modified in F6:

- `apps/api/src/infrastructure/redis/client.ts`
- this living plan

Intentionally untouched:

- Prisma schema/migrations: still no Whistle model/migration
- Team/ULTRAS Whistle surfaces
- Team, Gamers, RIDE, Watch, Chat and Notifications business domains
- generic rate-limit storage architecture
- `funmarket/HoomaUltimate`

Conflict/release status:

- current main was rechecked before merge and had not advanced beyond the synchronized Play/Watch base
- no other implementation PR remained open at the merge gate
- PR `#61` is merged; no unmerged Whistle implementation PR remains
- API and Mini App both deployed the exact merge SHA successfully

Known verification limit:

- tooling available here does not provide an authenticated real-user/community session or expose secret auth material, so an authenticated live POST/GET Whistle smoke request could not be performed without fabricating credentials. This is recorded rather than overclaimed. Redis correctness is covered by permanent real-Redis CI integration tests and production deployment/configuration proof.

Implementation score: **9/10**

Gate: **PASSED — Whistle V1 is released.**

### F7 — Team / ULTRAS integrations

Status: **BLOCKED UNTIL CANONICAL MEMBER SURFACES ARE STABLE**

When unblocked, reuse F1-F6 exactly. Do not create a new quota, store, Redis namespace authority, body persistence path, or parallel Whistle domain.

## Verification policy

- **10/10**: architecture correct, tests/CI green, no known defects/conflicts, and all applicable live behavior can be directly verified.
- **9/10**: implementation/release is correct and green, with a clearly documented non-blocking verification limitation.
- **8/10 or below**: do not advance; repair and retest the same slice.
