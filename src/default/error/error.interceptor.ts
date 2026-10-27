import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { catchError } from "rxjs/operators";

@Injectable()
export class ErrorHandlingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      catchError((error) => {
        // If error is already handled, rethrow it for the filter
        if (context.switchToHttp().getResponse().headersSent) {
          throw error;
        }
        throw error; // Allow filter to handle it
      }),
    );
  }
}
