import { BadRequestException } from "@nestjs/common";

export type InteractiveMessage =
  | {
      type: "BUTTON";
      body: string;
      header?: string;
      footer?: string;
      buttons: Array<{ id: string; title: string }>;
    }
  | {
      type: "LIST";
      body: string;
      header?: string;
      footer?: string;
      buttonText: string;
      sections: Array<{
        title?: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    };

const text = (value: unknown, max: number, required = false) => {
  if (value === undefined && !required) return;
  if (
    typeof value !== "string" ||
    (required && !value.trim()) ||
    value.length > max
  )
    throw new BadRequestException("Interactive message text is invalid");
};

export function validateInteractiveMessage(value: unknown): InteractiveMessage {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new BadRequestException(
      "Interactive message configuration is required",
    );
  const input = value as Record<string, any>;
  text(input.body, 1024, true);
  text(input.header, 60);
  text(input.footer, 60);
  if (input.type === "BUTTON") {
    if (
      !Array.isArray(input.buttons) ||
      input.buttons.length < 1 ||
      input.buttons.length > 3
    )
      throw new BadRequestException(
        "Interactive buttons must contain 1-3 replies",
      );
    const ids = new Set<string>();
    for (const button of input.buttons) {
      text(button?.id, 256, true);
      text(button?.title, 20, true);
      if (ids.has(button.id))
        throw new BadRequestException("Interactive reply IDs must be unique");
      ids.add(button.id);
    }
    return {
      type: "BUTTON",
      body: input.body,
      ...(input.header ? { header: input.header } : {}),
      ...(input.footer ? { footer: input.footer } : {}),
      buttons: input.buttons.map((button: Record<string, string>) => ({
        id: button.id,
        title: button.title,
      })),
    };
  }
  if (input.type === "LIST") {
    text(input.buttonText, 20, true);
    if (
      !Array.isArray(input.sections) ||
      input.sections.length < 1 ||
      input.sections.length > 10
    )
      throw new BadRequestException(
        "Interactive lists must contain 1-10 sections",
      );
    const ids = new Set<string>();
    let rows = 0;
    for (const section of input.sections) {
      text(section?.title, 24);
      if (!Array.isArray(section?.rows) || !section.rows.length)
        throw new BadRequestException(
          "Every interactive list section requires rows",
        );
      rows += section.rows.length;
      for (const row of section.rows) {
        text(row?.id, 200, true);
        text(row?.title, 24, true);
        text(row?.description, 72);
        if (ids.has(row.id))
          throw new BadRequestException("Interactive row IDs must be unique");
        ids.add(row.id);
      }
    }
    if (rows > 10)
      throw new BadRequestException(
        "Interactive lists support at most 10 rows",
      );
    return {
      type: "LIST",
      body: input.body,
      ...(input.header ? { header: input.header } : {}),
      ...(input.footer ? { footer: input.footer } : {}),
      buttonText: input.buttonText,
      sections: input.sections.map((section: Record<string, any>) => ({
        ...(section.title ? { title: section.title } : {}),
        rows: section.rows.map((row: Record<string, string>) => ({
          id: row.id,
          title: row.title,
          ...(row.description ? { description: row.description } : {}),
        })),
      })),
    };
  }
  throw new BadRequestException("Interactive type must be BUTTON or LIST");
}

export function buildMetaInteractivePayload(input: InteractiveMessage) {
  const common = {
    type: input.type.toLowerCase(),
    ...(input.header ? { header: { type: "text", text: input.header } } : {}),
    body: { text: input.body },
    ...(input.footer ? { footer: { text: input.footer } } : {}),
  };
  return input.type === "BUTTON"
    ? {
        ...common,
        action: {
          buttons: input.buttons.map((button) => ({
            type: "reply",
            reply: button,
          })),
        },
      }
    : {
        ...common,
        action: {
          button: input.buttonText,
          sections: input.sections,
        },
      };
}
