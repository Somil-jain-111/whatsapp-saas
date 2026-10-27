import { AppController } from "./app.controller";

describe("AppController health probes", () => {
  const dataSource = { isInitialized: true, query: jest.fn() };
  const redis = { set: jest.fn(), get: jest.fn() };
  const cache = { testCache: jest.fn() };
  const config = { get: jest.fn(), getPort: jest.fn() };
  const http = { get: jest.fn() };
  const controller = new AppController(
    dataSource as never,
    redis as never,
    cache as never,
    config as never,
    http as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    dataSource.isInitialized = true;
    dataSource.query.mockResolvedValue([{ ok: 1 }]);
    redis.set.mockResolvedValue(undefined);
    redis.get.mockResolvedValue("redis_ok");
    cache.testCache.mockResolvedValue(1);
  });

  it("keeps liveness independent from external dependencies", () => {
    dataSource.isInitialized = false;
    expect(controller.liveness()).toEqual({ status: "ok" });
    expect(dataSource.query).not.toHaveBeenCalled();
  });

  it("reports readiness failure when the database is unavailable", async () => {
    dataSource.isInitialized = false;
    const response = await controller.checkHealthService(false);
    expect(response.statusCode).toBe(503);
    expect(response.failedServices).toContain("database");
  });
});
