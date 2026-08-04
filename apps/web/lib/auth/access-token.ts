type AccessTokenListener = (accessToken: string | null) => void;

let currentAccessToken: string | null = null;
const listeners = new Set<AccessTokenListener>();

export const getAccessToken = () => currentAccessToken;

export const setAccessToken = (accessToken: string | null) => {
  currentAccessToken = accessToken;
  listeners.forEach((listener) => listener(accessToken));
};

export const subscribeToAccessToken = (listener: AccessTokenListener) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
