import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { createHmac, timingSafeEqual } from "crypto";
import { AppConfigService } from "../../../default/config/config.service";
import { PaymentProvider } from "../providers/payment-provider";
import { RazorpayProvider } from "../providers/razorpay.provider";
import { StripeProvider } from "../providers/stripe.provider";
import { BillingRepository } from "../repositories/billing.repository";
import { ReportExportDto } from "../dto/billing.dto";
import { ReportExportService } from "./report-export.service";

@Injectable()
export class BillingService {
  constructor(
    private readonly repo: BillingRepository,
    private readonly stripe: StripeProvider,
    private readonly razorpay: RazorpayProvider,
    private readonly config: AppConfigService,
    private readonly reportsService: ReportExportService,
  ) {}
  plans(currency?: string, country?: string) {
    return this.repo.plans(currency?.toUpperCase(), country?.toUpperCase());
  }
  prices(currency?: string, country?: string) {
    return this.repo.prices(currency?.toUpperCase(), country?.toUpperCase());
  }
  async checkout(org: string, user: string, session: string, priceId: string) {
    const price = await this.requirePrice(priceId);
    const checkout = await this.provider(price.provider).checkout(
      org,
      price.provider_price_id,
      price.id,
    );
    await this.repo.recordCheckoutStarted(org, user, session);
    return checkout;
  }
  async startTrial(org: string, planId: string) {
    const value = await this.repo.startTrial(org, planId);
    if (!value)
      throw new ConflictException(
        "Trial is unavailable for this organization or plan",
      );
    return value;
  }
  subscription(org: string) {
    return this.repo.subscription(org);
  }
  async change(org: string, priceId: string) {
    const current = await this.requireProviderSubscription(org);
    const price = await this.requirePrice(priceId);
    if (current.price_id === price.id)
      throw new ConflictException("Subscription already uses this price");
    await this.provider(current.provider).changeSubscription(
      current.provider_subscription_id,
      price.provider_price_id,
    );
    return { accepted: true, status: "PENDING_PROVIDER_WEBHOOK" };
  }
  async cancel(org: string, immediate = false) {
    const current = await this.requireProviderSubscription(org);
    if (immediate)
      await this.provider(current.provider).cancelNow(
        current.provider_subscription_id,
      );
    else
      await this.provider(current.provider).updateCancellation(
        current.provider_subscription_id,
        true,
      );
    return { accepted: true, status: "PENDING_PROVIDER_WEBHOOK" };
  }
  async reactivate(org: string) {
    const current = await this.requireProviderSubscription(org);
    if (!current.cancel_at_period_end)
      throw new ConflictException("Subscription is not pending cancellation");
    await this.provider(current.provider).updateCancellation(
      current.provider_subscription_id,
      false,
    );
    return { accepted: true, status: "PENDING_PROVIDER_WEBHOOK" };
  }
  async portal(org: string) {
    const current = await this.requireProviderSubscription(org);
    if (!current.provider_customer_id)
      throw new ConflictException("Billing customer is unavailable");
    return this.provider(current.provider).portal(current.provider_customer_id);
  }
  invoices(org: string) {
    return this.repo.invoices(org);
  }
  async invoice(org: string, id: string) {
    const value = await this.repo.invoice(org, id);
    if (!value) throw new NotFoundException("Invoice not found");
    return value;
  }
  payments(org: string) {
    return this.repo.payments(org);
  }
  notifications(org: string) {
    return this.repo.notifications(org);
  }
  usage(org: string) {
    return this.repo.usage(org);
  }
  quotas(org: string) {
    return this.repo.quotas(org);
  }
  history(org: string) {
    return this.repo.history(org);
  }
  createReport(org: string, user: string, dto: ReportExportDto) {
    return this.reportsService.create(org, user, dto);
  }
  reports(org: string) {
    return this.reportsService.list(org);
  }
  async getReport(org: string, id: string) {
    return this.reportsService.get(org, id);
  }
  downloadReport(org: string, id: string) {
    return this.reportsService.download(org, id);
  }

