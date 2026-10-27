export const REWARDS_ERRORS = {
  REWARDS_BASE_URL_MISSING: {
    code: "REWARDS_001",
    message: "Rewards API base URL is missing",
    statusCode: 500,
  },
  PERMANENT_TOKEN_MISSING: {
    code: "REWARDS_002",
    message: "Rewards permanent token is missing",
    statusCode: 500,
  },
  CATALOGUE_ID_MISSING: {
    code: "REWARDS_003",
    message: "Catalogue ID is missing",
    statusCode: 500,
  },
  CATALOGUE_FETCH_FAILED: {
    code: "REWARDS_004",
    message: "Catalogue products fetch failed",
    statusCode: 400,
  },
  CATALOGUE_CATEGORY_FETCH_FAILED: {
    code: "REWARDS_005",
    message: "Catalogue categories fetch failed",
    statusCode: 400,
  },
  REDEMPTION_DISABLED: {
    code: "REWARDS_006",
    message: "Redemptions are currently disabled for your user type.",
    statusCode: 400,
  },

  PHYSICAL_REDEMPTION_DISABLED: {
    code: "REWARDS_007",
    message: "Physical redemptions are currently disabled for your user type.",
    statusCode: 400,
  },

  DIGITAL_REDEMPTION_DISABLED: {
    code: "REWARDS_008",
    message: "Digital redemptions are currently disabled for your user type.",
    statusCode: 400,
  },

  PRODUCT_NOT_FOUND: {
    code: "REWARDS_009",
    message: "Product not found",
    statusCode: 404,
  },

  INVALID_REWARD_POINTS: {
    code: "REWARDS_010",
    message: "Invalid reward points",
    statusCode: 400,
  },

  INSUFFICIENT_POINTS: {
    code: "REWARDS_011",
    message: "Insufficient points",
    statusCode: 400,
  },
  CATALOGUE_ID_NOT_FOUND: {
    code: "REWARDS_020",
    message: "Rewards catalogue id not found",
    statusCode: 500,
  },
} as const;
