/** Scoped in-app and email key for pending invites — rotates when token changes on re-invite. */
export function teamInviteNotificationKey(inviteId: string, token: string): string {
  return `team:invite:${inviteId}:${token}`;
}
