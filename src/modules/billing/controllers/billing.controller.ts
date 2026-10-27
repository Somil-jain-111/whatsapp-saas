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
} from "@nestjs/common";
import { Request, Response } from "express";
import { PhaseOneAuthGuard } from "../../whatsapp-integration/guards/phase-one-auth.guard";
import {
  RequireWhatsappPermission,
  TenantPermissionGuard,
} from "../../whatsapp-integration/guards/tenant-permission.guard";
import { TenantRequest } from "../../whatsapp-integration/interfaces/request-context.interface";
import {
  CancelSubscriptionDto,
  ChangeSubscriptionDto,
  CheckoutDto,
  ReportExportDto,
  StartTrialDto,
} from "../dto/billing.dto";
import { BillingService } from "../services/billing.service";

@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}
  @Get("plans") plans(
    @Query("currency") currency?: string,
    @Query("country") country?: string,
  ) {
    return this.billing.plans(currency, country);
  }
  @Get("prices") prices(
    @Query("currency") currency?: string,
    @Query("country") country?: string,
  ) {
    return this.billing.prices(currency, country);
  }
  @Post("checkout")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  checkout(@Req() r: TenantRequest, @Body() b: CheckoutDto) {
    return this.billing.checkout(
      r.organizationId,
      r.user.id,
      r.user.sessionId,
      b.priceId,
    );
  }
  @Post("trial")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  trial(@Req() r: TenantRequest, @Body() b: StartTrialDto) {
    return this.billing.startTrial(r.organizationId, b.planId);
  }
  @Get("subscription")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.read")
  subscription(@Req() r: TenantRequest) {
    return this.billing.subscription(r.organizationId);
  }
  @Post("subscription/change")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  change(@Req() r: TenantRequest, @Body() b: ChangeSubscriptionDto) {
    return this.billing.change(r.organizationId, b.priceId);
  }
  @Post("subscription/cancel")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  cancel(@Req() r: TenantRequest, @Body() b: CancelSubscriptionDto) {
    return this.billing.cancel(r.organizationId, b.immediate);
  }
  @Post("subscription/reactivate")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  reactivate(@Req() r: TenantRequest) {
    return this.billing.reactivate(r.organizationId);
  }
  @Post("portal-session")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.manage")
  portal(@Req() r: TenantRequest) {
    return this.billing.portal(r.organizationId);
  }
  @Get("invoices")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.read")
  invoices(@Req() r: TenantRequest) {
    return this.billing.invoices(r.organizationId);
  }
  @Get("invoices/:id")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.read")
  invoice(@Req() r: TenantRequest, @Param("id", ParseUUIDPipe) id: string) {
    return this.billing.invoice(r.organizationId, id);
  }
  @Get("payments")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.read")
  payments(@Req() r: TenantRequest) {
    return this.billing.payments(r.organizationId);
  }
  @Get("notifications")
  @UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
  @RequireWhatsappPermission("billing.read")
  notifications(@Req() r: TenantRequest) {
    return this.billing.notifications(r.organizationId);
  }
}

@Controller("usage")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
@RequireWhatsappPermission("usage.read")
export class UsageController {
  constructor(private readonly billing: BillingService) {}
  @Get("overview") overview(@Req() r: TenantRequest) {
    return this.billing.usage(r.organizationId);
  }
  @Get("quotas") quotas(@Req() r: TenantRequest) {
    return this.billing.quotas(r.organizationId);
  }
  @Get("history") history(@Req() r: TenantRequest) {
    return this.billing.history(r.organizationId);
  }
}

@Controller("reports")
@UseGuards(PhaseOneAuthGuard, TenantPermissionGuard)
@RequireWhatsappPermission("reports.manage")
export class ReportsController {
  constructor(private readonly billing: BillingService) {}
  @Post("exports")
  @HttpCode(HttpStatus.ACCEPTED)
  create(@Req() r: TenantRequest, @Body() b: ReportExportDto) {
    return this.billing.createReport(r.organizationId, r.user.id, b);
  }
  @Get("exports") list(@Req() r: TenantRequest) {
    return this.billing.reports(r.organizationId);
  }
  @Get("exports/:id") get(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
  ) {
    return this.billing.getReport(r.organizationId, id);
  }
  @Get("exports/:id/download")
  async download(
    @Req() r: TenantRequest,
    @Param("id", ParseUUIDPipe) id: string,
    @Res() response: Response,
  ) {
    const report = await this.billing.downloadReport(r.organizationId, id);
    const types: Record<string, string> = {
      CSV: "text/csv",
      XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      PDF: "application/pdf",
    };
    response.setHeader("Content-Type", types[report.format]);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="report-${id}.${report.format.toLowerCase()}"`,
    );
    report.stream.pipe(response);
  }
}

@Controller("webhooks/payments/stripe")
export class StripeWebhookController {
  constructor(private readonly billing: BillingService) {}
  @Post() @HttpCode(200) webhook(
    @Req() r: Request & { rawBody?: Buffer },
    @Headers("stripe-signature") s?: string,
  ) {
    return this.billing.stripeWebhook(r.rawBody, s);
  }
}

@Controller("webhooks/payments/razorpay")
export class RazorpayWebhookController {
  constructor(private readonly billing: BillingService) {}
  @Post()
  @HttpCode(200)
  webhook(
    @Req() r: Request & { rawBody?: Buffer },
    @Headers("x-razorpay-signature") signature?: string,
    @Headers("x-razorpay-event-id") eventId?: string,
  ) {
    return this.billing.razorpayWebhook(r.rawBody, signature, eventId);
  }
}
