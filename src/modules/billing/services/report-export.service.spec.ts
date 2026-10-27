import { ReportExportService } from "./report-export.service";
import { readFile } from "fs/promises";
import { randomUUID } from "crypto";

describe("ReportExportService", () => {
  it("neutralizes spreadsheet formulas", () => {
    const service = new ReportExportService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
    expect((service as any).safeSpreadsheetValue('=HYPERLINK("x")')).toBe(
      '\'=HYPERLINK("x")',
    );
    expect((service as any).safeSpreadsheetValue("normal")).toBe("normal");
  });

  it.each([
    ["CSV", Buffer.from("id").toString("hex")],
    ["XLSX", "504b"],
    ["PDF", Buffer.from("%PDF").toString("hex")],
  ])("generates a private %s export", async (format, magic) => {
    let file = Buffer.alloc(0);
    const repo = {
      claimReport: jest.fn().mockResolvedValue({
        id: randomUUID(),
        type: "USAGE",
        format,
        filters: {},
      }),
      reportRows: jest
        .fn()
        .mockResolvedValue([{ id: randomUUID(), value: "=formula" }]),
      finishReport: jest.fn().mockResolvedValue(undefined),
      failReport: jest.fn().mockResolvedValue(undefined),
    };
    const storage = {
      putFile: jest.fn().mockImplementation(async (_key, path) => {
        file = await readFile(path);
      }),
    };
    const service = new ReportExportService(
      repo as any,
      storage as any,
      {} as any,
      {} as any,
    );
    await service.process("org", randomUUID());
    expect(file.subarray(0, 4).toString("hex")).toContain(magic);
    expect(repo.finishReport).toHaveBeenCalled();
  });
});
