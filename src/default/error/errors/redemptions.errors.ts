export const REDEMPTIONS_ERRORS = {
  REWARDS_PRODUCTS_CATALOGUE_ID_NOT_FOUND: {
    code: "RE_001",
    message: "Rewards products catalogue id not found",
    statusCode: 404,
  },

  REDEMPTION_ERROR: {
    code: "RE_002",
    message: "Redemption failed, please try again later.",
    statusCode: 500,
  },
  POINT_HISTORY_NOT_FOUND: {
    code: "RE_003",
    message: "Point history record not found",
    statusCode: 404,
  },
} as const;
