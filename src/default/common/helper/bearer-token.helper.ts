// src/modules/auth/helpers/bearer-token.helper.ts

export class BearerTokenHelper {
  static extractTokenFromHeader(req: any): string | null {
    const authHeader = req?.headers?.authorization;

    if (!authHeader) {
      return null;
    }

    const [type, token] = authHeader.split(" ");

    if (type !== "Bearer" || !token) {
      return null;
    }

    return token;
  }
}
