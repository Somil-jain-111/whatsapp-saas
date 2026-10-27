import { firstValueFrom, of } from "rxjs";
import { UnifiedResponseInterceptor } from "./unified-response.interceptor";

describe("UnifiedResponseInterceptor", () => {
  it("does not wrap server-sent event frames", async () => {
    const handler = function handler() {};
    const context = { getHandler: () => handler };
    const reflector = { get: jest.fn((key: string) => key === "__sse__") };
    const interceptor = new UnifiedResponseInterceptor(reflector as never);
    const event = {
      id: "4",
      type: "message.received",
      data: { messageId: "m1" },
    };
    await expect(
      firstValueFrom(
        interceptor.intercept(context as never, { handle: () => of(event) }),
      ),
    ).resolves.toEqual(event);
  });

  it("preserves the HTTP status selected by the controller", async () => {
    const response = { statusCode: 201, status: jest.fn() };
    const request = {
      method: "POST",
      url: "/auth/register",
      originalUrl: "/auth/register",
    };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    const reflector = {
      get: jest.fn(),
      getAllAndOverride: jest.fn(() => false),
    };
    const interceptor = new UnifiedResponseInterceptor(reflector as never);

    const result = await firstValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of({ id: "1" }),
      }),
    );

    expect(result.code).toBe(201);
    expect(response.status).not.toHaveBeenCalled();
  });

  it("preserves JSON scalar types after sanitizing the response", async () => {
    const response = { statusCode: 200, status: jest.fn() };
    const request = {
      method: "GET",
      url: "/meta/app-configuration",
      originalUrl: "/meta/app-configuration",
    };
    const context = {
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    const reflector = {
      get: jest.fn(),
      getAllAndOverride: jest.fn(() => false),
    };
    const interceptor = new UnifiedResponseInterceptor(reflector as never);

    const result = await firstValueFrom(
      interceptor.intercept(context as never, {
        handle: () => of({ configured: false, count: 0, optional: null }),
      }),
    );

    expect(result.status).toBe(true);
    expect(result.code).toBe(200);
    expect(result.data).toEqual({ configured: false, count: 0, optional: null });
  });
});
