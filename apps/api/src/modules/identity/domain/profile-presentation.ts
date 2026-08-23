export type UserPresentationSource = {
  username?: string | null;
  authName?: string | null;
  authUsername?: string | null;
  displayAuthUsername?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  photoUrl?: string | null;
};

export type UserPresentationOverride = {
  displayName?: string | null;
  photoUrl?: string | null;
} | null;

function nonBlank(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

export function resolveUserPresentation(
  user: UserPresentationSource,
  presentation: UserPresentationOverride,
) {
  const effectiveUsername =
    nonBlank(user.displayAuthUsername) ?? nonBlank(user.authUsername) ?? nonBlank(user.username);
  const providerDisplayName = nonBlank([user.firstName, user.lastName].filter(Boolean).join(' '));
  const effectiveDisplayName =
    nonBlank(presentation?.displayName) ??
    nonBlank(user.authName) ??
    providerDisplayName ??
    effectiveUsername ??
    'HOOMA member';
  const effectivePhotoUrl = nonBlank(presentation?.photoUrl) ?? nonBlank(user.photoUrl);

  return {
    effectiveDisplayName,
    effectiveUsername,
    effectivePhotoUrl,
  };
}
