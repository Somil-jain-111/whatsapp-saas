export const SUPPORT_ERRORS = {
  TICKET_NOT_FOUND: {
    code: "SUP_001",
    message: "Support ticket not found",
    statusCode: 404,
  },
  RESOLUTION_REMARKS_REQUIRED: {
    code: "SUP_002",
    message: "Resolution remarks are required when marking a ticket resolved",
    statusCode: 422,
  },
} as const;
