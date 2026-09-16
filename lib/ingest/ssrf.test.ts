import { describe, expect, it } from "vitest";
import { parseGitHubRepoUrl, UnsafeUrlError } from "./ssrf";

describe("parseGitHubRepoUrl", () => {
  it("parses owner/repo shorthand, quotes, and trailing punctuation", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/dayniia/AgentReady"),
    ).toEqual({ owner: "dayniia", repo: "AgentReady", ref: undefined });
    expect(parseGitHubRepoUrl("dayniia/AgentReady")).toEqual({
      owner: "dayniia",
      repo: "AgentReady",
      ref: undefined,
    });
    expect(
      parseGitHubRepoUrl("https://github.com/dayniia/AgentReady)"),
    ).toEqual({ owner: "dayniia", repo: "AgentReady", ref: undefined });
    expect(
      parseGitHubRepoUrl("<https://github.com/dayniia/AgentReady.git>"),
    ).toEqual({ owner: "dayniia", repo: "AgentReady", ref: undefined });
  });

  it("parses .git suffixes and tree refs", () => {
    expect(
      parseGitHubRepoUrl("https://github.com/dayniia/AgentReady.git"),
    ).toEqual({ owner: "dayniia", repo: "AgentReady", ref: undefined });
    expect(
      parseGitHubRepoUrl(
        "https://github.com/dayniia/AgentReady/tree/feat/v0.1-core",
      ),
    ).toEqual({
      owner: "dayniia",
      repo: "AgentReady",
      ref: "feat/v0.1-core",
    });
  });

  it("parses blob URLs as owner/repo plus first ref segment", () => {
    expect(
      parseGitHubRepoUrl(
        "https://github.com/dayniia/AgentReady/blob/main/README.md",
      ),
    ).toEqual({ owner: "dayniia", repo: "AgentReady", ref: "main" });
  });

  it("rejects localhost, metadata, and non-GitHub hosts", () => {
    const blocked = [
      "http://127.0.0.1/secret",
      "https://127.0.0.1/secret",
      "http://localhost:3000",
      "https://169.254.169.254/latest/meta-data",
      "https://evil.com/dayniia/AgentReady",
      "https://github.com.evil.com/dayniia/AgentReady",
      "file:///etc/passwd",
    ];
    for (const url of blocked) {
      expect(() => parseGitHubRepoUrl(url)).toThrow(UnsafeUrlError);
    }
  });

  it("rejects credentials, missing repo, and junk", () => {
    expect(() =>
      parseGitHubRepoUrl("https://user:pass@github.com/dayniia/AgentReady"),
    ).toThrow(UnsafeUrlError);
    expect(() => parseGitHubRepoUrl("https://github.com/only-owner")).toThrow(
      UnsafeUrlError,
    );
    expect(() => parseGitHubRepoUrl("not a url")).toThrow(UnsafeUrlError);
  });
});
