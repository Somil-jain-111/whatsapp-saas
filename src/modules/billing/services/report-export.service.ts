import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, NotFoundException, OnModuleInit } from "@nestjs/common";
import { Queue } from "bullmq";
import ExcelJS from "exceljs";
import { createWriteStream, promises as fs } from "fs";
import { once } from "events";
import { join } from "path";
import { tmpdir } from "os";
import PDFDocument from "pdfkit";
import { PrivateObjectStorageService } from "../../storage/private-object-storage.service";
import { ReportExportDto } from "../dto/billing.dto";
import { BillingRepository } from "../repositories/billing.repository";
import { EntitlementService } from "./entitlement.service";

export const REPORT_EXPORT_QUEUE = "report-export";

@Injectable()
export class ReportExportService implements OnModuleInit {
  constructor(
    private readonly repo: BillingRepository,
    private readonly storage: PrivateObjectStorageService,
    @InjectQueue(REPORT_EXPORT_QUEUE) private readonly queue: Queue,
    private readonly entitlements: EntitlementService,
  ) {}

  async onModuleInit() {
    for (const report of await this.repo.pendingReports())
      await this.enqueue(report.organization_id, report.id);
    await this.queue.add(
      "expire-trials",
      {},
      {
        jobId: "expire-trials",
        repeat: { every: 3600000 },
        removeOnComplete: 10,
      },
    );
  }

  async create(org: string, user: string, dto: ReportExportDto) {
    const reservation = await this.entitlements.reserveQuota(
      org,
      "report_exports",
      1,
      `report:${user}:${dto.type}:${Date.now()}`,
    );
    const { type, format, ...filters } = dto;
    try {
      const report = await this.repo.createReport(
        org,
        user,
        type,
        format,
        filters,
      );
      await this.entitlements.commitQuota(org, reservation.id);
      await this.enqueue(org, report.id);
      return report;
    } catch (error) {
      await this.entitlements.releaseQuota(org, reservation.id);
      throw error;
    }
  }
  list(org: string) {
    return this.repo.reports(org);
  }
  async get(org: string, id: string) {
    const value = await this.repo.report(org, id);
    if (!value) throw new NotFoundException("Report not found");
    return value;
  }
  async download(org: string, id: string) {
    const report = await this.get(org, id);
    if (
      report.status !== "COMPLETED" ||
      !report.object_key ||
      !report.expires_at ||
      new Date(report.expires_at) <= new Date()
    )
      throw new NotFoundException("Report file is unavailable or expired");
    return {
      format: report.format,
      stream: await this.storage.stream(report.object_key),
    };
  }

  async process(org: string, id: string) {
    const report = await this.repo.claimReport(org, id);
    if (!report) return;
    const extension = report.format.toLowerCase();
    const path = join(tmpdir(), `report-${id}.${extension}`);
    try {
      if (report.format === "CSV") await this.csv(path, org, report);
      else if (report.format === "XLSX") await this.xlsx(path, org, report);
      else await this.pdf(path, org, report);
      const key = `report-exports/${org}/${id}.${extension}`;
      await this.storage.putFile(key, path, this.contentType(report.format));
      await this.repo.finishReport(org, id, key);
    } catch (error) {
      await this.repo.failReport(org, id);
      throw error;
    } finally {
      await fs.rm(path, { force: true });
    }
  }
  expireTrials() {
    return this.repo.expireTrials();
  }

  private async csv(path: string, org: string, report: any) {
    const output = createWriteStream(path, { mode: 0o600 });
    let headers: string[] = [];
    await this.eachBatch(org, report, async (rows) => {
      if (!headers.length) {
        headers = Object.keys(rows[0]);
        if (!output.write(`${headers.join(",")}\n`))
          await once(output, "drain");
      }
      for (const row of rows) {
        const line = headers
          .map((header) => this.csvCell(row[header]))
          .join(",");
        if (!output.write(`${line}\n`)) await once(output, "drain");
      }
    });
    output.end();
    await once(output, "finish");
  }

  private async xlsx(path: string, org: string, report: any) {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: path });
    const sheet = workbook.addWorksheet("Report");
    let headers: string[] = [];
    await this.eachBatch(org, report, async (rows) => {
      if (!headers.length) {
        headers = Object.keys(rows[0]);
        sheet.columns = headers.map((header) => ({
          header,
          key: header,
          width: 20,
        }));
      }
      for (const row of rows)
        sheet
          .addRow(
            Object.fromEntries(
              headers.map((header) => [
                header,
                this.safeSpreadsheetValue(row[header]),
              ]),
            ),
          )
          .commit();
    });
    sheet.commit();
    await workbook.commit();
  }

  private async pdf(path: string, org: string, report: any) {
    const output = createWriteStream(path, { mode: 0o600 });
    const document = new PDFDocument({ size: "A4", margin: 36 });
    document.pipe(output);
    document.fontSize(16).text(`${report.type} report`);
    document.moveDown();
    await this.eachBatch(org, report, async (rows) => {
      for (const row of rows) {
        if (document.y > 760) document.addPage();
        document.fontSize(8).text(JSON.stringify(row), { width: 520 });
      }
    });
    document.end();
    await once(output, "finish");
  }

  private async eachBatch(
    org: string,
    report: any,
    consume: (rows: any[]) => Promise<void>,
  ) {
    let cursor: string | null = null;
    for (;;) {
      const rows = await this.repo.reportRows(
        org,
        report.type,
        report.filters ?? {},
        cursor,
        1000,
      );
      if (!rows.length) return;
      await consume(rows);
      cursor = rows[rows.length - 1].id;
      if (rows.length < 1000) return;
    }
  }
  private csvCell(value: unknown) {
    const safe = this.safeSpreadsheetValue(value);
    return `"${String(safe ?? "").replace(/"/g, '""')}"`;
  }
  private safeSpreadsheetValue(value: unknown) {
    const text =
      value instanceof Date ? value.toISOString() : String(value ?? "");
    return /^[=+\-@]/.test(text) ? `'${text}` : text;
  }
  private enqueue(org: string, id: string) {
    return this.queue.add(
      "generate",
      { organizationId: org, reportId: id },
      {
        jobId: `report-${id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
  private contentType(format: string) {
    if (format === "CSV") return "text/csv";
    if (format === "XLSX")
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    return "application/pdf";
  }
}
