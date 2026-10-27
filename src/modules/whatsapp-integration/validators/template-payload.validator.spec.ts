import { BadRequestException } from "@nestjs/common";
import { TemplatePayloadValidator } from "./template-payload.validator";

describe("TemplatePayloadValidator", () => {
  const validator = new TemplatePayloadValidator();

  it("accepts contiguous placeholders with examples", () => {
    expect(() =>
      validator.validate([
        {
          type: "BODY",
          payload: {
            text: "Hello {{1}}, order {{2}} is ready",
            examples: ["Sam", "A-1"],
          },
        },
      ]),
    ).not.toThrow();
  });

  it("rejects gaps and missing example values", () => {
    expect(() =>
      validator.validate([
        { type: "BODY", payload: { text: "Hello {{2}}", examples: ["Sam"] } },
      ]),
    ).toThrow(BadRequestException);
    expect(() =>
      validator.validate([{ type: "BODY", payload: { text: "Hello {{1}}" } }]),
    ).toThrow(BadRequestException);
  });

  it("rejects unsafe or non-HTTPS buttons", () => {
    expect(() =>
      validator.validate([
        { type: "BODY", payload: { text: "Hello" } },
        {
          type: "BUTTONS",
          payload: {
            buttons: [{ type: "URL", text: "Open", url: "http://example.com" }],
          },
        },
      ]),
    ).toThrow(BadRequestException);
  });
});
