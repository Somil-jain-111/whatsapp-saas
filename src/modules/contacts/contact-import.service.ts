import { InjectQueue } from "@nestjs/bullmq";
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from "@nestjs/common";
import { Queue } from "bullmq";
import ExcelJS from "exceljs";
import { randomUUID } from "crypto";
import { Readable } from "stream";
import { PrivateObjectStorageService } from "../storage/private-object-storage.service";
import { ContactsRepository } from "./contacts.repository";

export const CONTACT_IMPORT_QUEUE = "contact-import";
const REQUIRED_HEADERS = ["full_name", "country_code", "phone_e164"];

@Injectable()
export class ContactImportService implements OnModuleInit {
  constructor(
    private readonly repo: ContactsRepository,
    private readonly storage: PrivateObjectStorageService,
    @InjectQueue(CONTACT_IMPORT_QUEUE) private readonly queue: Queue,
  ) {}

  async onModuleInit() {
    for (const item of await this.repo.pendingImports())
      await this.enqueue(item.organization_id, item.id);
  }

  async create(
    organizationId: string,
    userId: string,
    file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException("CSV or XLSX file is required");
    const extension = file.originalname.toLowerCase().endsWith(".csv")
      ? "CSV"
      : file.originalname.toLowerCase().endsWith(".xlsx")
        ? "XLSX"
        : null;
    if (!extension)
      throw new BadRequestException("Only CSV and XLSX files are supported");
    const objectKey = `contact-imports/${organizationId}/${randomUUID()}.${extension.toLowerCase()}`;
    await this.storage.putBuffer(objectKey, file.buffer, file.mimetype);
    const created = await this.repo.createImport(
      organizationId,
      userId,
      objectKey,
      extension,
    );
    await this.enqueue(organizationId, created.id);
    return created;
  }

  imports(org: string) {
    return this.repo.imports(org);
  }
  async get(org: string, id: string) {
    const value = await this.repo.import(org, id);
    if (!value) throw new NotFoundException("Contact import not found");
    return value;
  }
  sample() {
    return Buffer.from(
      "full_name,country_code,phone_e164,email\nJane Doe,US,+14155552671,jane@example.com\n",
    );
  }
  async errorFile(org: string, id: string) {
    const value = await this.get(org, id);
    if (!value.error_object_key)
      throw new NotFoundException("Import error report is not available");
    return this.storage.stream(value.error_object_key);
  }

  async process(org: string, id: string) {
    const item = await this.repo.claimImport(org, id);
    if (!item) return;
    try {
      const buffer = await this.storage.readBuffer(item.object_key);
      const workbook = new ExcelJS.Workbook();
      if (item.file_type === "CSV")
        await workbook.csv.read(Readable.from(buffer), {
          map: (value) => value,
        });
      else await workbook.xlsx.load(buffer as any);
      const sheet = workbook.worksheets[0];
      if (!sheet) throw new BadRequestException("Spreadsheet is empty");
      const headers = (sheet.getRow(1).values as unknown[])
        .slice(1)
        .map((value) =>
          String(value ?? "")
            .trim()
            .toLowerCase(),
        );
      if (REQUIRED_HEADERS.some((header) => !headers.includes(header)))
        throw new BadRequestException(
          `Required columns: ${REQUIRED_HEADERS.join(", ")}`,
        );
      const capacity = await this.repo.contactCapacity(org);
      let accepted = 0;
      const phones = new Set<string>();
      const errors: Array<{
        row: number;
        code: string;
        message: string;
        safe: Record<string, unknown>;
      }> = [];
      const batch: Array<{
        row: number;
        fullName: string;
        countryCode: string;
        phoneE164: string;
        email: string | null;
      }> = [];
      const flush = async () => {
        if (!batch.length) return;
        const pending = batch.splice(0);
        const result = await this.repo.insertImportedContacts(
          org,
          item.created_by_user_id,
          pending,
        );
        accepted += result.inserted.size;
        for (const contact of pending)
          if (!result.inserted.has(contact.phoneE164))
            errors.push({
              row: contact.row,
              code: result.duplicates.has(contact.phoneE164)
                ? "DUPLICATE_PHONE"
                : "CONTACT_QUOTA_EXCEEDED",
              message: result.duplicates.has(contact.phoneE164)
                ? "Phone number already exists"
                : "Contact quota exceeded",
              safe: { country_code: contact.countryCode },
            });
      };
      for (let rowNumber = 2; rowNumber <= sheet.rowCount; rowNumber++) {
        const row = sheet.getRow(rowNumber);
        if (!row.hasValues) continue;
        const value = Object.fromEntries(
          headers.map((header, index) => [
            header,
            String(row.getCell(index + 1).text ?? "").trim(),
          ]),
        );
        const message = this.validate(value);
        const duplicateInFile = phones.has(value.phone_e164);
        if (
          message ||
          duplicateInFile ||
          (capacity !== null && accepted + batch.length >= capacity)
        ) {
          errors.push({
            row: rowNumber,
            code: message
              ? "INVALID_ROW"
              : duplicateInFile
                ? "DUPLICATE_PHONE"
                : "CONTACT_QUOTA_EXCEEDED",
            message:
              message ??
              (duplicateInFile
                ? "Duplicate phone number in file"
                : "Contact quota exceeded"),
            safe: {
              full_name: value.full_name?.slice(0, 150),
              country_code: value.country_code?.slice(0, 2),
            },
          });
          continue;
        }
        phones.add(value.phone_e164);
        batch.push({
          row: rowNumber,
          fullName: value.full_name,
          countryCode: value.country_code.toUpperCase(),
          phoneE164: value.phone_e164,
          email: value.email?.toLowerCase() || null,
        });
        if (batch.length === 500) await flush();
      }
      await flush();
      await this.repo.addImportErrors(org, id, errors);
      let errorKey: string | null = null;
      if (errors.length) {
        errorKey = `contact-imports/${org}/${id}-errors.csv`;
        const csv = [
          "row,code,message",
          ...errors.map((error) =>
            [error.row, error.code, error.message]
              .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
              .join(","),
          ),
        ].join("\n");
        await this.storage.putBuffer(errorKey, Buffer.from(csv), "text/csv");
      }
      await this.repo.finishImport(org, id, {
        total: Math.max(sheet.rowCount - 1, 0),
        accepted,
        rejected: errors.length,
        errorKey,
      });
    } catch (error) {
      await this.repo.failImport(org, id);
      throw error;
    }
  }

  private enqueue(org: string, id: string) {
    return this.queue.add(
      "process",
      { organizationId: org, importId: id },
      {
        jobId: `contact-import-${id}`,
        attempts: 3,
        backoff: { type: "exponential", delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
  }
  private validate(value: Record<string, string>) {
    if (!value.full_name || value.full_name.length > 150)
      return "Invalid full_name";
    if (!/^[A-Z]{2}$/.test(value.country_code?.toUpperCase()))
      return "Invalid country_code";
    if (!/^\+[1-9][0-9]{1,14}$/.test(value.phone_e164))
      return "Invalid phone_e164";
    if (
      value.email &&
      (value.email.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email))
    )
      return "Invalid email";
    return null;
  }
}
