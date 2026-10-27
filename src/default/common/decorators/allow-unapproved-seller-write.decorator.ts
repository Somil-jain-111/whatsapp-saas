import { SetMetadata } from "@nestjs/common";

export const ALLOW_UNAPPROVED_SELLER_WRITE = "allowUnapprovedSellerWrite";

/** Restrict usage to authentication and seller onboarding/KYC correction endpoints. */
export const AllowUnapprovedSellerWrite = () =>
  SetMetadata(ALLOW_UNAPPROVED_SELLER_WRITE, true);
