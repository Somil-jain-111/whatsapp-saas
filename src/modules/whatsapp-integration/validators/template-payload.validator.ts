import { BadRequestException, Injectable } from "@nestjs/common";
import { TemplateComponentDto } from "../dto/whatsapp-integration.dto";

@Injectable()
export class TemplatePayloadValidator {
  validate(components: TemplateComponentDto[]): void {
    const counts = new Map<string, number>();
    for (const component of components) {
      counts.set(component.type, (counts.get(component.type) ?? 0) + 1);
      this.rejectPrototypeKeys(component.payload);
    }
    if (counts.get("BODY") !== 1) {
      throw new BadRequestException(
        "A template must contain exactly one BODY component",
      );
    }
    for (const singleton of ["HEADER", "FOOTER", "BUTTONS"]) {
      if ((counts.get(singleton) ?? 0) > 1) {
        throw new BadRequestException(`${singleton} may appear only once`);
      }
    }

    for (const component of components) {
      if (component.type === "BODY")
        this.validateTextComponent(component.payload, true);
      if (component.type === "FOOTER")
        this.validateTextComponent(component.payload, false);
      if (component.type === "HEADER") this.validateHeader(component.payload);
      if (component.type === "BUTTONS") this.validateButtons(component.payload);
    }
  }

  private validateTextComponent(
    payload: Record<string, unknown>,
    required: boolean,
  ): void {
    const text = payload.text;
    if (typeof text !== "string" || (required && !text.trim())) {
      throw new BadRequestException("Template text is invalid");
    }
    const indexes = [...text.matchAll(/{{(\d+)}}/g)].map((match) =>
      Number(match[1]),
    );
    const unique = [...new Set(indexes)].sort((a, b) => a - b);
    if (unique.some((value, index) => value !== index + 1)) {
      throw new BadRequestException(
        "Template placeholders must be contiguous from {{1}}",
      );
    }
    if (unique.length) {
      const examples = payload.examples;
      if (!Array.isArray(examples) || examples.length !== unique.length) {
        throw new BadRequestException(
          "Every template placeholder requires one example value",
        );
      }
      if (
        examples.some(
          (example) => typeof example !== "string" || !example.trim(),
        )
      ) {
        throw new BadRequestException(
          "Template example values must be non-empty strings",
        );
      }
    }
  }

  private validateHeader(payload: Record<string, unknown>): void {
    const format = payload.format;
    if (!["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(String(format))) {
      throw new BadRequestException("Unsupported template header format");
    }
    if (format === "TEXT") this.validateTextComponent(payload, true);
    if (format !== "TEXT" && typeof payload.exampleHandle !== "string") {
      throw new BadRequestException(
        "Media headers require a provider upload handle",
      );
    }
  }

  private validateButtons(payload: Record<string, unknown>): void {
    if (!Array.isArray(payload.buttons) || payload.buttons.length === 0) {
      throw new BadRequestException(
        "BUTTONS requires a non-empty buttons array",
      );
    }
    for (const button of payload.buttons) {
      if (!button || typeof button !== "object")
        throw new BadRequestException("Invalid button");
      const value = button as Record<string, unknown>;
      if (
        !["QUICK_REPLY", "URL", "PHONE_NUMBER"].includes(String(value.type))
      ) {
        throw new BadRequestException("Unsupported button type");
      }
      if (typeof value.text !== "string" || !value.text.trim()) {
        throw new BadRequestException("Button text is required");
      }
      if (value.type === "URL") {
        try {
          const url = new URL(String(value.url));
          if (url.protocol !== "https:") throw new Error();
        } catch {
          throw new BadRequestException(
            "URL buttons require a valid HTTPS URL",
          );
        }
      }
      if (
        value.type === "PHONE_NUMBER" &&
        !/^\+[1-9]\d{1,14}$/.test(String(value.phoneNumber))
      ) {
        throw new BadRequestException(
          "Phone buttons require an E.164 phone number",
        );
      }
    }
  }

  private rejectPrototypeKeys(value: unknown): void {
    if (!value || typeof value !== "object") return;
    for (const [key, nested] of Object.entries(value)) {
      if (["__proto__", "constructor", "prototype"].includes(key)) {
        throw new BadRequestException("Unsafe component field");
      }
      this.rejectPrototypeKeys(nested);
    }
  }
}
