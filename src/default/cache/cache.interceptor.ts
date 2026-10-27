import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";

export function applyNoCacheHeaders(response: {
  headersSent?: boolean;
  setHeader(name: string, value: string): void;
}) {
  if (response.headersSent) return;
  response.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.setHeader("Pragma", "no-cache");
  response.setHeader("Expires", "0");
  response.setHeader("Surrogate-Control", "no-store");
}

/** All API responses are private and dynamic unless a future endpoint explicitly opts in to caching. */
@Injectable()
export class CustomCacheInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    applyNoCacheHeaders(context.switchToHttp().getResponse());
    return next.handle();
  }
}
