import { Module } from "@nestjs/common";
import { HttpModule } from "@nestjs/axios";
import { AxiosLoggingInterceptor } from "src/axios/axios.interceptor";

@Module({
  imports: [HttpModule],
  providers: [AxiosLoggingInterceptor], // ✅ Provide the interceptor
  exports: [AxiosLoggingInterceptor], // ✅ Export so other modules can use it
})
export class SharedModule {}
