export const DISTRIBUTOR_TRANSFER_ERRORS = {
  INVOICE_NOT_FOUND: {
    code: "DTR_001",
    message: "Invoice not found for this distributor",
    statusCode: 404,
  },
  INVOICE_NOT_APPROVED: {
    code: "DTR_002",
    message: "Invoice must be approved before it can be transferred",
    statusCode: 422,
  },
  CANNOT_TRANSFER_TO_SELF: {
    code: "DTR_005",
    message: "Cannot transfer an invoice to yourself",
    statusCode: 422,
  },
  TRANSFER_ALREADY_REQUESTED: {
    code: "DTR_006",
    message: "A transfer request for this invoice is already pending approval",
    statusCode: 409,
  },
  REQUEST_NOT_FOUND: {
    code: "DTR_007",
    message: "Transfer request not found",
    statusCode: 404,
  },
  TRANSFER_ALREADY_ALLOCATED: {
    code: "DTR_008",
    message:
      "This transfer request has already been allocated to a distributor",
    statusCode: 409,
  },
} as const;
