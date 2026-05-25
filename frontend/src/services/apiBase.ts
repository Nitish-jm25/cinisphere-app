const trimTrailingSlash = (value: string) => value.replace(/\/$/, '');

export const withApiPath = (value: string) => {
  const base = trimTrailingSlash(value);
  return base.endsWith('/api') ? base : `${base}/api`;
};

