import { Module, Global } from "@nestjs/common";
import { CacheModule } from "@nestjs/cache-manager";
import { APP_INTERCEPTOR } from "@nestjs/core";
import { AppConfigService } from "../config/config.service";
import { cacheConfig } from "./cache.config";
import { ConfigModule } from "../config/config.module";
import { CacheService } from "./cache.service";
import { CustomCacheInterceptor } from "./cache.interceptor";

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      imports: [ConfigModule],
      inject: [AppConfigService],
      useFactory: cacheConfig,
    }),
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: CustomCacheInterceptor,
    },
    CacheService,
  ],
  exports: [CacheModule, CacheService],
  controllers: [],
})
export class AppCacheModule {}
