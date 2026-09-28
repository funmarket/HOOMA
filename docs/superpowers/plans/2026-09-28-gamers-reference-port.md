# Gamers Reference Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Port the complete reference Gamers behavior into current HOOMA without destructive replacement of current Gamer Card data.

**Architecture:** Extend current HOOMA in place. Keep current API/miniapp composition and richer Gamer Card fields, then add the reference challenge/Arena/Whistle/match capabilities at their canonical shared boundaries.

**Tech Stack:** TypeScript, Express, React 19, React Router, TanStack Query, Prisma/PostgreSQL, Redis, Node 22, npm workspaces.

**Spec:** `docs/superpowers/specs/2026-09-28-gamers-reference-port-design.md`

## Global Constraints

- HoomaUltimate ZIP is read-only.
- Only `funmarket/HOOMA:feat/gamers-reference-port` is writable during implementation.
- Preserve current Gamer Card data and fields.
- Canonical User remains the only account identity.
- GAMER is a profile identity, not an admin role.
- Shared Whistle remains the only Whistle engine.
- Use proper Prisma migrations.
- No merge/deploy in this plan.

## Review Focus

- Existing GamerProfile rows migrate without loss while challenge behavior uses gamerTag as the reference handle.
- Reverse-direction pending challenges cannot race into duplicates.
- Direct Gamer Whistle derives the same pair context from either participant and cannot cross games/self-target.
- Global Arena cannot leak pending/declined/cancelled or private account identifiers.
- Match proof/result endpoints reject wrong media, oversized evidence, unauthorized participants, and state races.

---

### Task 1: Contracts, persistence, and reference behavior tests

**Files:**

- Modify: `packages/contracts/src/gamers.ts`
- Modify: `packages/contracts/src/index.ts`
- Modify: `packages/database/prisma/schema.prisma`
- Create: `packages/database/prisma/migrations/<timestamp>_gamers_reference_port/migration.sql`
- Create/modify Gamer-focused tests under `tests/`

**Interfaces:**

- Produces Gamer challenge, Arena and match contracts plus Prisma models used by later API tasks.

- [ ] Add adapted tests first for challenge lifecycle, global Arena, identity eligibility and match reconciliation.
- [ ] Run the focused tests/CI and record expected RED caused by missing implementation.
- [ ] Add contracts and non-destructive Prisma schema/migration.
- [ ] Verify Prisma generation/validation and focused model tests.

### Task 2: Gamers API discovery, challenge and Arena

**Files:**

- Modify/create under `apps/api/src/modules/gamers/**`
- Modify `apps/api/src/bootstrap/container.ts`
- Modify `apps/api/src/http/v1/router.ts`

**Interfaces:**

- Consumes Task 1 contracts/models.
- Produces public discovery/Arena/game reads and protected profile/challenge lifecycle endpoints.

- [ ] Port reference repository ports and Prisma implementations while preserving current Gamer Card fields.
- [ ] Port GamerService rules: canonical GAMER identity, same-game/no-self/open checks, duplicate-safe pair key, lifecycle transitions.
- [ ] Adapt routes to current auth/router conventions.
- [ ] Run focused API tests to GREEN.

### Task 3: Direct Gamer Whistle

**Files:**

- Modify `apps/api/src/modules/whistle/**`
- Modify Gamers repository/service for direct-pair resolution.
- Modify `packages/contracts/src/whistle.ts`
- Add/modify direct Gamer Whistle tests.

**Interfaces:**

- Consumes Gamer profile/eligibility repository.
- Produces `/api/v1/whistles/gamers/:otherProfileId` using the shared Redis engine.

- [ ] Add direct-Whistle RED test from reference behavior.
- [ ] Add gamer-direct Whistle scope and server authorization.
- [ ] Verify shared quota/expiry semantics remain unchanged.
- [ ] Run Whistle + Gamer focused tests to GREEN.

### Task 4: EA FC match verification and Platform Admin disputes

**Files:**

- Create/modify Gamers match repository/service/API files.
- Modify Platform Admin router as required.
- Add `packages/storage`.
- Modify API env/package wiring.
- Add match tests.

**Interfaces:**

- Consumes accepted GamerChallenge.
- Produces room-code, result-proof, dispute queue/resolve behavior.

- [ ] Add match-service/reconciliation tests first.
- [ ] Add shared object-storage contract and S3-compatible implementation.
- [ ] Port match repository/service and admin dispute endpoints.
- [ ] Verify media/state/authorization failures and successful paths.

### Task 5: Gamer reconciliation worker

**Files:**

- Create `apps/worker/package.json`, tsconfig, `src/main.ts`, and `src/gamers/match-reconciliation.ts`.
- Modify root workspace scripts/package lock as required.

**Interfaces:**

- Consumes Task 4 Prisma match models.
- Produces a 15-second reconciliation loop matching the reference behavior.

- [ ] Port reconciliation logic and tests.
- [ ] Add minimal worker runtime and graceful shutdown.
- [ ] Verify workspace dependency lock consistency and worker typecheck/build.

### Task 6: Mini App Gamers UI

**Files:**

- Create `apps/miniapp/src/features/gamers/**`.
- Replace/adapt `apps/miniapp/src/pages/GamersPage.tsx`.
- Modify `apps/miniapp/src/App.tsx`.

**Interfaces:**

- Consumes Tasks 2-4 APIs.
- Produces global Gamers tabs, game hub, HUD card, Match Card, challenge setup, direct Whistle and EA FC bridge.

- [ ] Port shared Gamer HUD and Match Card presentation.
- [ ] Port global discovery/Catalog/Arena and game hub.
- [ ] Port challenge setup/onboarding behavior using current auth/profile endpoints.
- [ ] Port direct Whistle and EA FC bridge.
- [ ] Keep current HOOMA global design tokens/shell; do not introduce a second shell.
- [ ] Run UI/type/build tests.

### Task 7: Full branch verification

- [ ] Run focused Gamer/Whistle tests.
- [ ] Run Prisma validate/generate/migrate-deploy against CI database.
- [ ] Run architecture check, lint, typecheck, full tests, format check, build, security and migration consistency.
- [ ] Audit branch diff against `abb67b434f020b1852f638eaadcfef49a3230d68`.
- [ ] Verify HoomaUltimate/ZIP unchanged.
- [ ] Open/refresh draft PR only to obtain exact-head CI; do not merge.
