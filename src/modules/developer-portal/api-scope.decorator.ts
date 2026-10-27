import { SetMetadata } from "@nestjs/common";
import { ApiScope } from "./dto/developer-portal.dto";

export const PUBLIC_API_SCOPE = "developer.public-api-scope";
export const RequireApiScope = (scope: ApiScope) =>
  SetMetadata(PUBLIC_API_SCOPE, scope);
