export const BOOST_ERRORS = {
  PRODUCT_NOT_ELIGIBLE: {
    code: "BST_001",
    message: "Product is not eligible for boosting",
    statusCode: 400,
  },
  CAMPAIGN_ALREADY_EXISTS: {
    code: "BST_002",
    message: "This product already has a pending or active boost",
    statusCode: 409,
  },
  ORDER_NOT_FOUND: {
    code: "BST_003",
    message: "Boost payment order not found",
    statusCode: 404,
  },
  INVALID_PAYMENT_SIGNATURE: {
    code: "BST_004",
    message: "Invalid boost payment signature",
    statusCode: 401,
  },
  PAYMENT_MISMATCH: {
    code: "BST_005",
    message: "Boost payment details do not match the order",
    statusCode: 400,
  },
  PRICING_SLAB_NOT_FOUND: {
    code: "BST_006",
    message: "No active boost pricing is available for this selection",
    statusCode: 422,
  },
} as const;
