export const APPROVAL_ERRORS = {
  APPROVER_NOT_FOUND: {
    code: "AUTH_007",
    message: "Approver user not found",
    statusCode: 404,
  },
  APPROVAL_NOT_FOUND: {
    code: "APPROVAL_404",
    message: "Approval request not found",
    statusCode: 404,
  },
  ALREADY_PROCESSED: {
    code: "APPROVAL_001",
    message: "This approval request has already been processed",
    statusCode: 400,
  },
  TARGET_USER_NOT_FOUND: {
    code: "USER_404",
    message: "Target user not found",
    statusCode: 404,
  },
  L1_ONLY: {
    code: "APPROVAL_002",
    message: "Only L1 users can process Level 1 approvals",
    statusCode: 403,
  },
  L2_ONLY: {
    code: "APPROVAL_003",
    message: "Only L2 users can process Level 2 approvals",
    statusCode: 403,
  },
  L3_ONLY: {
    code: "APPROVAL_004",
    message: "Only Sales Officers can process Level 3 approvals",
    statusCode: 403,
  },
  INVALID_LEVEL: {
    code: "APPROVAL_005",
    message: "Invalid approval level",
    statusCode: 400,
  },
  REJECT_REASON_TYPE: {
    code: "APPROVAL_006",
    message: "Type of issue is required for rejection",
    statusCode: 400,
  },
} as const;
