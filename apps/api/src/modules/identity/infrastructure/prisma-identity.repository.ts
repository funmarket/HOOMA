import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { DatabaseClient } from '../../../infrastructure/database/prisma.js';
import type { ProfileUpdateInput, WebCredentialsLinkInput } from '@hooma/contracts';
import type { IdentityRepository } from '../application/identity-repository.js';
import {
  normalizeSelectedProfileIdentities,
  resolveEffectiveProfileIdentities,
} from '../domain/profile-identities.js';
import { resolveUserPresentation } from '../domain/profile-presentation.js';
import type { TelegramIdentityInput } from '../domain/types.js';

const identityUserSelect = {
  id: true,
  telegramUserId: true,
  username: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  languageCode: true,
  isPremium: true,
} as const;

const meSelect = {
  id: true,
  telegramUserId: true,
  username: true,
  authName: true,
  authUsername: true,
  displayAuthUsername: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  languageCode: true,
  isPremium: true,
  profile: { include: { favoriteClub: true } },
  preference: true,
  profileIdentities: { select: { type: true } },
} satisfies Prisma.UserSelect;

const publicProfileSelect = {
  id: true,
  username: true,
  authName: true,
  authUsername: true,
  displayAuthUsername: true,
  firstName: true,
  lastName: true,
  photoUrl: true,
  profile: {
    select: {
      skillLevel: true,
      skillRating: true,
      preferredPositions: true,
      bio: true,
      favoriteClub: {
        select: { id: true, name: true, slug: true, countryCode: true, logoUrl: true },
      },
    },
  },
  profileIdentities: { select: { type: true } },
} satisfies Prisma.UserSelect;

const presentationSelect = {
  displayName: true,
  photoUrl: true,
} as const;

type MeRecord = Prisma.UserGetPayload<{ select: typeof meSelect }>;
type PublicProfileRecord = Prisma.UserGetPayload<{ select: typeof publicProfileSelect }>;
type PresentationRecord = Prisma.UserProfilePresentationGetPayload<{
  select: typeof presentationSelect;
}>;

function toMeView(user: MeRecord, presentation: PresentationRecord | null) {
  const {
    profileIdentities,
    authName,
    authUsername,
    displayAuthUsername,
    username: telegramUsername,
    ...base
  } = user;
  const selectedIdentities = normalizeSelectedProfileIdentities(
    profileIdentities.map((identity) => identity.type),
  );
  const effectiveIdentities = resolveEffectiveProfileIdentities(selectedIdentities);
  const resolved = resolveUserPresentation(
    {
      username: telegramUsername,
      authName,
      authUsername,
      displayAuthUsername,
      firstName: base.firstName,
      lastName: base.lastName,
      photoUrl: base.photoUrl,
    },
    presentation,
  );

  return {
    ...base,
    telegramUsername,
    ...resolved,
    presentation: presentation
      ? {
          displayName: presentation.displayName,
          photoUrl: presentation.photoUrl,
        }
      : null,
    profile: base.profile
      ? {
          ...base.profile,
          selectedIdentities,
          effectiveIdentities,
        }
      : null,
  };
}

function toPublicProfileView(user: PublicProfileRecord, presentation: PresentationRecord | null) {
  const selectedIdentities = normalizeSelectedProfileIdentities(
    user.profileIdentities.map((identity) => identity.type),
  );
  const effectiveIdentities = resolveEffectiveProfileIdentities(selectedIdentities);
  const resolved = resolveUserPresentation(user, presentation);

  return {
    id: user.id,
    ...resolved,
    profile: user.profile
      ? {
          skillLevel: user.profile.skillLevel,
          skillRating: user.profile.skillRating,
          preferredPositions: user.profile.preferredPositions,
          bio: user.profile.bio,
          favoriteClub: user.profile.favoriteClub,
          selectedIdentities,
          effectiveIdentities,
        }
      : null,
  };
}

function telegramIdentityData(input: TelegramIdentityInput) {
  return {
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
    ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
    ...(input.photoUrl !== undefined ? { photoUrl: input.photoUrl } : {}),
    ...(input.languageCode !== undefined ? { languageCode: input.languageCode } : {}),
  };
}

function constraintTarget(error: Prisma.PrismaClientKnownRequestError) {
  const target = error.meta?.target;
  return Array.isArray(target) ? target.map(String) : [String(target ?? '')];
}

export class PrismaIdentityRepository implements IdentityRepository {
  constructor(private readonly db: DatabaseClient) {}

