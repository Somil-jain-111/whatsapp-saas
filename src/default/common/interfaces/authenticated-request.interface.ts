import { Request } from "express";

export interface AuthenticatedUser {
  id: number;
  mobile?: string | null;
  email?: string | null;
  role: string[];
  status?: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  rawBody?: Buffer;
}
