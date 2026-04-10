const getYouTubeVideoId = (url: string) => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname === 'youtu.be') {
      return parsed.pathname.replace(/^\/+/, '').trim() || null;
    }

    if (parsed.hostname.includes('youtube.com')) {
      if (parsed.pathname === '/watch') {
        return parsed.searchParams.get('v');
      }

      const segments = parsed.pathname.split('/').filter(Boolean);
      const embedIndex = segments.findIndex((segment) => segment === 'embed' || segment === 'shorts');
      if (embedIndex >= 0) {
        return segments[embedIndex + 1] || null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const buildTimestampedYouTubeUrl = (url?: string | null, startSeconds?: number | null) => {
  const trimmedUrl = url?.trim() || '';
  if (!trimmedUrl) return '';

  const safeSeconds = typeof startSeconds === 'number' && Number.isFinite(startSeconds)
    ? Math.max(0, Math.floor(startSeconds))
    : null;

  if (safeSeconds === null || safeSeconds <= 0) {
    return trimmedUrl;
  }

  const videoId = getYouTubeVideoId(trimmedUrl);
  if (!videoId) {
    return trimmedUrl;
  }

  return `https://www.youtube.com/watch?v=${videoId}&t=${safeSeconds}s&start=${safeSeconds}`;
};

export const formatVideoTimestamp = (seconds?: number | null) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 0) {
    return '';
  }

  const totalSeconds = Math.floor(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const remainingSeconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
};
