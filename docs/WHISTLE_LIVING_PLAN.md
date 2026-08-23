# HOOMA Whistle Living Implementation Plan

Last updated: 2026-08-23
Repository: `funmarket/HOOMA`
Working branch: `feat/whistle-foundation-v1`
Baseline main SHA: `07b6130173259718473f41d087739b154efcd503`
Draft PR: `#61`

## Purpose

This is the canonical living plan for the shared HOOMA Whistle domain. Update it after every verified implementation slice. Repository truth wins over chat history.

## Non-negotiable working rules

- Work only in `funmarket/HOOMA`.
- Treat `funmarket/HoomaUltimate` as read-only reference only.
- Re-read current `main` and open PRs before every slice.
- Fix/build at the source. No patches, duplicate domains, workaround stores, or parallel authority systems.
- One shared Whistle quota applies across every Whistle context.
- Whistle must not become permanent chat or a permanent social feed.
- No Whistle message body may be persisted in PostgreSQL.
- No Prisma Whistle model or migration unless the product rules explicitly change later.
- Redis is the authoritative transient Whistle store.
- A slice may advance only after proof of success and an implementation score above 8/10.
- After every verified slice record proof, touched files, created files, intentionally untouched files, conflict status, and score.

## Canonical product rules

1. Maximum message size: **33 Unicode graphemes** after trimming.
2. Daily allowance: **11 Whistles per canonical HOOMA user across all contexts combined**.
3. Quota window: UTC calendar day, never rolling 24 hours.
4. Reset: **00:00 UTC** every day.
5. Unused allowance does not roll over. Every UTC day starts at 11.
6. Every Whistle message from the prior UTC day becomes inaccessible at midnight UTC and its Redis key expires at that same boundary.
7. No 24-hour-per-message TTL.
8. No 60-second per-viewer expiry or reveal state.
9. No permanent message archive/history.
10. PostgreSQL must not contain Whistle body/history copies.
11. Notifications, when added later, must never contain the Whistle body.
12. Redis quota enforcement must be atomic so concurrent sends cannot exceed 11.
13. If Redis cannot enforce the quota, Whistle writes fail closed while unrelated HOOMA features remain available.
14. V1 Play Whistle reads/writes require an authenticated active community member.
15. Future Team and ULTRAS boards reuse the same domain and user quota; they must not introduce separate daily counters.

## Target architecture

### Shared contract

`packages/contracts/src/whistle.ts`

Owns Whistle constants, grapheme-aware body validation, and request/response contract types as they are introduced.

### UTC window domain

`apps/api/src/modules/whistle/domain/utc-day.ts`

Owns canonical UTC day identity, start/reset timestamps, and current-window validation. Redis code must consume this helper rather than reproducing midnight arithmetic.

### Redis infrastructure

- `apps/api/src/infrastructure/redis/client.ts`
- `apps/api/src/modules/whistle/application/whistle-store.ts`
- `apps/api/src/modules/whistle/infrastructure/redis-whistle.store.ts`

Canonical key families:

- `whistle:v1:quota:<YYYY-MM-DD>:<userId>`
- `whistle:v1:feed:<YYYY-MM-DD>:community:<communityId>`
- future Team and ULTRAS feed keys use the same day namespace and global quota key

All keys use absolute `PEXPIREAT` at the next 00:00 UTC. API reads only the current UTC-day namespace.

### Service / HTTP

Planned source:

- `apps/api/src/modules/whistle/application/whistle.service.ts`
- `apps/api/src/modules/whistle/http/whistle.controller.ts`

V1 routes:

- `GET /api/v1/whistles/communities/:communityId`
- `POST /api/v1/whistles/communities/:communityId`

The service reuses existing canonical authentication and `CommunityService.requireMembership()`; it does not invent a second membership system.

### Mini App

Planned source:

- `apps/miniapp/src/features/whistle/api.ts`
- `apps/miniapp/src/components/whistle/WhistleBoard.tsx`
- `apps/miniapp/src/components/whistle/WhistleBoard.css`
- `apps/miniapp/src/pages/PlayPage.tsx`

V1 presentation is an inline Play Whistle Board under the Play hero. It must use the shared HTTP client and HOOMA design tokens. No likes, comments, threads, permanent history, or generic social-feed mechanics.

## Implementation ledger

### F1 — Canonical contract + UTC calendar boundary

Status: **VERIFIED COMPLETE**

Deliverables completed:

