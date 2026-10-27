export const COUPON_ERRORS = {
  COUPON_NOT_FOUND: {
    code: "CPN_001",
    message: "Coupon not found",
    statusCode: 404,
  },
  COUPON_ALREADY_REDEEMED: {
    code: "CPN_002",
    message: "Coupon already redeemed",
    statusCode: 400,
  },
  COUPON_EXPIRED: {
    code: "CPN_003",
    message: "Coupon expired",
    statusCode: 400,
  },
  INVALID_COUPON: {
    code: "CPN_004",
    message: "Invalid coupon",
    statusCode: 400,
  },
  COUPON_NOT_APPLICABLE: {
    code: "CPN_005",
    message: "Coupon is not applicable",
    statusCode: 400,
  },
  COUPON_INACTIVE: {
    code: "CPN_006",
    message: "Coupon is inactive",
    statusCode: 400,
  },
  COUPON_NOT_STARTED: {
    code: "CPN_007",
    message: "Coupon has not started",
    statusCode: 400,
  },
  COUPON_USAGE_LIMIT_REACHED: {
    code: "CPN_008",
    message: "Coupon usage limit reached",
    statusCode: 409,
  },
  COUPON_USER_LIMIT_REACHED: {
    code: "CPN_009",
    message: "Coupon user limit reached",
    statusCode: 409,
  },
  COUPON_NOT_ELIGIBLE_FOR_USER: {
    code: "CPN_010",
    message: "Coupon not applicable to this account",
    statusCode: 400,
  },
  COUPON_MIN_ORDER_NOT_MET: {
    code: "CPN_011",
    message: "Coupon minimum eligible order value not met",
    statusCode: 400,
  },
  COUPON_NO_ELIGIBLE_ITEMS: {
    code: "CPN_012",
    message: "Coupon has no eligible items",
    statusCode: 400,
  },
  COUPON_CODE_EXISTS: {
    code: "CPN_013",
    message: "Coupon code already exists",
    statusCode: 409,
  },
} as const;
