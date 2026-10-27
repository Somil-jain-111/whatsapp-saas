import { ContactImportService } from "./contact-import.service";

describe("ContactImportService", () => {
  const service = new ContactImportService({} as any, {} as any, {} as any);

  it("validates required global contact fields", () => {
    expect(
      (service as any).validate({
        full_name: "Jane Doe",
        country_code: "US",
        phone_e164: "+14155552671",
        email: "jane@example.com",
      }),
    ).toBeNull();
    expect(
      (service as any).validate({
        full_name: "Jane Doe",
        country_code: "US",
        phone_e164: "4155552671",
        email: "jane@example.com",
      }),
    ).toBe("Invalid phone_e164");
  });

  it("parses a bounded CSV import and completes it", async () => {
    const repo = {
      claimImport: jest.fn().mockResolvedValue({
        object_key: "contacts.csv",
        file_type: "CSV",
        created_by_user_id: "user",
      }),
      contactCapacity: jest.fn().mockResolvedValue(null),
      insertImportedContacts: jest.fn().mockResolvedValue({
        inserted: new Set(["+14155552671"]),
        duplicates: new Set(),
      }),
      addImportErrors: jest.fn().mockResolvedValue(undefined),
      finishImport: jest.fn().mockResolvedValue(undefined),
      failImport: jest.fn().mockResolvedValue(undefined),
    };
    const storage = {
      readBuffer: jest
        .fn()
        .mockResolvedValue(
          Buffer.from(
            "full_name,country_code,phone_e164,email\nJane Doe,US,+14155552671,jane@example.com\n",
          ),
        ),
      putBuffer: jest.fn(),
    };
    const imports = new ContactImportService(
      repo as any,
      storage as any,
      {} as any,
    );
    await imports.process("org", "import");
    expect(repo.insertImportedContacts).toHaveBeenCalledTimes(1);
    expect(repo.finishImport).toHaveBeenCalledWith(
      "org",
      "import",
      expect.objectContaining({ accepted: 1, rejected: 0 }),
    );
  });
});