- canonical constants `WHISTLE_DAILY_LIMIT = 11` and `WHISTLE_MAX_GRAPHEMES = 33`
- grapheme-aware validation using `Intl.Segmenter`
- canonical UTC day/start/reset helper
- permanent tests for Unicode grapheme clusters, exact 33/34 boundaries, whitespace rejection, midnight reset, and year rollover

Proof:

- Draft PR `#61` exact tested head: `e7b1131ac2e5aa8ddbb25bb8f03ab53f57a35598`
- GitHub Actions CI run `#481`, run ID `32666033801`: **SUCCESS**
- Branch comparison against baseline main before CI: ahead 6 commits, behind 0, exactly 6 touched files
- Current main remained `07b6130173259718473f41d087739b154efcd503` at the verification gate

Created files:

- `docs/WHISTLE_LIVING_PLAN.md`
- `packages/contracts/src/whistle.ts`
- `apps/api/src/modules/whistle/domain/utc-day.ts`
- `tests/whistle-contract.test.ts`
- `tests/whistle-utc-day.test.ts`

Modified files:

- `packages/contracts/src/index.ts`
- this living plan

Intentionally untouched:

- Redis/runtime infrastructure
- Railway
- Prisma schema and migrations
- Team domain
- Gamers domain
- Play UI
- API router/container
- Chat and Notifications

Conflict status:

- F1 did not touch the shared files changed by concurrent Gamers work.
- No Team/Gamers business source was edited.

Implementation score: **10/10**

Gate decision: **PASSED — F2 may begin.**

### F2 — Redis runtime foundation

Status: **VERIFIED COMPLETE**

Deliverables completed:

- pinned API dependency `redis = 5.8.2` with npm-generated root lockfile
- lazy, isolated `RedisRuntime` connection lifecycle and stable `RedisUnavailableError`
- exact inferred node-redis client type; no unsafe generic cast workaround
- production `REDIS_URL` validation
- graceful Redis shutdown alongside PostgreSQL
- local `redis:7.4-alpine` Docker service
- CI Redis service with health check and `REDIS_URL`
- production deploy-preflight requirement for `REDIS_URL`
- permanent runtime tests proving no-config fail-closed behavior, single shared connection, and real Redis `PING/PONG`

Proof:

- First F2 CI run `#507`, run ID `32667038001`, correctly FAILED at typecheck because an explicit generic `RedisClientType` was too narrow under the repository's `exactOptionalPropertyTypes` rules. F2 was not advanced.
- The source type was corrected using `ReturnType<typeof createClient>` and a captured non-null client rather than a cast.
- Corrected implementation exact tested head: `38734ddceddf7b43286a3dadb757334765104196`.
- GitHub Actions CI run `#508`, run ID `32667143503`: quality job **SUCCESS** through install, preflight, database validation/generation, architecture check, lint, typecheck, migrations, tests, format, build, security, and migration checks.
- Exact F2 verification-ledger head `43eb3b1a64a03c771f4af793dd5e76180eb24204` passed CI `#510`, run ID `32667288962`: **SUCCESS**.
- CI Redis service `redis:7.4-alpine` became healthy; runtime integration test ran with `REDIS_URL=redis://localhost:6379`.
- `npm ci` reported 0 vulnerabilities.
- Root `package-lock.json` was produced by npm on a temporary branch-only lockfile-sync workflow; that temporary workflow was deleted and leaves no final repository file.

Created files:

- `apps/api/src/infrastructure/redis/client.ts`
- `tests/redis-runtime.test.ts`

Modified files:

- `apps/api/package.json`
- `package-lock.json`
- `apps/api/src/config/env.ts`
- `apps/api/src/bootstrap/container.ts`
- `apps/api/src/bootstrap/server.ts`
- `.env.example`
- `docker-compose.yml`
- `.github/workflows/ci.yml`
- `scripts/deploy-preflight.mjs`
- this living plan

Intentionally untouched:

- Prisma schema and migrations
- Whistle API router/controller/service
- Play UI
- Team domain
- Gamers domain
- Chat and Notifications
- Railway production services and variables
- generic `RATE_LIMIT_STORE=memory` architecture

Conflict status:

- Concurrent Team and Gamers lanes were inspected before implementation.
- No Team/Gamers business logic was duplicated or modified.

Implementation score: **10/10**

Gate decision: **PASSED — F3 may begin.**

### F3 — Atomic Redis Whistle store

Status: **VERIFIED COMPLETE**

Deliverables completed:

