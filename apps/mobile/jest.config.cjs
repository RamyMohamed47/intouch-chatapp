module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/src/test/setup.ts"],
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  moduleNameMapper: {
    "^@intouch/shared/(.*)$":
      "<rootDir>/../../packages/shared/dist/$1/index.js",
  },
};
