import { readFileSync, readdirSync } from "fs";
import { join } from "path";

function files(path: string): string[] {
  return readdirSync(path, { withFileTypes: true }).flatMap((entry) => {
    const target = join(path, entry.name);
    return entry.isDirectory()
      ? files(target)
      : entry.name.endsWith(".controller.ts")
        ? [target]
        : [];
  });
}

describe("controller architecture", () => {
  const controllers = files(join(process.cwd(), "src/modules"));

  it.each(controllers)("%s depends on services, not repositories", (file) => {
    const source = readFileSync(file, "utf8");
    expect(source).not.toMatch(/from\s+["'][^"']*repository["']/i);
    expect(source).not.toMatch(/\b(DataSource|EntityManager)\b/);
  });

  it.each(controllers)("%s delegates domain errors to services", (file) => {
    expect(readFileSync(file, "utf8")).not.toMatch(/throw\s+new\s+/);
  });
});
