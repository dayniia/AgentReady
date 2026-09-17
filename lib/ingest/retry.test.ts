import { describe, expect, it } from "vitest";
import { isRetryableFetchError, withFetchRetries } from "./retry";
import { UnsafeUrlError } from "./ssrf";

describe("withFetchRetries", () => {
  it("retries retryable failures then succeeds", async () => {
    let calls = 0;
    const value = await withFetchRetries(async () => {
      calls += 1;
      if (calls < 3) throw new Error("Timeout contacting example.com");
      return "ok";
    });
    expect(value).toBe("ok");
    expect(calls).toBe(3);
  });

  it("does not retry SSRF rejections", async () => {
    let calls = 0;
    await expect(
      withFetchRetries(async () => {
        calls += 1;
        throw new UnsafeUrlError("Private or metadata hosts are not allowed");
      }),
    ).rejects.toThrow(UnsafeUrlError);
    expect(calls).toBe(1);
  });
});

describe("isRetryableFetchError", () => {
  it("retries timeouts and not allowlist errors", () => {
    expect(isRetryableFetchError(new Error("Timeout contacting vercel.com"))).toBe(
      true,
    );
    expect(isRetryableFetchError(new UnsafeUrlError("Only HTTPS URLs are allowed"))).toBe(
      false,
    );
  });
});
