import { SetMetadata } from "@nestjs/common";

export const AUTH_RESPONSE_KEY = "authResponse";

/** Marks responses that may contain newly-issued credentials. */
export const AuthResponse = (): ClassDecorator & MethodDecorator =>
  SetMetadata(AUTH_RESPONSE_KEY, true);
