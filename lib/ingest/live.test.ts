import { describe, expect, it } from "vitest";
import { fetchSafeHttps, parseDohAnswers } from "./live";
import { UnsafeUrlError } from "./ssrf";

function jsonResponse(status: number, body: string, headers: Record<string, string> = {}) {
  return new Response(body, { status, headers });
}

describe("fetchSafeHttps", () => {
  it("follows a same-host redirect after re-checking the Location", async () => {
    const fetchImpl = async (input: string) => {
      if (input === "https://example.com/from") {
        return jsonResponse(302, "", { location: "/to" });
      }
      return jsonResponse(200, "<html>ok</html>", {
        "content-type": "text/html",
      });
    };

    const doc = await fetchSafeHttps("https://example.com/from", {
      fetch: fetchImpl,
      lookup: async () => [{ address: "93.184.216.34", family: 4 }],
    });
    expect(doc.status).toBe(200);
    expect(doc.finalUrl).toBe("https://example.com/to");
    expect(doc.body).toContain("ok");
  });

  it("rejects a redirect to a private host", async () => {
    const fetchImpl = async () =>
      jsonResponse(302, "", { location: "https://127.0.0.1/secret" });

    await expect(
      fetchSafeHttps("https://example.com/", {
        fetch: fetchImpl,
        lookup: async () => [{ address: "93.184.216.34", family: 4 }],
      }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("rejects DNS that resolves to a private address", async () => {
    await expect(
      fetchSafeHttps("https://example.com/", {
        fetch: async () => jsonResponse(200, "nope"),
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      }),
    ).rejects.toThrow(UnsafeUrlError);
  });

  it("falls back when system DNS throws ENOTFOUND", async () => {
    const doc = await fetchSafeHttps("https://example.com/", {
      fetch: async () => jsonResponse(200, "<html>ok</html>"),
      lookup: async () => {
        throw new Error("getaddrinfo ENOTFOUND example.com");
      },
      fallbackLookup: async () => [{ address: "93.184.216.34", family: 4 }],
    });
    expect(doc.status).toBe(200);
    expect(doc.body).toContain("ok");
  });
});

describe("parseDohAnswers", () => {
  it("reads A and AAAA records", () => {
    expect(
      parseDohAnswers({
        Answer: [
          { type: 1, data: "93.184.216.34" },
          { type: 28, data: "2606:2800:220:1:248:1893:25c8:1946" },
          { type: 5, data: "example.net." },
        ],
      }),
    ).toEqual([
      { address: "93.184.216.34", family: 4 },
      { address: "2606:2800:220:1:248:1893:25c8:1946", family: 6 },
    ]);
  });
});
