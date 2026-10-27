import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PHASE_ONE_ENTITIES } from "./database.constants";
import { TenantContextService } from "./tenant-context.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([...PHASE_ONE_ENTITIES])],
  providers: [TenantContextService],
  exports: [TypeOrmModule, TenantContextService],
})
export class DatabaseModule {}
