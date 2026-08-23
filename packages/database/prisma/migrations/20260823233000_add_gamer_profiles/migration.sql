CREATE TYPE "GamerPlayStyle" AS ENUM ('CASUAL', 'COMPETITIVE', 'RANKED');
CREATE TYPE "GamerVisibility" AS ENUM ('PUBLIC', 'MATCHED_ONLY', 'PRIVATE');
CREATE TYPE "GamerPlatformIdentityProvider" AS ENUM ('EA_ID', 'PSN', 'XBOX', 'NINTENDO', 'STEAM', 'EPIC', 'GAME_USERNAME', 'OTHER');
CREATE TYPE "GamerSocialProvider" AS ENUM ('DISCORD', 'KIK', 'YOUTUBE', 'TWITCH', 'TIKTOK', 'OTHER');

CREATE TABLE "GamerProfile" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "gameId" TEXT NOT NULL,
  "gamerTag" VARCHAR(80) NOT NULL,
  "bio" VARCHAR(280),
  "playStyle" "GamerPlayStyle" NOT NULL DEFAULT 'CASUAL',
  "openToChallenge" BOOLEAN NOT NULL DEFAULT true,
  "region" VARCHAR(80),
  "language" VARCHAR(40),
  "preferredTimes" VARCHAR(160),
  "visibility" "GamerVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerProfile_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamerPlatformIdentity" (
  "id" TEXT NOT NULL,
  "gamerProfileId" TEXT NOT NULL,
  "provider" "GamerPlatformIdentityProvider" NOT NULL,
  "label" VARCHAR(80),
  "handle" VARCHAR(120) NOT NULL,
  "visibility" "GamerVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerPlatformIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GamerSocialLink" (
  "id" TEXT NOT NULL,
  "gamerProfileId" TEXT NOT NULL,
  "provider" "GamerSocialProvider" NOT NULL,
  "label" VARCHAR(80),
  "url" TEXT NOT NULL,
  "visibility" "GamerVisibility" NOT NULL DEFAULT 'PUBLIC',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GamerSocialLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GamerProfile_userId_gameId_key" ON "GamerProfile"("userId", "gameId");
CREATE INDEX "GamerProfile_gameId_openToChallenge_visibility_createdAt_idx" ON "GamerProfile"("gameId", "openToChallenge", "visibility", "createdAt");
CREATE INDEX "GamerProfile_userId_createdAt_idx" ON "GamerProfile"("userId", "createdAt");

CREATE UNIQUE INDEX "GamerPlatformIdentity_gamerProfileId_provider_handle_key" ON "GamerPlatformIdentity"("gamerProfileId", "provider", "handle");
CREATE INDEX "GamerPlatformIdentity_gamerProfileId_provider_idx" ON "GamerPlatformIdentity"("gamerProfileId", "provider");

CREATE UNIQUE INDEX "GamerSocialLink_gamerProfileId_provider_url_key" ON "GamerSocialLink"("gamerProfileId", "provider", "url");
CREATE INDEX "GamerSocialLink_gamerProfileId_provider_idx" ON "GamerSocialLink"("gamerProfileId", "provider");

ALTER TABLE "GamerProfile" ADD CONSTRAINT "GamerProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamerProfile" ADD CONSTRAINT "GamerProfile_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "GamerGame"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "GamerPlatformIdentity" ADD CONSTRAINT "GamerPlatformIdentity_gamerProfileId_fkey" FOREIGN KEY ("gamerProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GamerSocialLink" ADD CONSTRAINT "GamerSocialLink_gamerProfileId_fkey" FOREIGN KEY ("gamerProfileId") REFERENCES "GamerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
