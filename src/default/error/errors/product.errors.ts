export const PRODUCT_ERRORS = {
  PRODUCT_NOT_FOUND: {
    code: "PRD_001",
    message: "Product not found",
    statusCode: 404,
  },
  PRODUCT_NOT_FOUND_BY_SKU: {
    code: "PRD_002",
    message: "Product not found for sku: {sku}",
    statusCode: 404,
  },
  INVALID_PRODUCT: {
    code: "PRD_003",
    message: "Invalid product selected",
    statusCode: 400,
  },
  PRODUCT_OUT_OF_STOCK: {
    code: "PRD_004",
    message: "Product is out of stock",
    statusCode: 400,
  },
  PRODUCT_ALREADY_EXISTS: {
    code: "PRD_005",
    message: "Product already exists",
    statusCode: 400,
  },
  PRODUCT_SELLER_KYC_NOT_APPROVED: {
    code: "PRD_006",
    message: "Your seller KYC must be approved before you can list products",
    statusCode: 403,
  },
  PRODUCT_REJECTION_REASON_REQUIRED: {
    code: "PRD_007",
    message: "A rejection reason is required when rejecting a product",
    statusCode: 400,
  },
  PRODUCT_INVALID_STATUS_TRANSITION: {
    code: "PRD_008",
    message: "Product cannot move from {from} to {to}",
    statusCode: 400,
  },
  PRODUCT_NOT_OWNED: {
    code: "PRD_009",
    message: "You do not own this product",
    statusCode: 403,
  },
  PRODUCT_SKU_ALREADY_EXISTS: {
    code: "PRD_010",
    message: "SKU {sku} is already in use",
    statusCode: 400,
  },
} as const;
