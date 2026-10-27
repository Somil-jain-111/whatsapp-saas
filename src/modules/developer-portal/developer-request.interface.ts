import { Request } from "express";
import { ApiScope } from "./dto/developer-portal.dto";

export interface ApiKeyPrincipal {
  id: string;
  organizationId: string;
  environment: "LIVE" | "TEST";
  scopes: ApiScope[];
  publicId: string;
}

export interface PublicApiRequest extends Request {
  apiKey: ApiKeyPrincipal;
  organizationId: string;
  requestId: string;
}
