import { ConflictException } from "@nestjs/common";
import { ConversationsRepository } from "./conversations.repository";

describe("ConversationsRepository assignment", () => {
  it("rejects a stale optimistic version before writing assignment history", async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([]) };
    const tenants = { run: jest.fn((_org, work) => work(manager)) };
    const repository = new ConversationsRepository(tenants as never);
    await expect(
      repository.assign("org", "conversation", "actor", null, 2),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(manager.query).toHaveBeenCalledTimes(1);
  });
});
