export const getApiUrl = (): string => {
  return process.env.API_URL || 'http://localhost:3000';
};

export const fetchApi = async (
  path: string,
  options?: RequestInit,
): Promise<Response> => {
  const url = `${getApiUrl()}${path}`;
  return fetch(url, options);
};
