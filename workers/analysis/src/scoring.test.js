import { describe, expect, it } from "vitest";
import { scoreRepository } from "./index.js";

const freshRepo = {
  pushed_at: new Date().toISOString(),
  archived: false,
  stargazers_count: 100,
  forks_count: 20,
  subscribers_count: 30,
  license: { spdx_id: "MIT" },
};

describe("RepoScope repository scoring", () => {
  it("returns a bounded weighted score with evidence for all six dimensions", () => {
    const result = scoreRepository({
      repo: freshRepo,
      languages: { TypeScript: 12000, CSS: 2000 },
      commits: [{ commit: { author: { date: new Date().toISOString() } } }],
      issues: [],
      pulls: [],
      readme: true,
      contents: [
        { path: "docs" },
        { path: ".github/workflows/ci.yml" },
        { path: "CONTRIBUTING.md" },
        { path: "package.json" },
        { path: "package-lock.json" },
        { path: ".github/dependabot.yml" },
      ],
    });

    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(Object.keys(result.dimensions)).toHaveLength(6);
    expect(result.dimensions.documentation.score).toBe(100);
    expect(result.dimensions.dependency_health.score).toBe(100);
  });

  it("reports missing documentation without crashing", () => {
    const result = scoreRepository({
      repo: { ...freshRepo, license: null },
      languages: {},
      commits: [],
      issues: [],
      pulls: [],
      readme: false,
      contents: [],
    });

    expect(result.dimensions.documentation.score).toBe(0);
    expect(result.findings.some((finding) => finding.title === "README is missing")).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
