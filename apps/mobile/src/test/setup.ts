jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  init: jest.fn(),
  reactNavigationIntegration: () => ({
    registerNavigationContainer: jest.fn(),
  }),
  withScope: (callback: (scope: unknown) => void) =>
    callback({ setContext: jest.fn(), setTag: jest.fn() }),
  wrap: <T>(component: T): T => component,
}));

jest.mock("@react-native-async-storage/async-storage", () => {
  const asyncStorageMock: unknown = jest.requireActual(
    "@react-native-async-storage/async-storage/jest/async-storage-mock",
  );
  return asyncStorageMock;
});

export {};
