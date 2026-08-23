CREATE TYPE "GamerGameStatus" AS ENUM ('ACTIVE', 'INACTIVE');

CREATE TYPE "GamerGamePlatform" AS ENUM ('EA', 'PLAYSTATION', 'XBOX', 'NINTENDO', 'PC', 'MOBILE', 'OTHER');

CREATE TABLE "GamerGame" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(120) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "normalizedName" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1200),
    "logoUrl" TEXT,
    "coverUrl" TEXT,
    "publisher" VARCHAR(120),
    "platforms" "GamerGamePlatform"[] DEFAULT ARRAY[]::"GamerGamePlatform"[],
    "status" "GamerGameStatus" NOT NULL DEFAULT 'ACTIVE',
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GamerGame_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GamerGame_slug_key" ON "GamerGame"("slug");
CREATE UNIQUE INDEX "GamerGame_normalizedName_key" ON "GamerGame"("normalizedName");
CREATE INDEX "GamerGame_status_featured_name_id_idx" ON "GamerGame"("status", "featured", "name", "id");
CREATE INDEX "GamerGame_featured_status_createdAt_idx" ON "GamerGame"("featured", "status", "createdAt");
