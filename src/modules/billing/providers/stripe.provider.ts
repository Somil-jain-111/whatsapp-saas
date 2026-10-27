import { HttpService } from "@nestjs/axios";
import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { firstValueFrom } from "rxjs";
import { AppConfigService } from "../../../default/config/config.service";
import { PaymentProvider } from "./payment-provider";

@Injectable()
export class StripeProvider implements PaymentProvider {
  constructor(
    private readonly http: HttpService,
    private readonly config: AppConfigService,
  ) {}

  checkout(organizationId: string, providerPriceId: string, priceId: string) {
    return this.post<{ id: string; url: string | null }>("checkout/sessions", {
      mode: "subscription",
      "line_items[0][price]": providerPriceId,
      "line_items[0][quantity]": "1",
      client_reference_id: organizationId,
      "metadata[price_id]": priceId,
      "subscription_data[metadata][organization_id]": organizationId,
      "subscription_data[metadata][price_id]": priceId,
      success_url: this.required("BILLING_CHECKOUT_SUCCESS_URL"),
      cancel_url: this.required("BILLING_CHECKOUT_CANCEL_URL"),
    }).then((value) => {
      if (!value.url)
        throw new BadGatewayException("Billing provider omitted checkout URL");
      return value;
    });
  }

  portal(customerId: string) {
    return this.post<{ id: string; url: string }>("billing_portal/sessions", {
      customer: customerId,
      return_url: this.required("BILLING_PORTAL_RETURN_URL"),
    });
  }
  async changeSubscription(subscriptionId: string, providerPriceId: string) {
    const subscription = await this.get<{
      items?: { data?: Array<{ id?: string }> };
    }>(`subscriptions/${encodeURIComponent(subscriptionId)}`);
    const itemId = subscription.items?.data?.[0]?.id;
    if (!itemId)
      throw new BadGatewayException(
        "Billing provider subscription has no item",
      );
    return this.post(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
      "items[0][id]": itemId,
      "items[0][price]": providerPriceId,
      proration_behavior: "create_prorations",
    });
  }
  updateCancellation(subscriptionId: string, cancelAtPeriodEnd: boolean) {
    return this.post(`subscriptions/${encodeURIComponent(subscriptionId)}`, {
      cancel_at_period_end: String(cancelAtPeriodEnd),
    });
  }
  cancelNow(subscriptionId: string) {
    return this.delete(`subscriptions/${encodeURIComponent(subscriptionId)}`);
  }

  private async get<T>(path: string): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.get<T>(`${this.baseUrl()}/v1/${path}`, {
            headers: this.headers(),
            timeout: this.timeout(),
          }),
        )
      ).data;
    } catch {
      throw new BadGatewayException("Billing provider request failed");
    }
  }
  private async post<T>(
    path: string,
    values: Record<string, string>,
  ): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.post<T>(
            `${this.baseUrl()}/v1/${path}`,
            new URLSearchParams(values).toString(),
            {
              headers: {
                ...this.headers(),
                "Content-Type": "application/x-www-form-urlencoded",
              },
              timeout: this.timeout(),
            },
          ),
        )
      ).data;
    } catch {
      throw new BadGatewayException("Billing provider request failed");
    }
  }
  private async delete<T>(path: string): Promise<T> {
    try {
      return (
        await firstValueFrom(
          this.http.delete<T>(`${this.baseUrl()}/v1/${path}`, {
            headers: this.headers(),
            timeout: this.timeout(),
          }),
        )
      ).data;
    } catch {
      throw new BadGatewayException("Billing provider request failed");
    }
  }
  private headers() {
    return { Authorization: `Bearer ${this.required("STRIPE_SECRET_KEY")}` };
  }
  private baseUrl() {
    return this.required("STRIPE_API_BASE_URL").replace(/\/$/, "");
  }
  private timeout() {
    return this.config.get<number>("PAYMENT_PROVIDER_TIMEOUT_MS", 8000);
  }
  private required(name: string) {
    const value = this.config.get<string>(name);
    if (!value)
      throw new ServiceUnavailableException(
        "Billing provider is not configured",
      );
    return value;
  }
}
