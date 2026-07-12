import { buildAvatarApiUrl } from "./avatar-upload.js";

export type UserAvatarRow = {
  id: string;
  avatar_key: string | null;
  avatar_updated_at: Date | null;
};

export const userAvatarSelect = {
  avatar_key: true,
  avatar_updated_at: true,
} as const;

export function avatarUrlFromUser(
  user: Pick<UserAvatarRow, "id" | "avatar_key" | "avatar_updated_at">
): string | null {
  if (!user.avatar_key || !user.avatar_updated_at) return null;
  return buildAvatarApiUrl(user.id, user.avatar_updated_at);
}

export function publicUserAvatarFields(
  user: Pick<UserAvatarRow, "id" | "avatar_key" | "avatar_updated_at">
): { avatarUrl: string | null } {
  return { avatarUrl: avatarUrlFromUser(user) };
}
