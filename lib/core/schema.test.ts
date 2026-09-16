import { describe, expect, it } from "vitest";
import { parseClassification } from "./schema";

describe("parseClassification", () => {
  it("maps valid JSON through", () => {
    expect(
      parseClassification({
        action_name: "list_bookings",
        description: "List all bookings",
        action_type: "read",
        parameters: [{ name: "q", in: "query", required: false }],
      }),
    ).toMatchObject({
      action_name: "list_bookings",
      action_type: "read",
    });
  });

  it("rejects malformed, missing, and extra invalid fields", () => {
    expect(parseClassification(null)).toBeNull();
    expect(parseClassification("not json")).toBeNull();
    expect(
      parseClassification({
        action_name: "x",
        description: "y",
      }),
    ).toBeNull();
    expect(
      parseClassification({
        action_name: "x",
        description: "y",
        action_type: "explode",
      }),
    ).toBeNull();
  });
});
