import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildContainer } from '../apps/api/src/bootstrap/container.ts';

test('public player profile exposes football presentation without private authentication fields', async () => {
  const container = buildContainer();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const user = await container.db.user.create({
      data: {
        telegramUserId: `tg_${suffix}`,
        username: `telegram_${suffix}`,
        authName: 'Private Auth Name',
        authUsername: `private_${suffix}`,
        displayAuthUsername: `Player_${suffix}`,
        email: `${suffix}@example.com`,
        languageCode: 'en',
        isPremium: true,
        profile: {
          create: {
            skillLevel: 'ADVANCED',
            skillRating: 83,
            preferredPositions: ['CM', 'AM'],
            bio: 'Public football bio',
          },
        },
        profileIdentities: { create: [{ type: 'PLAYER' }] },
      },
      select: { id: true },
    });
    await container.db.userProfilePresentation.create({
      data: {
        userId: user.id,
        displayName: 'Public Player',
        photoUrl: 'https://example.com/player.jpg',
      },
    });

    const profile = (await container.services.identity.getPublicProfile(user.id)) as Record<
      string,
      unknown
    >;

    assert.equal(profile.id, user.id);
    assert.equal(profile.effectiveDisplayName, 'Public Player');
    assert.equal(profile.effectivePhotoUrl, 'https://example.com/player.jpg');
    assert.equal(profile.effectiveUsername, `Player_${suffix}`);
    assert.equal('email' in profile, false);
    assert.equal('telegramUserId' in profile, false);
    assert.equal('authName' in profile, false);
    assert.equal('authUsername' in profile, false);
    assert.equal('displayAuthUsername' in profile, false);
    assert.equal('languageCode' in profile, false);
    assert.equal('isPremium' in profile, false);
    assert.equal('preference' in profile, false);
  } finally {
    await container.db.$disconnect();
  }
});

test('public Team roster preserves canonical User linkage while guests remain unlinkable', async () => {
  const container = buildContainer();
  const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const coach = await container.db.user.create({ data: {}, select: { id: true } });
    const player = await container.db.user.create({ data: {}, select: { id: true } });
    const community = await container.db.community.create({
      data: {
        slug: `public-profile-${suffix}`,
        name: `Public Profile ${suffix}`,
        createdByUserId: coach.id,
      },
      select: { id: true },
    });
    const team = await container.db.team.create({
      data: {
        communityId: community.id,
        createdByUserId: coach.id,
        name: 'Profile Links FC',
        isPublic: true,
      },
      select: { id: true },
    });
    const linked = await container.db.teamPlayer.create({
      data: { teamId: team.id, userId: player.id, displayName: 'Linked Player' },
      select: { id: true },
    });
    const guest = await container.db.teamPlayer.create({
      data: { teamId: team.id, displayName: 'Guest Player' },
      select: { id: true },
    });

    const roster = (await container.services.teams.publicRoster(team.id)) as {
      items: Array<{ id: string; userId: string | null }>;
    };
    assert.equal(roster.items.find((item) => item.id === linked.id)?.userId, player.id);
    assert.equal(roster.items.find((item) => item.id === guest.id)?.userId, null);
  } finally {
    await container.db.$disconnect();
  }
});

test('Team roster and lineup navigation use canonical User ids and never link guest players', () => {
  const teamPage = readFileSync('apps/miniapp/src/pages/TeamProfilePage.tsx', 'utf8');
  const pitch = readFileSync('apps/miniapp/src/components/teams/TeamLineupPitch.tsx', 'utf8');
  const app = readFileSync('apps/miniapp/src/App.tsx', 'utf8');

  assert.match(app, /path="\/profile\/:userId"/);
  assert.match(teamPage, /navigate\(`\/profile\/\$\{player\.userId\}`\)/);
  assert.match(teamPage, /onOpenProfile=\{\(userId\) => navigate\(`\/profile\/\$\{userId\}`\)\}/);
  assert.match(teamPage, /player\.userId \? \(/);
  assert.match(pitch, /const userId = rosterPlayer\?\.userId \?\? null/);
  assert.match(pitch, /userId && onOpenProfile/);
  assert.doesNotMatch(pitch, /onOpenProfile\(slot\.player\.id\)/);
});
