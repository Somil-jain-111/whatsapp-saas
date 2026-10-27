import {
  ADMIN_ERRORS,
  AUTH_ERRORS,
  CART_ERRORS,
  CATEGORY_ERRORS,
  COMMON_ERRORS,
  COUPON_ERRORS,
  DATABASE_ERRORS,
  INVENTORY_ERRORS,
  NOTIFICATION_ERRORS,
  ORDER_ITEM_ERRORS,
  ORDER_ERRORS,
  PAYMENT_ERRORS,
  PRODUCT_ERRORS,
  REPOSITORY_ERRORS,
  ROLE_ERRORS,
  SHIPPING_ERRORS,
  USER_ERRORS,
  VALIDATION_ERRORS,
  KYC_ERRORS,
  REWARDS_ERRORS,
  ADDRESS_ERRORS,
  OTP_ERRORS,
  APPROVAL_ERRORS,
  ONBOARD_ERRORS,
  REDEMPTIONS_ERRORS,
  PERMISSION_ERRORS,
  SELLER_ERRORS,
  BOOST_ERRORS,
} from "./errors";
import { ANNOUNCEMENT_ERRORS } from "./errors/announcement.errors";
import { APP_VERSION_ERRORS } from "./errors/app_version.errors";
import { BANNER_ERRORS } from "./errors/banner.errors";
import { CMS_PAGE_ERRORS } from "./errors/cms-page.errors";
import { FAQ_ERRORS } from "./errors/faq.errors";
import { INVOICE_SCAN_ERRORS } from "./errors/invoice-scan.errors";
import { DISTRIBUTOR_RETURN_ERRORS } from "./errors/distributor-return.errors";
import { DISTRIBUTOR_TRANSFER_ERRORS } from "./errors/distributor-transfer.errors";
import { SUPPORT_ERRORS } from "./errors/support.errors";
import { SUPER_ADMIN_ERRORS } from "./errors/super-admin.errors";
import { VIDEO_ERRORS } from "./errors/video.errors";
import { CUSTOMER_RETURN_ERRORS } from "./errors/customer-return.errors";
import { STAFF_ERRORS } from "./errors/staff.errors";
import { ANALYTICS_ERRORS } from "./errors/analytics.errors";
import { DEVELOPER_ERRORS } from "./errors/developer.errors";

export type ErrorCodeValue = {
  code: string;
  message: string;
  statusCode: number;
};

export const ERROR_CODES = {
  ADMIN: ADMIN_ERRORS,
  AUTH: AUTH_ERRORS,
  CART: CART_ERRORS,
  CATEGORY: CATEGORY_ERRORS,
  COMMON: COMMON_ERRORS,
  COUPON: COUPON_ERRORS,
  DATABASE: DATABASE_ERRORS,
  INVENTORY: INVENTORY_ERRORS,
  NOTIFICATION: NOTIFICATION_ERRORS,
  ORDER_ITEM: ORDER_ITEM_ERRORS,
  ORDER: ORDER_ERRORS,
  PAYMENT: PAYMENT_ERRORS,
  PRODUCT: PRODUCT_ERRORS,
  REPOSITORY: REPOSITORY_ERRORS,
  ROLE: ROLE_ERRORS,
  SHIPPING: SHIPPING_ERRORS,
  USER: USER_ERRORS,
  VALIDATION: VALIDATION_ERRORS,
  KYC: KYC_ERRORS,
  REWARDS: REWARDS_ERRORS,
  ADDRESS: ADDRESS_ERRORS,
  OTP: OTP_ERRORS,
  APPROVAL: APPROVAL_ERRORS,
  ONBOARD: ONBOARD_ERRORS,
  REDEMPTIONS: REDEMPTIONS_ERRORS,
  ANNOUNCEMENT: ANNOUNCEMENT_ERRORS,
  APP_VERSION: APP_VERSION_ERRORS,
  BANNER: BANNER_ERRORS,
  CMS_PAGE: CMS_PAGE_ERRORS,
  FAQ: FAQ_ERRORS,
  INVOICE_SCAN: INVOICE_SCAN_ERRORS,
  DISTRIBUTOR_RETURN: DISTRIBUTOR_RETURN_ERRORS,
  DISTRIBUTOR_TRANSFER: DISTRIBUTOR_TRANSFER_ERRORS,
  SUPPORT: SUPPORT_ERRORS,
  SUPER_ADMIN: SUPER_ADMIN_ERRORS,
  VIDEO: VIDEO_ERRORS,
  CUSTOMER_RETURN: CUSTOMER_RETURN_ERRORS,
  PERMISSION: PERMISSION_ERRORS,
  SELLER: SELLER_ERRORS,
  BOOST: BOOST_ERRORS,
  STAFF: STAFF_ERRORS,
  ANALYTICS: ANALYTICS_ERRORS,
  DEVELOPER: DEVELOPER_ERRORS,
} as const;

export type ErrorCodeGroups = typeof ERROR_CODES;

export function getErrorCodeByCode(code: string): ErrorCodeValue | null {
  for (const group of Object.values(ERROR_CODES)) {
    for (const error of Object.values(group)) {
      if (error.code === code) {
        return error;
      }
    }
  }

  return null;
}

export * from "./errors";
