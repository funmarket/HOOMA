CREATE TYPE "GamerChallengeStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'CANCELLED');

CREATE TABLE "GamerChallenge" (
  "id" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "challengerProfileId" TEXT NOT NULL,
  "challengedProfileId" TEXT NOT NULL,
  "pairKey" TEXT NOT NULL,
  "status" "GamerChallengeStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "respondedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerChallenge_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamerChallenge_distinct_profiles_check" CHECK ("challengerProfileId" <> "challengedProfileId")
);

CREATE INDEX "GamerChallenge_gameId_status_createdAt_idx" ON "GamerChallenge"("gameId", "status", "createdAt");
CREATE INDEX "GamerChallenge_challengerProfileId_status_createdAt_idx" ON "GamerChallenge"("challengerProfileId", "status", "createdAt");
CREATE INDEX "GamerChallenge_challengedProfileId_status_createdAt_idx" ON "GamerChallenge"("challengedProfileId", "status", "createdAt");
CREATE INDEX "GamerChallenge_gameId_pairKey_status_idx" ON "GamerChallenge"("gameId", "pairKey", "status");
CREATE UNIQUE INDEX "GamerChallenge_one_pending_pair_per_game_key" ON "GamerChallenge"("gameId", "pairKey") WHERE "status" = 'PENDING';

ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GamerGame"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_challengerProfileId_fkey" FOREIGN KEY ("challengerProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamerChallenge" ADD CONSTRAINT "GamerChallenge_challengedProfileId_fkey" FOREIGN KEY ("challengedProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "GamerMatchSessionStatus" AS ENUM (
  'WAITING_FOR_CODE',
  'IN_PROGRESS',
  'PENDING_VERIFICATION',
  'VERIFIED',
  'DISPUTED',
  'VOIDED'
);

CREATE TYPE "GamerMatchSide" AS ENUM ('CHALLENGER', 'CHALLENGED');

CREATE TYPE "GamerMatchResolution" AS ENUM (
  'MATCHED_SUBMISSIONS',
  'SINGLE_SUBMISSION_TIMEOUT',
  'PLATFORM_ADMIN',
  'PLATFORM_ADMIN_VOID'
);

CREATE TABLE "GamerMatchSession" (
  "id" TEXT NOT NULL,
  "challengeId" TEXT NOT NULL,
  "status" "GamerMatchSessionStatus" NOT NULL DEFAULT 'WAITING_FOR_CODE',
  "roomCode" TEXT,
  "submissionDeadline" TIMESTAMP(3),
  "finalChallengerScore" INTEGER,
  "finalChallengedScore" INTEGER,
  "winnerSide" "GamerMatchSide",
  "resolution" "GamerMatchResolution",
  "resolvedAt" TIMESTAMP(3),
  "moderatorNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerMatchSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamerMatchSession_roomCode_check" CHECK ("roomCode" IS NULL OR "roomCode" ~ '^[0-9]{6}$'),
  CONSTRAINT "GamerMatchSession_final_scores_check" CHECK (
    ("finalChallengerScore" IS NULL OR "finalChallengerScore" >= 0) AND
    ("finalChallengedScore" IS NULL OR "finalChallengedScore" >= 0)
  )
);

CREATE TABLE "GamerMatchSubmission" (
  "id" TEXT NOT NULL,
  "matchSessionId" TEXT NOT NULL,
  "side" "GamerMatchSide" NOT NULL,
  "challengerScore" INTEGER NOT NULL,
  "challengedScore" INTEGER NOT NULL,
  "proofObjectKey" TEXT NOT NULL,
  "proofContentType" TEXT NOT NULL,
  "proofSizeBytes" INTEGER NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerMatchSubmission_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GamerMatchSubmission_scores_check" CHECK ("challengerScore" >= 0 AND "challengedScore" >= 0),
  CONSTRAINT "GamerMatchSubmission_proof_size_check" CHECK ("proofSizeBytes" > 0 AND "proofSizeBytes" <= 5242880)
);

CREATE UNIQUE INDEX "GamerMatchSession_challengeId_key" ON "GamerMatchSession"("challengeId");
CREATE INDEX "GamerMatchSession_status_updatedAt_idx" ON "GamerMatchSession"("status", "updatedAt");
CREATE UNIQUE INDEX "GamerMatchSubmission_matchSessionId_side_key" ON "GamerMatchSubmission"("matchSessionId", "side");
CREATE INDEX "GamerMatchSubmission_matchSessionId_submittedAt_idx" ON "GamerMatchSubmission"("matchSessionId", "submittedAt");

ALTER TABLE "GamerMatchSession"
  ADD CONSTRAINT "GamerMatchSession_challengeId_fkey"
  FOREIGN KEY ("challengeId") REFERENCES "GamerChallenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GamerMatchSubmission"
  ADD CONSTRAINT "GamerMatchSubmission_matchSessionId_fkey"
  FOREIGN KEY ("matchSessionId") REFERENCES "GamerMatchSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "GamerGame" (
  "id", "slug", "name", "normalizedName", "description", "platforms", "status", "featured", "createdAt", "updatedAt"
)
VALUES
  ('gamer_game_fc_mobile', 'ea-sports-fc-mobile', 'EA SPORTS FC Mobile', 'ea sports fc mobile', NULL, ARRAY['EA','MOBILE']::"GamerGamePlatform"[], 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('gamer_game_ludo', 'ludo', 'Ludo', 'ludo', NULL, ARRAY['MOBILE','OTHER']::"GamerGamePlatform"[], 'ACTIVE', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
