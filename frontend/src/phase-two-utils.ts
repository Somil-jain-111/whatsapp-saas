export type TemplateEditorState = {
  accountId: string;
  name: string;
  language: string;
  category: string;
  headerFormat: string;
  headerText: string;
  headerExamples: string[];
  mediaHandle: string;
  body: string;
  bodyExamples: string[];
  footer: string;
  buttonType: string;
  buttonText: string;
  buttonValue: string;
};

export type EmbeddedSignupResult =
  | { status: "FINISHED"; wabaId: string }
  | { status: "CANCELLED" }
  | { status: "ERROR" }
  | null;

export function metaPopupSize(availableWidth: number, availableHeight: number) {
  return {
    width: Math.min(680, Math.max(320, availableWidth - 32)),
    height: Math.min(760, Math.max(560, availableHeight - 32)),
  };
}

export function parseEmbeddedSignupResult(
  payload: unknown,
): EmbeddedSignupResult {
  let message: unknown = payload;
  if (typeof payload === "string") {
    try {
      message = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!message || typeof message !== "object") return null;
  const value = message as {
    type?: unknown;
    event?: unknown;
    data?: { waba_id?: unknown };
  };
  if (value.type !== "WA_EMBEDDED_SIGNUP") return null;
  if (
    value.event === "FINISH" ||
    value.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING"
  ) {
    const wabaId = String(value.data?.waba_id ?? "");
    return wabaId ? { status: "FINISHED", wabaId } : { status: "ERROR" };
  }
  if (value.event === "CANCEL") return { status: "CANCELLED" };
  if (value.event === "ERROR") return { status: "ERROR" };
  return null;
}

export function componentsFromEditor(form: TemplateEditorState) {
  const components: Array<{ type: string; payload: Record<string, unknown> }> =
    [];
  if (form.headerFormat)
    components.push({
      type: "HEADER",
      payload:
        form.headerFormat === "TEXT"
          ? {
              format: "TEXT",
              text: form.headerText,
              examples: templateVariableExamples(
                form.headerText,
                form.headerExamples,
              ),
            }
          : { format: form.headerFormat, exampleHandle: form.mediaHandle },
    });
  components.push({
    type: "BODY",
    payload: {
      text: form.body,
      examples: templateVariableExamples(form.body, form.bodyExamples),
    },
  });
  if (form.footer.trim())
    components.push({ type: "FOOTER", payload: { text: form.footer } });
  if (form.buttonType)
    components.push({
      type: "BUTTONS",
      payload: {
        buttons: [
          {
            type: form.buttonType,
            text: form.buttonText,
            ...(form.buttonType === "URL"
              ? { url: form.buttonValue }
              : form.buttonType === "PHONE_NUMBER"
                ? { phoneNumber: form.buttonValue }
                : {}),
          },
        ],
      },
    });
  return components;
}

export function templateVariableIndexes(value: string): number[] {
  return [...new Set([...value.matchAll(/{{(\d+)}}/g)].map((match) => Number(match[1])))]
    .filter((index) => index > 0)
    .sort((left, right) => left - right);
}

export function appendTemplateVariable(value: string): string {
  const indexes = templateVariableIndexes(value);
  const next = (indexes.at(-1) ?? 0) + 1;
  return `${value}${value && !/\s$/.test(value) ? " " : ""}{{${next}}}`;
}

function templateVariableExamples(value: string, examples: string[]) {
  const indexes = templateVariableIndexes(value);
  return indexes.length
    ? indexes.map((index) => examples[index - 1]?.trim() ?? "")
    : undefined;
}

export function substituteTemplateVariables(value: string, examples: string[]) {
  return value.replace(
    /{{(\d+)}}/g,
    (_, index: string) => examples[Number(index) - 1] || `{{${index}}}`,
  );
}
