import { Request } from "express";

export interface PhaseOnePrincipal {
  id: string;
  sessionId: string;
}

export interface TenantRequest extends Request {
  user: PhaseOnePrincipal;
  organizationId: string;
  rawBody?: Buffer;
}
