import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  ConflictException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AppConfigService } from "../../../default/config/config.service";
import { PaymentProvider } from "./payment-provider";

@Injectable()
export class RazorpayProvider implements PaymentProvider {
  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  async checkout(
    organizationId: string,
    providerPlanId: string,
    priceId: string,
  ) {
    const value = await this.request<{
      id: string;
      short_url?: string;
    }>("post", "subscriptions", {
      plan_id: providerPlanId,
      total_count: this.config.get<number>(
        "RAZORPAY_SUBSCRIPTION_TOTAL_COUNT",
        120,
      ),
      quantity: 1,
      customer_notify: true,
      notes: { organization_id: organizationId, price_id: priceId },
    });
    if (!value.short_url)
      throw new BadGatewayException("Billing provider omitted checkout URL");
    return { id: value.id, url: value.short_url };
  }

  portal(): Promise<never> {
    throw new ConflictException(
      "Razorpay subscriptions are managed from the billing page",
    );
  }

  changeSubscription(subscriptionId: string, providerPlanId: string) {
    return this.request(
      "patch",
      `subscriptions/${encodeURIComponent(subscriptionId)}`,
      {
        plan_id: providerPlanId,
        schedule_change_at: "cycle_end",
        customer_notify: true,
      },
    );
  }

  updateCancellation(subscriptionId: string, cancelAtPeriodEnd: boolean) {
    if (!cancelAtPeriodEnd)
      throw new ConflictException(
        "A scheduled Razorpay cancellation cannot be reversed",
      );
    return this.cancel(subscriptionId, true);
  }

  cancelNow(subscriptionId: string) {
    return this.cancel(subscriptionId, false);
  }

  private cancel(subscriptionId: string, atCycleEnd: boolean) {
    return this.request(
      "post",
      `subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
      { cancel_at_cycle_end: atCycleEnd },
    );
  }

  private async request<T = unknown>(
    method: "post" | "patch",
    path: string,
    body: Record<string, unknown>,
  ): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.request<T>({
            method,
            url: `${this.baseUrl()}/v1/${path}`,
            data: body,
            auth: {
              username: this.required("RAZORPAY_KEY_ID"),
              password: this.required("RAZORPAY_KEY_SECRET"),
            },
            timeout: this.config.get<number>(
              "PAYMENT_PROVIDER_TIMEOUT_MS",
              8000,
            ),
          }),
        )
      ).data;
    } catch (error) {
      if (
        error instanceof ServiceUnavailableException ||
        error instanceof ConflictException
      )
        throw error;
      throw new BadGatewayException("Billing provider request failed");
    }
  }

  private baseUrl() {
    return this.required("RAZORPAY_API_BASE_URL").replace(/\/$/, "");
  }

  private required(name: string) {
    const value = this.config.get<string>(name);
    if (!value)
      throw new ServiceUnavailableException(
        "Razorpay billing is not configured",
      );
    return value;
  }
}
