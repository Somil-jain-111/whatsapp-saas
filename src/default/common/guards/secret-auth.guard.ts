import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class ApiKeySecretGuard extends AuthGuard("api-key-secret") {}
