export const SHIPPING_ERRORS = {
  SHIPPING_NOT_FOUND: {
    code: "SHP_001",
    message: "Shipping details not found",
    statusCode: 404,
  },
  SHIPPING_NOT_FOUND_BY_ORDER_ID: {
    code: "SHP_002",
    message: "Shipping details not found for orderId: {orderId}",
    statusCode: 404,
  },
  SHIPPING_ADDRESS_REQUIRED: {
    code: "SHP_003",
    message: "Shipping address is required",
    statusCode: 400,
  },
  INVALID_SHIPPING_STATUS: {
    code: "SHP_004",
    message: "Invalid shipping status",
    statusCode: 400,
  },
  SHIPPING_UPDATE_FAILED: {
    code: "SHP_005",
    message: "Shipping update failed",
    statusCode: 400,
  },
  SHIPPING_DETAIL_NOT_FOUND: {
    code: "SHP_006",
    message: "Shipping detail not found",
    statusCode: 404,
  },
  SHIPPING_MOBILE_REQUIRED: {
    code: "SHP_007",
    message: "Shipping mobile number is required",
    statusCode: 400,
  },
} as const;