  async upsertTelegramUser(input: TelegramIdentityInput) {
    const optionalIdentity = telegramIdentityData(input);

    return this.db.user.upsert({
      where: { telegramUserId: input.telegramUserId },
      create: {
        telegramUserId: input.telegramUserId,
        ...optionalIdentity,
        isPremium: input.isPremium ?? false,
        profile: { create: {} },
        preference: { create: {} },
      },
      update: {
        ...optionalIdentity,
        isPremium: input.isPremium ?? false,
        profile: { upsert: { create: {}, update: {} } },
        preference: { upsert: { create: {}, update: {} } },
      },
      select: identityUserSelect,
    });
  }

  async linkTelegramIdentity(userId: string, input: TelegramIdentityInput) {
    try {
      return await this.db.$transaction(
        async (tx) => {
          const targetUser = await tx.user.findUnique({
            where: { id: userId, deletedAt: null },
            select: { id: true, telegramUserId: true },
          });
          if (!targetUser) return { status: 'user-not-found' as const };
          if (targetUser.telegramUserId && targetUser.telegramUserId !== input.telegramUserId) {
            return { status: 'user-already-linked' as const };
          }

          const telegramOwner = await tx.user.findUnique({
            where: { telegramUserId: input.telegramUserId },
            select: { id: true },
          });
          if (telegramOwner && telegramOwner.id !== userId) {
            return { status: 'telegram-already-linked' as const };
          }

          const user = await tx.user.update({
            where: { id: userId },
            data: {
              telegramUserId: input.telegramUserId,
              ...telegramIdentityData(input),
              isPremium: input.isPremium ?? false,
            },
            select: identityUserSelect,
          });

          return {
            status:
              targetUser.telegramUserId === input.telegramUserId ? 'already-linked' : 'linked',
            user,
          } as const;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return { status: 'telegram-already-linked' as const };
      }
      throw error;
    }
  }

  async linkWebCredentials(userId: string, input: WebCredentialsLinkInput, hashedPassword: string) {
    const email = input.email.toLowerCase();
    const authUsername = input.username.toLowerCase();

    try {
      return await this.db.$transaction(
        async (tx) => {
          const targetUser = await tx.user.findUnique({
            where: { id: userId, deletedAt: null },
            select: {
              id: true,
              telegramUserId: true,
              email: true,
              authUsername: true,
              authName: true,
              firstName: true,
              lastName: true,
              username: true,
            },
          });
          if (!targetUser) return { status: 'user-not-found' as const };

          const credentialAccount = await tx.authAccount.findFirst({
            where: { userId, providerId: 'credential' },
            select: { id: true },
          });
          if (credentialAccount) {
            return { status: 'web-credentials-already-linked' as const };
          }
          if (targetUser.email && targetUser.email.toLowerCase() !== email) {
            return { status: 'current-email-conflict' as const };
          }
          if (targetUser.authUsername && targetUser.authUsername.toLowerCase() !== authUsername) {
            return { status: 'current-username-conflict' as const };
          }

          const emailOwner = await tx.user.findUnique({
            where: { email },
            select: { id: true },
          });
          if (emailOwner && emailOwner.id !== userId) {
            return { status: 'email-already-linked' as const };
          }
          const usernameOwner = await tx.user.findUnique({
            where: { authUsername },
            select: { id: true },
          });
          if (usernameOwner && usernameOwner.id !== userId) {
            return { status: 'username-already-linked' as const };
          }

          const authName =
            targetUser.authName ||
            [targetUser.firstName, targetUser.lastName].filter(Boolean).join(' ').trim() ||
            targetUser.username ||
            input.username;

          const user = await tx.user.update({
            where: { id: userId },
            data: {
              email,
              emailVerified: false,
              authUsername,
              displayAuthUsername: input.username,
              authName,
            },
            select: identityUserSelect,
          });

          await tx.authAccount.create({
            data: {
              id: randomUUID(),
              accountId: userId,
              providerId: 'credential',
              userId,
              password: hashedPassword,
            },
          });

          return { status: 'linked' as const, user };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const target = constraintTarget(error);
        if (target.some((field) => field.includes('email'))) {
          return { status: 'email-already-linked' as const };
        }
        if (target.some((field) => field.includes('authUsername'))) {
          return { status: 'username-already-linked' as const };
        }
        return { status: 'web-credentials-already-linked' as const };
      }
      throw error;
    }
  }

  getIdentityUser(userId: string) {
    return this.db.user.findUnique({
      where: { id: userId, deletedAt: null },
      select: identityUserSelect,
    });
  }

  async getMe(userId: string) {
    const [user, presentation] = await Promise.all([
      this.db.user.findUniqueOrThrow({
        where: { id: userId },
        select: meSelect,
      }),
      this.db.userProfilePresentation.findUnique({
        where: { userId },
        select: presentationSelect,
      }),
    ]);
    return toMeView(user, presentation);
  }

  async getPublicProfile(userId: string) {
    const [user, presentation] = await Promise.all([
      this.db.user.findFirst({
        where: { id: userId, deletedAt: null },
        select: publicProfileSelect,
      }),
      this.db.userProfilePresentation.findUnique({
        where: { userId },
        select: presentationSelect,
      }),
    ]);
    return user ? toPublicProfileView(user, presentation) : null;
  }

  async updateProfile(userId: string, input: ProfileUpdateInput) {
    const { themeOverride, displayName, photoUrl, favoriteClubId, selectedIdentities, ...profile } =
      input;
    const profileUpdate = {
      ...(profile.skillLevel !== undefined ? { skillLevel: profile.skillLevel } : {}),
      ...(profile.skillRating !== undefined ? { skillRating: profile.skillRating } : {}),
      ...(profile.preferredPositions !== undefined
        ? { preferredPositions: profile.preferredPositions }
        : {}),
      ...(profile.profileAudience !== undefined
        ? { profileAudience: profile.profileAudience }
        : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
      ...(favoriteClubId !== undefined
        ? {
            favoriteClub: favoriteClubId
              ? { connect: { id: favoriteClubId } }
              : { disconnect: true },
          }
        : {}),
    };
    const profileCreate = {
      ...(profile.skillLevel !== undefined ? { skillLevel: profile.skillLevel } : {}),
      ...(profile.skillRating !== undefined ? { skillRating: profile.skillRating } : {}),
      ...(profile.preferredPositions !== undefined
        ? { preferredPositions: profile.preferredPositions }
        : {}),
      ...(profile.profileAudience !== undefined
        ? { profileAudience: profile.profileAudience }
        : {}),
      ...(profile.bio !== undefined ? { bio: profile.bio } : {}),
      ...(favoriteClubId
        ? {
            favoriteClub: { connect: { id: favoriteClubId } },
          }
        : {}),
    };
    const presentationChanged = displayName !== undefined || photoUrl !== undefined;

    return this.db.$transaction(async (tx) => {
      if (presentationChanged) {
        await tx.userProfilePresentation.upsert({
          where: { userId },
          create: {
            userId,
            ...(displayName !== undefined ? { displayName } : {}),
            ...(photoUrl !== undefined ? { photoUrl } : {}),
          },
          update: {
            ...(displayName !== undefined ? { displayName } : {}),
            ...(photoUrl !== undefined ? { photoUrl } : {}),
          },
        });
      }

      await tx.playerProfile.upsert({
        where: { userId },
        create: {
          user: { connect: { id: userId } },
          ...profileCreate,
        },
        update: profileUpdate,
      });

      await tx.userPreference.upsert({
        where: { userId },
        create: {
          user: { connect: { id: userId } },
          ...(themeOverride !== undefined
            ? { themeOverride: themeOverride as 'TELEGRAM' | 'LIGHT' | 'DARK' }
            : {}),
        },
        update:
          themeOverride !== undefined
            ? { themeOverride: themeOverride as 'TELEGRAM' | 'LIGHT' | 'DARK' }
            : {},
      });

      if (selectedIdentities !== undefined) {
        await tx.userProfileIdentity.deleteMany({ where: { userId } });
        if (selectedIdentities.length) {
          await tx.userProfileIdentity.createMany({
            data: selectedIdentities.map((type) => ({ userId, type })),
          });
        }
      } else if (profile.profileAudience !== undefined) {
        if (profile.profileAudience === 'FAN') {
          await tx.userProfileIdentity.upsert({
            where: { userId_type: { userId, type: 'FAN' } },
            create: { userId, type: 'FAN' },
            update: {},
          });
        } else {
          await tx.userProfileIdentity.deleteMany({ where: { userId, type: 'FAN' } });
        }
      }

      const [user, presentation] = await Promise.all([
        tx.user.findUniqueOrThrow({
          where: { id: userId },
          select: meSelect,
        }),
        tx.userProfilePresentation.findUnique({
          where: { userId },
          select: presentationSelect,
        }),
      ]);
      return toMeView(user, presentation);
    });
  }
}