  async stripeWebhook(raw: Buffer | undefined, signature: string | undefined) {
    if (!raw || !signature) throw new ForbiddenException();
    const parts = Object.fromEntries(
      signature.split(",").map((v) => v.split("=", 2)),
    );
    const timestamp = Number(parts.t);
    if (!timestamp || Math.abs(Date.now() / 1000 - timestamp) > 300)
      throw new ForbiddenException();
    const expected = createHmac(
      "sha256",
      this.required("STRIPE_WEBHOOK_SECRET"),
    )
      .update(`${timestamp}.${raw.toString("utf8")}`)
      .digest("hex");
    const a = Buffer.from(parts.v1 ?? "");
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b))
      throw new ForbiddenException();
    let event: any;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new BadRequestException("Invalid webhook payload");
    }
    if (!event.id || !event.type || !event.data?.object)
      throw new BadRequestException("Invalid webhook event");
    const object = event.data.object;
    const safe = {
      id: object.id,
      customer: object.customer,
      subscription: object.subscription,
      status: object.status,
      client_reference_id: object.client_reference_id,
      current_period_start: object.current_period_start,
      current_period_end: object.current_period_end,
      cancel_at_period_end: object.cancel_at_period_end,
      currency: object.currency,
      subtotal: object.subtotal,
      tax: object.tax,
      total: object.total,
      amount_paid: object.amount_paid,
      amount_due: object.amount_due,
      amount_refunded: object.amount_refunded,
      payment_intent: object.payment_intent,
      number: object.number,
      hosted_invoice_url: object.hosted_invoice_url,
      invoice_pdf: object.invoice_pdf,
      due_date: object.due_date,
      status_transitions: { paid_at: object.status_transitions?.paid_at },
      created: object.created,
      metadata: {
        price_id: object.metadata?.price_id,
        organization_id: object.metadata?.organization_id,
      },
    };
    if (
      await this.repo.storeWebhook("STRIPE", event.id, event.type, {
        id: event.id,
        type: event.type,
        data: { object: safe },
      })
    )
      await this.repo.applyStripeEvent(event.id, event.type, safe);
    return { received: true };
  }

  async razorpayWebhook(
    raw: Buffer | undefined,
    signature: string | undefined,
    eventId: string | undefined,
  ) {
    if (
      !raw ||
      !signature ||
      !/^[a-f0-9]{64}$/i.test(signature) ||
      !eventId ||
      eventId.length > 255
    )
      throw new ForbiddenException();
    const expected = createHmac(
      "sha256",
      this.required("RAZORPAY_WEBHOOK_SECRET"),
    )
      .update(raw)
      .digest("hex");
    const actualBuffer = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (
      actualBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(actualBuffer, expectedBuffer)
    )
      throw new ForbiddenException();
    let event: any;
    try {
      event = JSON.parse(raw.toString("utf8"));
    } catch {
      throw new BadRequestException("Invalid webhook payload");
    }
    if (
      typeof event.event !== "string" ||
      event.event.length > 100 ||
      !event.payload
    )
      throw new BadRequestException("Invalid webhook event");
    const subscription = event.payload.subscription?.entity;
    const payment = event.payload.payment?.entity;
    const safe = {
      subscription: subscription
        ? {
            id: subscription.id,
            plan_id: subscription.plan_id,
            customer_id: subscription.customer_id,
            status: subscription.status,
            current_start: subscription.current_start,
            current_end: subscription.current_end,
            ended_at: subscription.ended_at,
            paid_count: subscription.paid_count,
            remaining_count: subscription.remaining_count,
            has_scheduled_changes: subscription.has_scheduled_changes,
            notes: {
              organization_id: subscription.notes?.organization_id,
              price_id: subscription.notes?.price_id,
            },
          }
        : undefined,
      payment: payment
        ? {
            id: payment.id,
            status: payment.status,
            amount: payment.amount,
            amount_refunded: payment.amount_refunded,
            currency: payment.currency,
            invoice_id: payment.invoice_id,
            created_at: payment.created_at,
          }
        : undefined,
    };
    if (
      await this.repo.storeWebhook("RAZORPAY", eventId, event.event, {
        event: event.event,
        payload: safe,
      })
    )
      await this.repo.applyRazorpayEvent(eventId, event.event, safe);
    return { received: true };
  }
  private async requirePrice(id: string) {
    const price = await this.repo.price(id);
    if (!price) throw new NotFoundException("Price not found");
    const configuredPriceIds: Record<string, string | undefined> = {
      "00000000-0000-4000-8000-000000000053": this.config.get<string>(
        "STRIPE_STARTER_USD_PRICE_ID",
      ),
      "00000000-0000-4000-8000-000000000052": this.config.get<string>(
        "RAZORPAY_STARTER_INR_PLAN_ID",
      ),
    };
    price.provider_price_id ||= configuredPriceIds[id];
    if (
      !["STRIPE", "RAZORPAY"].includes(price.provider) ||
      !price.provider_price_id
    )
      throw new BadRequestException("Price is not configured for checkout");
    return price;
  }
  private async requireProviderSubscription(org: string) {
    const current = await this.repo.providerSubscription(org);
    if (!current) throw new NotFoundException("Subscription not found");
    if (
      !["STRIPE", "RAZORPAY"].includes(current.provider) ||
      !current.provider_subscription_id
    )
      throw new ConflictException(
        "Subscription is not managed by a payment provider",
      );
    return current;
  }
  private provider(name: string): PaymentProvider {
    if (name === "STRIPE") return this.stripe;
    if (name === "RAZORPAY") return this.razorpay;
    throw new BadRequestException("Unsupported billing provider");
  }
  private required(name: string) {
    const value = this.config.get<string>(name);
    if (!value)
      throw new ForbiddenException("Billing webhook is not configured");
    return value;
  }
}
