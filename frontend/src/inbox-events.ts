export interface InboxEvent {
  id?: string;
  event?: string;
  data: unknown;
}

export function parseInboxEventFrames(input: string) {
  const normalized = input.replaceAll("\r\n", "\n");
  const parts = normalized.split("\n\n");
  const rest = parts.pop() ?? "";
  const events = parts.flatMap((frame): InboxEvent[] => {
    let id: string | undefined;
    let event: string | undefined;
    const data: string[] = [];
    for (const line of frame.split("\n")) {
      if (line.startsWith("id:")) id = line.slice(3).trim();
      else if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (!data.length) return [];
    try {
      return [{ id, event, data: JSON.parse(data.join("\n")) }];
    } catch {
      return [];
    }
  });
  return { events, rest };
}
