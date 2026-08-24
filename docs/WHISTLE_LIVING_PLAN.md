# HOOMA Whistle Living Implementation Plan

Last updated: 2026-08-24
Repository: `funmarket/HOOMA`
Working branch: `feat/whistle-foundation-v1`
Draft PR: `#61`

## Purpose

This is the canonical living plan for the shared HOOMA Whistle domain. Repository truth wins over chat history. Update this ledger after every verified implementation slice.

## Non-negotiable working rules

- Work only in `funmarket/HOOMA`.
- Treat `funmarket/HoomaUltimate` as read-only reference only.
- Re-read current `main` and open PRs before every slice and before declaring a slice complete.
- Fix/build at the source. No patches, duplicate domains, workaround stores, or parallel authority systems.
- One shared Whistle quota applies across every Whistle context.
- Whistle must not become permanent chat or a permanent social feed.
- No Whistle message body may be persisted in PostgreSQL.
- No Prisma Whistle model or migration unless the product rules explicitly change later.
- Redis is the authoritative transient Whistle store.
- A slice advances only after evidence and an implementation score above 8/10.
- Every verified slice records proof, created/modified files, intentionally untouched files, conflict status, score, and next gate.

## Canonical product rules

1. Maximum message size: **33 Unicode graphemes** after trimming.
2. Daily allowance: **11 Whistles per canonical HOOMA user across all contexts combined**.
3. Quota window: UTC calendar day, never rolling 24 hours.
4. Reset: **00:00 UTC** every day.
5. Unused allowance does not roll over; every new UTC day starts at 11.
6. Prior-day Whistles become inaccessible at midnight UTC and their Redis keys expire at that same boundary.
7. No 24-hour-per-message TTL.
8. No 60-second per-viewer expiry/reveal state.
9. No permanent message archive/history.
10. PostgreSQL must not contain Whistle body/history copies.
11. Notifications, if added later, must never persist the Whistle body.
12. Redis quota enforcement must be atomic so concurrent sends cannot exceed 11.
13. If Redis cannot enforce quota, Whistle fails closed while unrelated HOOMA features remain available.
14. V1 Play Whistle reads/writes require an authenticated active community member.
15. Future Team and ULTRAS boards reuse the same domain and global user/day quota.

## Canonical architecture

### Contracts

`packages/contracts/src/whistle.ts`

Owns constants, grapheme-aware validation, response schemas, and shared request/response types.

### UTC day boundary

`apps/api/src/modules/whistle/domain/utc-day.ts`

Owns UTC day identity, start/reset timestamps, and current-window validation.

### Redis runtime/store

- `apps/api/src/infrastructure/redis/client.ts`
- `apps/api/src/modules/whistle/application/whistle-store.ts`
- `apps/api/src/modules/whistle/infrastructure/redis-whistle.store.ts`

Canonical key families:

- `whistle:v1:quota:<YYYY-MM-DD>:<userId>`
- `whistle:v1:feed:<YYYY-MM-DD>:community:<communityId>`
- future Team/ULTRAS feeds use the same day namespace and global quota key

Every Whistle Redis key uses absolute expiry at the canonical next UTC midnight.

### Service / HTTP

- `apps/api/src/modules/whistle/application/whistle.service.ts`
- `apps/api/src/modules/whistle/http/whistle.controller.ts`

V1 routes:

- `GET /api/v1/whistles/communities/:communityId`
- `POST /api/v1/whistles/communities/:communityId`

The service reuses canonical authentication, community membership, and identity presentation.

### Mini App

- `apps/miniapp/src/features/whistle/api.ts`
- `apps/miniapp/src/components/whistle/WhistleBoard.tsx`
- `apps/miniapp/src/components/whistle/WhistleBoard.css`
- `apps/miniapp/src/pages/PlayPage.tsx`

The V1 board is inline beneath the Play hero. It uses the shared HTTP client, React Query, shared Whistle contracts, and HOOMA visual tokens. No likes, comments, threads, follows, modal feed, or permanent history.

## Implementation ledger

### F1 — Canonical contract + UTC calendar boundary

Status: **VERIFIED COMPLETE**

Implemented:

- `WHISTLE_DAILY_LIMIT = 11`
- `WHISTLE_MAX_GRAPHEMES = 33`
- `Intl.Segmenter` grapheme validation
- canonical UTC day/start/reset helper
- permanent Unicode, 33/34 boundary, whitespace, midnight, and year-rollover tests

Proof:

- implementation head `e7b1131ac2e5aa8ddbb25bb8f03ab53f57a35598`
- CI `#481`, run ID `32666033801`: **SUCCESS**
- verification-ledger head `7589497638be4e4dfcd9948bb5e7a60874bf7882`
- CI `#483`: **SUCCESS**

Created:

- `packages/contracts/src/whistle.ts`
- `apps/api/src/modules/whistle/domain/utc-day.ts`
- `tests/whistle-contract.test.ts`
- `tests/whistle-utc-day.test.ts`
- this living plan

