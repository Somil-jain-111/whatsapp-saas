import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
} from "@nestjs/common";
import { Response } from "express";
import { RequireApiScope } from "./api-scope.decorator";
import { PublicApiRequest } from "./developer-request.interface";
import {
  PublicBulkMessageDto,
  PublicListDto,
  PublicTemplateMessageDto,
} from "./dto/developer-portal.dto";
import { PublicApiGuard } from "./public-api.guard";
import { PublicApiLogInterceptor } from "./public-api-log.interceptor";
import { PublicApiService } from "./public-api.service";

@Controller("public/v1")
@UseGuards(PublicApiGuard)
@UseInterceptors(PublicApiLogInterceptor)
export class PublicApiController {
  constructor(private readonly api: PublicApiService) {}

  @Post("messages/template")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireApiScope("messages:send")
  async sendTemplate(
    @Req() request: PublicApiRequest,
    @Res({ passthrough: true }) response: Response,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() body: PublicTemplateMessageDto,
  ) {
    const result = await this.api.sendTemplate(
      request.apiKey,
      body,
      idempotencyKey,
    );
    response.locals.messageOperationId = result.message_id;
    return { ...result, request_id: request.requestId };
  }

  @Post("messages/bulk")
  @HttpCode(HttpStatus.ACCEPTED)
  @RequireApiScope("messages:send")
  sendBulk(
    @Req() request: PublicApiRequest,
    @Headers("idempotency-key") idempotencyKey: string,
    @Body() body: PublicBulkMessageDto,
  ) {
    return this.api.sendBulk(request.apiKey, body, idempotencyKey);
  }

  @Get("messages/:id")
  @RequireApiScope("messages:read")
  message(
    @Req() request: PublicApiRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.api.getMessage(request.apiKey, id);
  }

  @Get("templates")
  @RequireApiScope("templates:read")
  templates(@Req() request: PublicApiRequest, @Query() query: PublicListDto) {
    return this.api.templatesList(request.apiKey, query.limit);
  }

  @Get("templates/:id")
  @RequireApiScope("templates:read")
  template(
    @Req() request: PublicApiRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.api.template(request.apiKey, id);
  }

  @Get("campaigns")
  @RequireApiScope("campaigns:read")
  campaigns(@Req() request: PublicApiRequest, @Query() query: PublicListDto) {
    return this.api.campaignsList(request.apiKey, query);
  }

  @Get("campaigns/:id")
  @RequireApiScope("campaigns:read")
  campaign(
    @Req() request: PublicApiRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.api.campaign(request.apiKey, id);
  }

  @Get("reports/messages")
  @RequireApiScope("reports:read")
  report(@Req() request: PublicApiRequest) {
    return this.api.reports(request.apiKey);
  }

  @Get("usage")
  @RequireApiScope("reports:read")
  usage(@Req() request: PublicApiRequest) {
    return this.api.usage(request.apiKey);
  }
}
