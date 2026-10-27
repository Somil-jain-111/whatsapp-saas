import { firstValueFrom, of } from "rxjs";
import { CustomCacheInterceptor } from "./cache.interceptor";

describe("CustomCacheInterceptor", () => {
  it("prevents browser and proxy caching for every HTTP response", async () => {
    const setHeader = jest.fn();
    const context = {
      switchToHttp: () => ({
        getResponse: () => ({ headersSent: false, setHeader }),
      }),
    };
    const interceptor = new CustomCacheInterceptor();

    await expect(
      firstValueFrom(
        interceptor.intercept(context as never, {
          handle: () => of({ ok: true }),
        }),
      ),
    ).resolves.toEqual({ ok: true });
    expect(setHeader).toHaveBeenCalledWith(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    expect(setHeader).toHaveBeenCalledWith("Surrogate-Control", "no-store");
  });
});
