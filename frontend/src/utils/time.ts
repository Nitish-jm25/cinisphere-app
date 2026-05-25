const parseUtcDate = (value: string) => {
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(value)) {
    return new Date(value);
  }
  return new Date(`${value}Z`);
};

export const timeAgo = (createdAt: string): string => {
  const date = parseUtcDate(createdAt).getTime();
  const now = Date.now();
  const diff = Math.max(0, Math.floor((now - date) / 1000));
  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

export const timestampMs = (createdAt: string) => parseUtcDate(createdAt).getTime();