- one global user/day quota key shared across every Whistle scope
- Redis Stream feed keys scoped by UTC day and context
- atomic Lua send operation using Redis server `TIME`
- exact 11/day enforcement under concurrency
- absolute `PEXPIREAT` expiry for quota and feed at next 00:00 UTC
- stale-window rejection before mutation and before stale reads are surfaced
- fail-closed behavior for unavailable Redis and malformed Redis key types/values
- minimal transient author snapshot only; no PostgreSQL persistence
- permanent real-Redis integration tests

Proof:

- Initial F3 implementation CI `#514`, run ID `32667947432`, correctly stopped on a TypeScript boundary around the node-redis `TIME` return type. The implementation did not advance.
- The TIME result boundary was corrected by accepting the library's array type and explicitly validating both required elements and finite numeric conversion.
- Corrected behavior CI `#515`, run ID `32668044838`, passed typecheck and all **108/108 tests**, including the F3 Redis tests; it stopped only on repository formatting.
- Repository-pinned Prettier was then applied to the two new Whistle store source files. The temporary formatting workflow was deleted and leaves no final repository file.
- Exact final F3 implementation head: `c97632c9ffc9275f164cd2238cf32c5c9722864b`.
- GitHub Actions CI run `#520`, run ID `32668386562`: **SUCCESS** through install, preflight, DB validation/generation, architecture, lint, typecheck, migrations, all tests, format, build, security, and migration checks.
- Concurrency proof: 20 simultaneous sends by one fresh user split across two community scopes produced exactly **11 accepted and 9 limit-reached** results; total feed entries across both contexts remained exactly 11 and quota became `{ used: 11, remaining: 0 }`.
- Expiry proof: Redis `PEXPIRETIME` for both quota and feed exactly equaled the canonical next UTC midnight timestamp, not creation time + 24 hours.
- Stale-day proof: yesterday-window send/list/quota returned `stale_window` and created no quota key.
- Corruption proof: invalid Redis quota key type fails closed with `WhistleStoreCorruptError`.
- PR CI checked a synthetic merge of the Whistle head against current main `84007ba2353f7a65acae0424b242772e9205ed8e`, proving the slice remains compatible with the merged Team Control Room work.

Created files:

- `apps/api/src/modules/whistle/application/whistle-store.ts`
- `apps/api/src/modules/whistle/infrastructure/redis-whistle.store.ts`
- `tests/redis-whistle-store.test.ts`

Modified files:

- this living plan

Intentionally untouched:

- Prisma schema and migrations
- API Whistle controller/service/routes
- Play UI
- Team domain
- Gamers domain
- Chat and Notifications
- Railway production infrastructure
- generic HTTP rate-limit storage

Conflict status:

- Current main and active PRs were re-read before F3.
- Team Control Room PR `#62` had merged into main before F3 verification.
- Concurrent Gamers PR `#64` explicitly excluded Whistle; F3 touched only Whistle/Redis test sources.
- Synthetic-merge CI against current main passed all repository gates.

Implementation score: **10/10**

Gate decision: **PASSED — F4 may begin after this verification-ledger commit itself passes exact-head CI.**

### F4 — Whistle application service + community API

Status: **PENDING**

Deliverables:

- active-community membership gate
- GET/POST community endpoints
- stable daily-limit and unavailable errors
- current-day-only reads
- one retry on a midnight stale-window transition using a fresh UTC window
- API docs and permanent service/controller tests

### F5 — Play Whistle Board

Status: **PENDING**

Deliverables:

- Play-page inline board
- remaining quota/reset display
- 33-grapheme composer
- loading/empty/error/exhausted states
- polling through the existing shared HTTP architecture
- responsive Telegram/web presentation using HOOMA tokens

### F6 — Production Redis + release verification

Status: **PENDING**

Deliverables:

- Railway Redis service/private connectivity
- `REDIS_URL` wiring without exposing secrets
- exact-head full CI green
- conflict audit against current `main`
- merge
- verify exact merged SHA deployed successfully to HOOMA API and Mini App
- smoke-check health and Whistle failure boundaries

### F7 — Team / ULTRAS integrations

Status: **BLOCKED UNTIL THEIR CANONICAL MEMBER SURFACES ARE STABLE**

Reuse F1-F6. No new quotas, no duplicate store, no parallel Whistle domain.

## Verification policy

A step is only **VERIFIED COMPLETE** when evidence exists. Implementation scoring:

- 10/10: architecture correct, tests/CI green, no known defects/conflicts, deployment proof when applicable.
- 9/10: fully correct and verified with only non-blocking polish remaining.
- 8/10 or below: do not advance; repair/retest the same step.
