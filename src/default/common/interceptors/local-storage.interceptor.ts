import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { v4 as uuidv4 } from "uuid";
import { LocalStorageContextUtil } from "../utils/local-storage.util";
import { ContextType } from "../constants/context.option";

@Injectable()
export class LocalStorageInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest();

    // Generate and set `journeyId`
    const journeyId = uuidv4();
    req.journeyId = journeyId;

    // Get `currentUser` from the request
    const currentUser = req.user?.userId || null;

    // Initialize AsyncLocalStorage with the values
    const initialData = new Map<string, string>();
    initialData.set(ContextType.JOURNEY_ID, journeyId);
    initialData.set(ContextType.CURRENT_USER, currentUser);

    // Wrap the execution of next.handle() within LocalStorageContextUtil.run()
    return new Observable((observer) => {
      LocalStorageContextUtil.run(() => {
        next.handle().subscribe({
          next: (value) => observer.next(value),
          error: (err) => observer.error(err),
          complete: () => observer.complete(),
        });
      }, initialData);
    });
  }
}
