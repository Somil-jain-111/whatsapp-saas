import {
  buildMetaInteractivePayload,
  validateInteractiveMessage,
} from "./interactive-message";

describe("interactive messages", () => {
  it("validates and maps reply buttons to the Meta payload", () => {
    const input = validateInteractiveMessage({
      type: "BUTTON",
      body: "Choose an option",
      secret: "must-not-persist",
      buttons: [{ id: "support", title: "Support" }],
    });
    expect(buildMetaInteractivePayload(input)).toMatchObject({
      type: "button",
      action: {
        buttons: [
          { type: "reply", reply: { id: "support", title: "Support" } },
        ],
      },
    });
    expect(input).not.toHaveProperty("secret");
  });

  it("rejects duplicate IDs and list payloads over ten rows", () => {
    expect(() =>
      validateInteractiveMessage({
        type: "BUTTON",
        body: "Choose",
        buttons: [
          { id: "same", title: "One" },
          { id: "same", title: "Two" },
        ],
      }),
    ).toThrow("unique");
    expect(() =>
      validateInteractiveMessage({
        type: "LIST",
        body: "Choose",
        buttonText: "Open",
        sections: [
          {
            rows: Array.from({ length: 11 }, (_, index) => ({
              id: String(index),
              title: `Row ${index}`,
            })),
          },
        ],
      }),
    ).toThrow("at most 10 rows");
  });
});