Modified:

- `packages/contracts/src/index.ts`

Intentionally untouched: Redis, Railway, Prisma Whistle persistence, API Whistle routes, Play UI, Team/Gamers/Chat/Notifications.

Conflict status: no concurrent Team/Gamers business source touched.

Implementation score: **10/10**

Gate: **PASSED**

### F2 — Redis runtime foundation

Status: **VERIFIED COMPLETE**

Implemented:

- pinned `redis = 5.8.2`
- lazy isolated `RedisRuntime`
- stable `RedisUnavailableError`
- production `REDIS_URL` validation
- graceful shutdown
- local and CI Redis `7.4-alpine`
- production deploy-preflight requirement
- permanent runtime tests

Proof:

- first CI `#507` correctly stopped on a TypeScript boundary; no advancement
- corrected implementation head `38734ddceddf7b43286a3dadb757334765104196`
- CI `#508`, run ID `32667143503`: **SUCCESS**
- ledger head `43eb3b1a64a03c771f4af793dd5e76180eb24204`
- CI `#510`: **SUCCESS**
- `npm ci`: 0 vulnerabilities

Created:

- `apps/api/src/infrastructure/redis/client.ts`
- `tests/redis-runtime.test.ts`

Modified:

- `apps/api/package.json`
- `package-lock.json`
- `apps/api/src/config/env.ts`
- `apps/api/src/bootstrap/container.ts`
- `apps/api/src/bootstrap/server.ts`
- `.env.example`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `scripts/deploy-preflight.mjs`

Intentionally untouched: Prisma Whistle persistence, Whistle API, Play UI, Railway production, Team/Gamers/Chat/Notifications, generic rate-limit storage.

Conflict status: concurrent Team/Gamers lanes inspected; no duplicate business logic introduced.

Implementation score: **10/10**

Gate: **PASSED**

### F3 — Atomic Redis Whistle store

Status: **VERIFIED COMPLETE**

Implemented:

- one global user/day quota key across all Whistle scopes
- Redis Stream daily feed keys
- atomic Lua send using Redis server `TIME`
- exact 11/day concurrency enforcement
- absolute `PEXPIREAT` at next 00:00 UTC
- stale-window rejection
- unavailable/corrupt Redis fail-closed behavior
- transient author snapshot only; no PostgreSQL persistence

Proof:

- CI `#514` correctly stopped on node-redis `TIME` typing; no advancement
- CI `#515` passed typecheck and **108/108 tests**, stopping only on formatting
- final implementation head `c97632c9ffc9275f164cd2238cf32c5c9722864b`
- CI `#520`, run ID `32668386562`: **SUCCESS**
- ledger head `80783a02a638a523f5e67b568a5da74e866f6b47`
- CI `#521`: **SUCCESS**
- 20 concurrent sends across two scopes => exactly **11 accepted / 9 limited**
- feed total remained 11; quota became `{ used: 11, remaining: 0 }`
- quota/feed expiry exactly matched next UTC midnight
- stale-day operations exposed no stale data and created no quota key

Created:

- `apps/api/src/modules/whistle/application/whistle-store.ts`
- `apps/api/src/modules/whistle/infrastructure/redis-whistle.store.ts`
- `tests/redis-whistle-store.test.ts`

Modified: this living plan only for verification.

Intentionally untouched: Prisma Whistle persistence, Whistle HTTP/service, Play UI, Railway production, Team/Gamers/Chat/Notifications.

Conflict status: synthetic merge against then-current main passed all repository gates.

Implementation score: **10/10**

Gate: **PASSED**

### F4 — Whistle application service + community API

Status: **VERIFIED COMPLETE**

Implemented:

- active-community membership gate before Redis
- GET/POST community Whistle routes
- shared response contracts with day, limit, remaining, resetAt and items
- canonical `effectiveDisplayName` / `effectivePhotoUrl` snapshot
- stable `429 WHISTLE_DAILY_LIMIT_REACHED`
- stable `503 WHISTLE_UNAVAILABLE`
- current-day-only reads and one fresh-window retry across midnight
- shared cross-workspace Zod error recognition so contract errors return canonical 400
- API docs and permanent service/HTTP tests

Proof:

- CI `#526` stopped on canonical identity `Promise<unknown>` boundary; no advancement
- CI `#530` passed typecheck and 114/115 tests; exposed shared Zod boundary bug
- source-level error boundary fix made **115/115 tests pass** in CI `#531`; format only remained
- pre-sync cleanup head `54681f80ebd165d5b6abba0dbea3758cd9be2e0b`
- CI `#565`, run ID `32672711143`: **SUCCESS**
- synchronization PR `#71` proved clean merge with then-current main
- synchronized head `94ae939e17d117ce14498ede970a86d2178f512b`
- CI `#577`, run ID `32675147217`: **SUCCESS**
- F4 ledger head `aee7874ef9e3f49e22814352622ba4401545b54b`
- CI `#580`: **SUCCESS**

