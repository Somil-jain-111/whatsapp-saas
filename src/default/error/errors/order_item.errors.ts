export const ORDER_ITEM_ERRORS = {
  ORDER_ITEM_NOT_FOUND: {
    code: "ORI_001",
    message: "Order item not found",
    statusCode: 404,
  },
  INVALID_ORDER_ITEM: {
    code: "ORI_002",
    message: "Invalid order item",
    statusCode: 400,
  },
  ORDER_ITEM_QUANTITY_INVALID: {
    code: "ORI_003",
    message: "Order item quantity is invalid",
    statusCode: 400,
  },
  ORDER_ITEM_PRODUCT_REQUIRED: {
    code: "ORI_004",
    message: "Order item product is required",
    statusCode: 400,
  },
  ORDER_ITEM_UPDATE_FAILED: {
    code: "ORI_005",
    message: "Order item update failed",
    statusCode: 400,
  },
} as const;
