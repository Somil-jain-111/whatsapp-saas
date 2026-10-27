import { describe, expect, it } from "vitest";
import {
  appendTemplateVariable,
  componentsFromEditor,
  metaPopupSize,
  parseEmbeddedSignupResult,
  substituteTemplateVariables,
  templateVariableIndexes,
} from "./phase-two-utils";

const draft = {
  accountId: "00000000-0000-4000-8000-000000000000",
  name: "order_ready",
  language: "en",
  category: "UTILITY",
  headerFormat: "TEXT",
  headerText: "Hi {{1}}",
  headerExamples: ["Asha"],
  mediaHandle: "",
  body: "Order {{1}} for {{2}} is ready",
  bodyExamples: ["ORD-1001", "Asha"],
  footer: "Thank you",
  buttonType: "URL",
  buttonText: "Track order",
  buttonValue: "https://example.com/orders/ORD-1001",
};

describe("phase two template builder", () => {
  it("builds the validated component payload used by the API", () => {
    expect(componentsFromEditor(draft)).toEqual([
      {
        type: "HEADER",
        payload: { format: "TEXT", text: "Hi {{1}}", examples: ["Asha"] },
      },
      {
        type: "BODY",
        payload: {
          text: "Order {{1}} for {{2}} is ready",
          examples: ["ORD-1001", "Asha"],
        },
      },
      { type: "FOOTER", payload: { text: "Thank you" } },
      {
        type: "BUTTONS",
        payload: {
          buttons: [
            {
              type: "URL",
              text: "Track order",
              url: "https://example.com/orders/ORD-1001",
            },
          ],
        },
      },
    ]);
  });

  it("previews known variables and leaves missing ones visible", () => {
    expect(substituteTemplateVariables("Hi {{1}} / {{2}}", ["Asha"])).toBe(
      "Hi Asha / {{2}}",
    );
  });

  it("detects unique variables and appends the next placeholder", () => {
    expect(templateVariableIndexes("Hi {{2}}, again {{1}} and {{2}}"))
      .toEqual([1, 2]);
    expect(appendTemplateVariable("Hi {{1}}"))
      .toBe("Hi {{1}} {{2}}");
  });

  it("accepts standard and coexistence Embedded Signup completion events", () => {
    for (const event of [
      "FINISH",
      "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING",
    ]) {
      expect(
        parseEmbeddedSignupResult({
          type: "WA_EMBEDDED_SIGNUP",
          event,
          data: { waba_id: "123456" },
        }),
      ).toEqual({ status: "FINISHED", wabaId: "123456" });
    }
  });

  it("ignores unrelated messages and reports cancelled signup", () => {
    expect(parseEmbeddedSignupResult({ type: "OTHER", event: "FINISH" }))
      .toBeNull();
    expect(
      parseEmbeddedSignupResult(
        JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event: "CANCEL" }),
      ),
    ).toEqual({ status: "CANCELLED" });
  });

  it("uses a compact Meta popup while respecting small screens", () => {
    expect(metaPopupSize(1920, 1080)).toEqual({ width: 680, height: 760 });
    expect(metaPopupSize(390, 844)).toEqual({ width: 358, height: 760 });
  });
});
