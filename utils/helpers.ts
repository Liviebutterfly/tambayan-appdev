export const oneWeekAgo = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

export const avatarOptions = [
  require('../assets/images/shortcake.png'),
  require('../assets/images/cheesecake.png'),
  require('../assets/images/lollipop.png'),
  require('../assets/images/poptart.png'),
  require('../assets/images/milktea.png'),
  require('../assets/images/oreo.png'),
];

export const avatarAssetUrls = [
  'assets/images/shortcake.png',
  'assets/images/cheesecake.png',
  'assets/images/lollipop.png',
  'assets/images/poptart.png',
  'assets/images/milktea.png',
  'assets/images/oreo.png',
];

export const getAvatarIndexFromUrl = (avatarUrl?: string | null) => {
  if (!avatarUrl) return null;

  const normalized = avatarUrl.replace(/\\/g, '/').toLowerCase();
  const index = avatarAssetUrls.findIndex((assetUrl) => assetUrl.toLowerCase() === normalized);

  return index >= 0 ? index : null;
};

export const getAvatarUrlForIndex = (index: number | null | undefined) => {
  if (index === null || index === undefined || index < 0 || index >= avatarOptions.length) {
    return null;
  }

  return avatarAssetUrls[index];
};

