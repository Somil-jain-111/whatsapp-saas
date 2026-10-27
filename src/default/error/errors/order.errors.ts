export const ORDER_ERRORS = {
  ORDER_NOT_FOUND: {
    code: "ORD_001",
    message: "Order not found",
    statusCode: 404,
  },
  ORDER_NOT_FOUND_BY_ID: {
    code: "ORD_002",
    message: "Order not found for orderId: {orderId}",
    statusCode: 404,
  },
  INVALID_ORDER_STATUS: {
    code: "ORD_003",
    message: "Invalid order status",
    statusCode: 400,
  },
  ORDER_ALREADY_CANCELLED: {
    code: "ORD_004",
    message: "Order is already cancelled",
    statusCode: 400,
  },
  ORDER_CREATION_FAILED: {
    code: "ORD_005",
    message: "Order creation failed",
    statusCode: 400,
  },
  ORDER_ALREADY_PLACED: {
    code: "ORDER_021",
    message: "Order already placed",
    statusCode: 400,
  },
} as const;
