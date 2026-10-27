import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { CloudwatchService } from "./cloudwatch.service";
import { AppConfigService } from "../../../default/config/config.service";

@Global() // To make this module globally available
@Module({
  imports: [EventEmitterModule.forRoot()],
  providers: [CloudwatchService, AppConfigService],
  exports: [CloudwatchService],
})
export class CloudwatchModule {}
