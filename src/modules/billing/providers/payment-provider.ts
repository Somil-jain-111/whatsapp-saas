export interface PaymentProvider {
  checkout(
    organizationId: string,
    providerPriceId: string,
    priceId: string,
  ): Promise<unknown>;
  portal(providerCustomerId: string): Promise<unknown>;
  changeSubscription(
    providerSubscriptionId: string,
    providerPriceId: string,
  ): Promise<unknown>;
  updateCancellation(
    providerSubscriptionId: string,
    cancelAtPeriodEnd: boolean,
  ): Promise<unknown>;
  cancelNow(providerSubscriptionId: string): Promise<unknown>;
}
