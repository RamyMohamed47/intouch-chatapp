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

export {};
