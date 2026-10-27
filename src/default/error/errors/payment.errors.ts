export const PAYMENT_ERRORS = {
  PAYMENT_FAILED: {
    code: "PAY_001",
    message: "Payment failed",
    statusCode: 400,
  },
  PAYMENT_NOT_FOUND: {
    code: "PAY_002",
    message: "Payment not found",
    statusCode: 404,
  },
  PAYMENT_ALREADY_COMPLETED: {
    code: "PAY_003",
    message: "Payment already completed",
    statusCode: 400,
  },
  PAYMENT_PENDING: {
    code: "PAY_004",
    message: "Payment is pending",
    statusCode: 400,
  },
  INVALID_PAYMENT_STATUS: {
    code: "PAY_005",
    message: "Invalid payment status",
    statusCode: 400,
  },
  TRANSACTION_IN_PROGRESS: {
    code: "PAY_006",
    message: "A transaction is already in progress. Please wait.",
    statusCode: 400,
  },
  BANK_PAYOUTS_DISABLED: {
    code: "PAY_007",
    message: "Bank payouts (DBT) are currently disabled for your user role.",
    statusCode: 400,
  },
  BANK_DETAILS_NOT_VERIFIED: {
    code: "PAY_008",
    message: "Bank KYC / Bank Account details are not completed or verified.",
    statusCode: 400,
  },
  DAILY_TRANSACTION_LIMIT_REACHED: {
    code: "PAY_009",
    message:
      "You've reached your daily limit of {maxDailyRedemptions} DBT transactions. Please try again tomorrow.",
    statusCode: 400,
  },
  DAILY_POINT_LIMIT_REACHED: {
    code: "PAY_010",
    message:
      "You've already reached your daily limit of {dailyLimit} points. Please try again tomorrow.",
    statusCode: 400,
  },
  DAILY_REMAINING_POINT_LIMIT: {
    code: "PAY_011",
    message: "You can only redeem {remainingPoints} more points today.",
    statusCode: 400,
  },
  MONTHLY_POINT_LIMIT_REACHED: {
    code: "PAY_012",
    message:
      "You've already reached your monthly limit of {monthlyLimit} points. Please try again next month.",
    statusCode: 400,
  },
  MONTHLY_REMAINING_POINT_LIMIT: {
    code: "PAY_013",
    message: "You can only redeem {remainingPoints} more points this month.",
    statusCode: 400,
  },
  TRANSACTION_NOT_FOUND: {
    code: "PAY_014",
    message: "Transaction not found",
    statusCode: 404,
  },
  TRANSACTION_ALREADY_PROCESSED: {
    code: "PAY_015",
    message: "Transaction already processed",
    statusCode: 400,
  },
  PAYOUTS_DISABLED: {
    code: "PAY_016",
    message: "Redemptions/payouts are currently disabled.",
    statusCode: 400,
  },
  BANK_ACCOUNT_NOT_FOUND: {
    code: "PAY_017",
    message: "Bank account not found",
    statusCode: 404,
  },
  RAZORPAY_CONFIGURATION_MISSING: {
    code: "PAY_018",
    message: "Razorpay point purchase is not configured",
    statusCode: 503,
  },
  PAYMENT_LINK_CREATION_FAILED: {
    code: "PAY_019",
    message: "Unable to create Razorpay payment link",
    statusCode: 502,
  },
  INVALID_RAZORPAY_SIGNATURE: {
    code: "PAY_020",
    message: "Invalid Razorpay webhook signature",
    statusCode: 401,
  },
  INVALID_RAZORPAY_WEBHOOK: {
    code: "PAY_021",
    message: "Invalid Razorpay webhook payload",
    statusCode: 422,
  },
  POINT_PURCHASE_NOT_FOUND: {
    code: "PAY_022",
    message: "Point purchase was not found",
    statusCode: 404,
  },
  RAZORPAY_AMOUNT_MISMATCH: {
    code: "PAY_023",
    message: "Razorpay payment details do not match the point purchase",
    statusCode: 422,
  },
  INVALID_PAYMENT_CALLBACK_URL: {
    code: "PAY_024",
    message: "Payment callback URL is not allowed",
    statusCode: 422,
  },
} as const;
