import { ConflictException, NotFoundException } from "@nestjs/common";
import { QueryFailedError } from "typeorm";
import { ContactsRepository } from "./contacts.repository";
import { ContactsService } from "./contacts.service";

describe("ContactsService", () => {
  const repo = {
    create: jest.fn(),
    get: jest.fn(),
    remove: jest.fn(),
  } as unknown as jest.Mocked<ContactsRepository>;
  const service = new ContactsService(repo, { emit: jest.fn() } as never);

  beforeEach(() => jest.clearAllMocks());

  it("maps tenant phone uniqueness failures to a conflict", async () => {
    const error = new QueryFailedError("INSERT", [], {
      code: "23505",
    } as never);
    repo.create.mockRejectedValue(error);
    await expect(
      service.create("org", "user", {
        fullName: "A",
        countryCode: "IN",
        phoneE164: "+919876543210",
        customAttributes: {},
        source: "MANUAL",
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("does not expose a missing contact", async () => {
    repo.get.mockResolvedValue(null);
    await expect(
      service.get("org", crypto.randomUUID()),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
