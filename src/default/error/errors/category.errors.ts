export const CATEGORY_ERRORS = {
  CATEGORY_NOT_FOUND: {
    code: "CAT_001",
    message: "Category not found",
    statusCode: 404,
  },
  CATEGORY_ALREADY_EXISTS: {
    code: "CAT_002",
    message: "Category already exists",
    statusCode: 400,
  },
  INVALID_CATEGORY_ID: {
    code: "CAT_003",
    message: "Invalid category id",
    statusCode: 400,
  },
  CATEGORY_HAS_PRODUCTS: {
    code: "CAT_004",
    message: "Category has products and cannot be deleted",
    statusCode: 400,
  },
  CATEGORY_UPDATE_FAILED: {
    code: "CAT_005",
    message: "Category update failed",
    statusCode: 400,
  },
  CATEGORY_TOP_LEVEL_NOT_ALLOWED: {
    code: "CAT_006",
    message: "Only Super Admin can create top-level categories",
    statusCode: 403,
  },
  CATEGORY_CIRCULAR_REFERENCE: {
    code: "CAT_007",
    message: "A category cannot become its own descendant",
    statusCode: 400,
  },
  CATEGORY_HAS_CHILDREN: {
    code: "CAT_008",
    message: "Category has active subcategories and cannot be deleted",
    statusCode: 400,
  },
  CATEGORY_SELLER_KYC_NOT_APPROVED: {
    code: "CAT_009",
    message:
      "Your seller KYC must be approved before you can create categories",
    statusCode: 403,
  },
} as const;
