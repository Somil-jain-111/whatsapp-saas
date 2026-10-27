import {
  Injectable,
  NotFoundException,
  ParseUUIDPipe,
  ParseUUIDPipeOptions,
} from "@nestjs/common";

@Injectable()
export class InvalidPathUuidPipe extends ParseUUIDPipe {
  constructor(options?: ParseUUIDPipeOptions) {
    super({
      ...options,
      exceptionFactory: () => new NotFoundException("Invalid path"),
    });
  }
}
