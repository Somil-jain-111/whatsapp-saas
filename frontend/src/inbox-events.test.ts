import { describe, expect, it } from "vitest";
import { parseInboxEventFrames } from "./inbox-events";

describe("parseInboxEventFrames", () => {
  it("keeps a partial frame and parses complete multi-line events", () => {
    const result = parseInboxEventFrames(
      'id: 7\nevent: message.received\ndata: {"messageId":\ndata: "m1"}\n\nid: 8\ndata: {',
    );
    expect(result.events).toEqual([
      { id: "7", event: "message.received", data: { messageId: "m1" } },
    ]);
    expect(result.rest).toBe("id: 8\ndata: {");
  });

  it("ignores malformed event data", () => {
    expect(parseInboxEventFrames("data: nope\n\n").events).toEqual([]);
  });
});
