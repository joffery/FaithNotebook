type SortableSermon = {
  youtube_published_at?: string | null;
  processed_at?: string | null;
};

const parseSortableDate = (value?: string | null) => {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? 0 : parsed;
};

export const getSermonSortTime = (sermon: SortableSermon) =>
  parseSortableDate(sermon.youtube_published_at) || parseSortableDate(sermon.processed_at);

export const getPrimarySermonDate = (sermon: SortableSermon) =>
  sermon.youtube_published_at || sermon.processed_at || null;

export const formatSermonDate = (value?: string | null) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatSermonMonth = (value?: string | null) => {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  return parsed.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
  });
};

export const sortSermonsNewestFirst = <T extends SortableSermon>(sermons: T[]) =>
  [...sermons].sort((a, b) => getSermonSortTime(b) - getSermonSortTime(a));
