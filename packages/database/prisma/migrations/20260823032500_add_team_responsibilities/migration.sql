CREATE TYPE "TeamResponsibilityRole" AS ENUM ('COACH', 'MANAGER', 'ASSISTANT');
CREATE TYPE "TeamDelegatedPermission" AS ENUM ('EDIT_TEAM', 'MANAGE_ROSTER', 'MANAGE_LINEUP', 'CREATE_CHALLENGE', 'RESPOND_CHALLENGE', 'MESSAGE_CHALLENGE');

CREATE TABLE "TeamResponsibility" (
  "id" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "role" "TeamResponsibilityRole" NOT NULL,
  "permissions" "TeamDelegatedPermission"[] DEFAULT ARRAY[]::"TeamDelegatedPermission"[],
  "appointedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "TeamResponsibility_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamResponsibility_teamId_userId_key" ON "TeamResponsibility"("teamId", "userId");
CREATE INDEX "TeamResponsibility_teamId_role_revokedAt_idx" ON "TeamResponsibility"("teamId", "role", "revokedAt");
CREATE INDEX "TeamResponsibility_userId_revokedAt_idx" ON "TeamResponsibility"("userId", "revokedAt");
CREATE INDEX "TeamResponsibility_appointedByUserId_idx" ON "TeamResponsibility"("appointedByUserId");

ALTER TABLE "TeamResponsibility"
  ADD CONSTRAINT "TeamResponsibility_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamResponsibility"
  ADD CONSTRAINT "TeamResponsibility_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamResponsibility"
  ADD CONSTRAINT "TeamResponsibility_appointedByUserId_fkey"
  FOREIGN KEY ("appointedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve all existing Team management authority as explicit Team responsibilities.
-- Community OWNER maps to Coach; Community ADMIN maps to Manager. No existing access is removed.
INSERT INTO "TeamResponsibility" (
  "id", "teamId", "userId", "role", "permissions", "appointedByUserId", "createdAt", "updatedAt", "revokedAt"
)
SELECT
  'legacy_' || md5(t."id" || ':' || m."userId"),
  t."id",
  m."userId",
  CASE WHEN m."role" = 'OWNER' THEN 'COACH'::"TeamResponsibilityRole" ELSE 'MANAGER'::"TeamResponsibilityRole" END,
  ARRAY[]::"TeamDelegatedPermission"[],
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  NULL
FROM "Team" t
JOIN "Membership" m ON m."communityId" = t."communityId"
WHERE t."deletedAt" IS NULL
  AND m."status" = 'ACTIVE'
  AND m."role" IN ('OWNER', 'ADMIN')
ON CONFLICT ("teamId", "userId") DO NOTHING;
