/** Whether every targeted subscriber received the release email. */
export function isReleaseEmailBroadcastComplete(sent: number, subscriberCount: number): boolean {
  if (subscriberCount === 0) return true;
  return sent === subscriberCount;
}
