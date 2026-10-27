export const NOTIFICATION_ERRORS = {
  NOTIFICATION_NOT_FOUND: {
    code: "NTF_001",
    message: "Notification not found",
    statusCode: 404,
  },
  NOTIFICATION_SEND_FAILED: {
    code: "NTF_002",
    message: "Notification send failed",
    statusCode: 400,
  },
  INVALID_NOTIFICATION_TYPE: {
    code: "NTF_003",
    message: "Invalid notification type",
    statusCode: 400,
  },
  NOTIFICATION_ALREADY_READ: {
    code: "NTF_004",
    message: "Notification already read",
    statusCode: 400,
  },
  NOTIFICATION_TEMPLATE_NOT_FOUND: {
    code: "NTF_005",
    message: "Notification template not found",
    statusCode: 404,
  },
  NOTIFICATION_TEMPLATE_ALREADY_EXISTS: {
    code: "NTF_006",
    message: "A template for this event type already exists",
    statusCode: 409,
  },
} as const;
