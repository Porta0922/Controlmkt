export type Platform = 'web' | 'x' | 'instagram' | 'tiktok' | 'facebook';
export const platformNames: Record<Platform, string> = {web:'Web',x:'X / Twitter',instagram:'Instagram',tiktok:'TikTok',facebook:'Facebook'};
export function detectPlatform(input: string): Platform {
  const host = new URL(input).hostname.toLowerCase();
  const matches = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (matches('x.com') || matches('twitter.com')) return 'x';
  if (matches('instagram.com')) return 'instagram';
  if (matches('tiktok.com')) return 'tiktok';
  if (matches('facebook.com') || host === 'fb.watch' || host === 'fb.com') return 'facebook';
  return 'web';
}
