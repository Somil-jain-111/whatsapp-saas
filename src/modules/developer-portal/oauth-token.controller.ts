import { Body, Controller, Post, Req } from "@nestjs/common";
import { Request } from "express";
import { OAuthTokenDto } from "./dto/developer-portal.dto";
import { OAuthTokenService } from "./oauth-token.service";

@Controller("public/oauth")
export class OAuthTokenController {
  constructor(private readonly tokens: OAuthTokenService) {}

  @Post("token")
  token(@Req() request: Request, @Body() body: OAuthTokenDto) {
    return this.tokens.issue(request, body);
  }
}
