import { Module } from "@nestjs/common";
import { APP_FILTER, APP_INTERCEPTOR } from "@nestjs/core";
import { ErrorHandlingService } from "./error.service";
import { ErrorHandlingInterceptor } from "./error.interceptor";
import { AllExceptionsFilter } from "./error.filter";

@Module({
  providers: [
    ErrorHandlingService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorHandlingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
  exports: [ErrorHandlingService],
})
export class ErrorHandlingModule {}