Created:

- `apps/api/src/modules/whistle/application/whistle.service.ts`
- `apps/api/src/modules/whistle/http/whistle.controller.ts`
- `tests/whistle-service.test.ts`
- `tests/whistle-http.test.ts`

Modified:

- `packages/contracts/src/whistle.ts`
- `apps/api/src/bootstrap/container.ts`
- `apps/api/src/http/v1/router.ts`
- `apps/api/src/http/middleware/error-handler.ts`
- `docs/API.md`

Intentionally untouched: Prisma Whistle persistence, Play Mini App UI, Railway production, Team/Gamers/Chat/Notifications, generic rate-limit architecture.

Conflict status: synchronized head included then-current main and passed all shared router/container/repository gates.

Implementation score: **10/10**

Gate: **PASSED**

### F5 — Play Whistle Board

Status: **VERIFIED COMPLETE**

Implemented:

- inline Whistle Board directly beneath `PlayHero` and before Players/Open Matches
- preserved canonical global proximity-ranked Play discovery from current main
- shared-client API wrapper for current community feed/send routes
- React Query polling every 15 seconds with background polling disabled
- immediate cache update plus canonical invalidation after send
- server-provided `day`, `remaining`, `dailyLimit`, and `resetAt` presentation
- shared `countWhistleGraphemes()` and `WHISTLE_MAX_GRAPHEMES` client feedback; server remains authoritative
- quota-exhausted send lockout
- loading, empty, unavailable/error, mutation-error, and over-limit states
- avatar/name/body/relative-time terrace rows
- responsive HOOMA vintage styling using existing tokens
- no likes/comments/threads/follows and no direct frontend `fetch`
- permanent Mini App source-contract tests

Proof:

- before F5, current main had advanced to `dbff53f220e71c863b1417a4c77ddab09dc66867` with global proximity-ranked Play/Watch feeds
- temporary synchronization PR `#73` proved a clean merge before touching Play
- Whistle branch synchronized to combined head `835a4b9d755e1e3f3e9a1c616e9e5ffe27f53205`
- first F5 implementation CI `#589`, run ID `32675628861`, passed architecture, lint, typecheck, migrations and **144/144 tests**; only repository formatting failed on two new files
- repository-pinned Prettier changed only `WhistleBoard.css` and `features/whistle/api.ts`; temporary formatter workflow was deleted
- exact cleaned F5 head `c228d522b43722b7f5fe31e9866abb0d0f3fc230`
- CI `#592`, run ID `32675779105`: **SUCCESS** across install, preflight, DB validation/generation, architecture, lint, typecheck, migrations, **144/144 tests**, formatting, build, security and migration checks
- final concurrency check: current main remained `dbff53f220e71c863b1417a4c77ddab09dc66867`
- final open-PR check: only Whistle PR `#61` remained open

Created:

- `apps/miniapp/src/features/whistle/api.ts`
- `apps/miniapp/src/components/whistle/WhistleBoard.tsx`
- `apps/miniapp/src/components/whistle/WhistleBoard.css`
- `tests/whistle-ui.test.ts`

Modified:

- `apps/miniapp/src/pages/PlayPage.tsx`
- this living plan

Intentionally untouched:

- canonical Play proximity/ranking helper and backend discovery source
- Prisma schema/migrations: still no Whistle model/migration
- Team, Gamers, RIDE, Watch, Chat and Notifications business domains
- Railway production infrastructure
- `funmarket/HoomaUltimate`

Conflict status:

- F5 started only after synchronizing to the current global Play/Watch main implementation.
- No other open implementation PR existed at the final conflict gate except Whistle `#61`.
- The exact cleaned head passed the complete repository CI pipeline.

Implementation score: **10/10**

Gate: **PASSED — F6 may begin after this ledger-only head passes exact-head CI.**

### F6 — Production Redis + release verification

Status: **PENDING**

Deliverables:

- re-audit current Railway project/services/config before writes
- provision private Redis in the HOOMA Railway project only
- wire API `REDIS_URL` by private reference/secret; no Mini App Redis variable
- keep generic `RATE_LIMIT_STORE=memory` unless separately redesigned
- exact-head full CI and final conflict audit
- update PR `#61` title/body to reflect the complete Whistle V1 scope
- merge exact verified PR head with expected-head protection
- verify HOOMA API and Mini App deploy the exact merged main SHA successfully
- smoke-check health and Whistle availability/failure boundaries where tooling permits

### F7 — Team / ULTRAS integrations

Status: **BLOCKED UNTIL CANONICAL MEMBER SURFACES ARE STABLE**

Reuse F1-F6. No new quota, duplicate store, or parallel Whistle domain.

## Verification policy

- **10/10**: architecture correct, tests/CI green, no known defects/conflicts, deployment proof when applicable.
- **9/10**: fully correct and verified with only non-blocking polish remaining.
- **8/10 or below**: do not advance; repair and retest the same slice.
