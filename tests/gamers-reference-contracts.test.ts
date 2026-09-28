import assert from 'node:assert/strict';
import test from 'node:test';
import {
  eaFcRoomCodeInputSchema,
  gamerArenaMatchListSchema,
  gamerChallengeCreateSchema,
  gamerDisputeResolutionInputSchema,
} from '@hooma/contracts';

test('reference Gamer challenge contract accepts a challenged profile id', () => {
  assert.deepEqual(gamerChallengeCreateSchema.parse({ challengedProfileId: 'profile-2' }), {
    challengedProfileId: 'profile-2',
  });
});

test('reference global Arena contract is accepted-only and cursor-backed', () => {
  const parsed = gamerArenaMatchListSchema.parse({
    items: [
      {
        id: 'challenge-1',
        status: 'ACCEPTED',
        game: { id: 'game-1', slug: 'ea-sports-fc-mobile', name: 'EA SPORTS FC Mobile' },
        challenger: {
          id: 'profile-1',
          handle: 'Alpha',
          presentation: {
            username: 'alpha',
            displayName: 'Alpha',
            photoUrl: null,
          },
        },
        challenged: {
          id: 'profile-2',
          handle: 'Bravo',
          presentation: {
            username: 'bravo',
            displayName: 'Bravo',
            photoUrl: null,
          },
        },
      },
    ],
    nextCursor: 'cursor-2',
  });
  assert.equal(parsed.items[0]?.status, 'ACCEPTED');
  assert.equal(parsed.nextCursor, 'cursor-2');
});

test('EA FC room code remains exactly six digits', () => {
  assert.equal(eaFcRoomCodeInputSchema.parse({ roomCode: '123456' }).roomCode, '123456');
  assert.throws(() => eaFcRoomCodeInputSchema.parse({ roomCode: '12345' }));
  assert.throws(() => eaFcRoomCodeInputSchema.parse({ roomCode: 'ABC123' }));
});

test('Platform Admin dispute resolution requires an explicit decision and notes', () => {
  assert.deepEqual(
    gamerDisputeResolutionInputSchema.parse({
      decision: 'SCORE',
      challengerScore: 3,
      challengedScore: 2,
      moderatorNotes: 'Proof reviewed.',
    }),
    {
      decision: 'SCORE',
      challengerScore: 3,
      challengedScore: 2,
      moderatorNotes: 'Proof reviewed.',
    },
  );
  assert.throws(() =>
    gamerDisputeResolutionInputSchema.parse({
      decision: 'VOID',
      moderatorNotes: '',
    }),
  );
});
