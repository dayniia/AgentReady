import { describe, expect, it } from "vitest";
import { runScore } from "./score";
import type { FetchedDoc } from "@/lib/ingest/live";

function doc(url: string, status: number, body: string): FetchedDoc {
  return {
    requestedUrl: url,
    finalUrl: url,
    status,
    contentType: "text/html",
    body,
  };
}

describe("runScore", () => {
  it("scores using mocked well-known documents", async () => {
    const result = await runScore("https://shop.example/", {
      fetchDocument: async (url) => {
        if (url === "https://shop.example/" || url === "https://shop.example") {
          return doc(
            "https://shop.example/",
            200,
            `<html><head><title>Shop</title><meta name="description" content="A shop for agents to browse products and book widgets." /></head><body><main><h1>Shop</h1><p>${"Hello from the server-rendered homepage. ".repeat(8)}</p></main></body></html>`,
          );
        }
        if (url.endsWith("/llms.txt")) {
          return doc(
            url,
            200,
            `# Shop\n\nShop is a demo catalog with bookings and search for agents.\n\n- [A](https://shop.example/a)\n- [B](https://shop.example/b)\n- [C](https://shop.example/c)\n`,
          );
        }
        return doc(url, 404, "");
      },
    });
    expect(result.today.total).toBeGreaterThan(40);
    expect(result.checks.find((item) => item.id === "llms")?.status).toBe("pass");
    expect(result.origin).toBe("https://shop.example");
  });

  it("treats a non-2xx homepage as a scan error", async () => {
    await expect(
      runScore("https://shop.example/", {
        fetchDocument: async (url) => doc(url, 404, "missing"),
      }),
    ).rejects.toThrow(/Could not fetch URL/);
  });

  it("retries homepage fetch then records probe timeouts as unverified", async () => {
    let homepageCalls = 0;
    const result = await runScore("https://shop.example/", {
      fetchDocument: async (url) => {
        if (url === "https://shop.example/" || url === "https://shop.example") {
          homepageCalls += 1;
          if (homepageCalls < 2) {
            throw new Error("Timeout contacting shop.example");
          }
          return doc(
            "https://shop.example/",
            200,
            `<html><head><title>Shop</title><meta name="description" content="A shop for agents to browse products and book widgets." /></head><body><main><h1>Shop</h1><p>${"Hello from the server-rendered homepage. ".repeat(8)}</p></main></body></html>`,
          );
        }
        if (url.endsWith("/openapi.json")) {
          throw new Error("Timeout contacting shop.example");
        }
        return doc(url, 404, "");
      },
    });
    expect(homepageCalls).toBe(2);
    expect(result.checks.find((item) => item.id === "openapi")?.status).toBe(
      "unverified",
    );
  });

  it("rejects private live URLs before fetching", async () => {
    await expect(runScore("http://127.0.0.1")).rejects.toThrow(/HTTPS/);
  });
});
