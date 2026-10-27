export const INVENTORY_ERRORS = {
  INVENTORY_NOT_FOUND: {
    code: "INV_001",
    message: "Inventory not found",
    statusCode: 404,
  },
  INSUFFICIENT_STOCK: {
    code: "INV_002",
    message: "Insufficient stock",
    statusCode: 400,
  },
  INVALID_STOCK_QUANTITY: {
    code: "INV_003",
    message: "Invalid stock quantity",
    statusCode: 400,
  },
  INVENTORY_UPDATE_FAILED: {
    code: "INV_004",
    message: "Inventory update failed",
    statusCode: 400,
  },
  STOCK_ALREADY_RESERVED: {
    code: "INV_005",
    message: "Stock already reserved",
    statusCode: 400,
  },
} as const;
