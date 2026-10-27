export const CART_ERRORS = {
  CART_NOT_FOUND: {
    code: "CRT_001",
    message: "Cart not found",
    statusCode: 404,
  },
  CART_ITEM_NOT_FOUND: {
    code: "CRT_002",
    message: "Cart item not found",
    statusCode: 404,
  },
  CART_IS_EMPTY: {
    code: "CRT_003",
    message: "Cart is empty",
    statusCode: 400,
  },
  INVALID_CART_ITEM: {
    code: "CRT_004",
    message: "Invalid cart item",
    statusCode: 400,
  },
  CART_UPDATE_FAILED: {
    code: "CRT_005",
    message: "Cart update failed",
    statusCode: 400,
  },
  INVALID_CARTON_QUANTITY: {
    code: "CRT_006",
    message: 'cartonQuantity must be a positive integer, "+", or "-"',
    statusCode: 400,
  },
} as const;
