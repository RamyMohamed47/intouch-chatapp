import { ThemeName, themes } from "./theme";

describe("mobile themes", () => {
  it("defines complete tokens for every V1 theme", () => {
    expect(Object.keys(themes).sort()).toEqual(Object.values(ThemeName).sort());

    for (const theme of Object.values(themes)) {
      expect(theme.background).toMatch(/^#/);
      expect(theme.panel).toMatch(/^#/);
      expect(theme.text).not.toBe(theme.background);
      expect(theme.accent).not.toBe(theme.background);
    }
  });
});
