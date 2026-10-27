export const INVOICE_SCAN_ERRORS = {
  INVOICE_NOT_FOUND: {
    code: "ISC_001",
    message: "Invoice not found",
    statusCode: 404,
  },
  INVOICE_INACTIVE: {
    code: "ISC_002",
    message: "Invoice is not active",
    statusCode: 422,
  },
  INVOICE_EXPIRED: {
    code: "ISC_003",
    message: "Invoice has expired",
    statusCode: 422,
  },
  SESSION_NOT_FOUND: {
    code: "ISC_004",
    message: "Scan session not found",
    statusCode: 404,
  },
  SESSION_NOT_ACTIVE: {
    code: "ISC_005",
    message: "Scan session is not active",
    statusCode: 409,
  },
  PAIR_NOT_FOUND: {
    code: "ISC_006",
    message: "Pair QR not found",
    statusCode: 404,
  },
  PAIR_NOT_IN_INVOICE: {
    code: "ISC_007",
    message: "Pair QR does not belong to this invoice",
    statusCode: 422,
  },
  DUPLICATE_PAIR: {
    code: "ISC_008",
    message: "Pair QR has already been scanned",
    statusCode: 409,
  },
  PAIR_UNAVAILABLE: {
    code: "ISC_009",
    message: "Pair QR is already used or redeemed",
    statusCode: 409,
  },
  LOCK_UNAVAILABLE: {
    code: "ISC_010",
    message: "The invoice is being processed. Please retry.",
    statusCode: 409,
  },
  NO_VALID_PAIRS: {
    code: "ISC_011",
    message: "No new valid pairs to submit",
    statusCode: 422,
  },
  SINGLE_INVOICE_INCOMPLETE: {
    code: "ISC_012",
    message:
      "All expected pairs must be scanned before submitting a single invoice",
    statusCode: 422,
  },
  INVOICE_ALREADY_SCANNED: {
    code: "ISC_013",
    message: "This invoice has already been fully scanned and rewarded",
    statusCode: 409,
  },
  PAIR_EXPIRED: {
    code: "ISC_014",
    message: "Pair QR has expired and can no longer be scanned",
    statusCode: 422,
  },
  INVOICE_SCAN_WINDOW_EXPIRED: {
    code: "ISC_015",
    message:
      "This invoice is outside its allowed scan window and can no longer be scanned.",
    statusCode: 422,
  },
  INVALID_SCAN_AGE_VALUE: {
    code: "ISC_016",
    message: "Scan-age window must be an integer between 1 and 90 days.",
    statusCode: 400,
  },
  SCAN_AGE_REASON_REQUIRED: {
    code: "ISC_017",
    message: "A reason is required when changing a retailer scan-age window.",
    statusCode: 400,
  },
  SKU_QUANTITY_EXCEEDED: {
    code: "ISC_018",
    message:
      "Scanning this pair would exceed the invoiced quantity for this SKU.",
    statusCode: 422,
  },
  ITEM_MAPPING_MISMATCH: {
    code: "ISC_019",
    message: "This item could not be mapped to a SKU on the invoice.",
    statusCode: 422,
  },
  ITEM_RATE_MISMATCH: {
    code: "ISC_020",
    message: "Item rate does not match the master catalogue rate.",
    statusCode: 422,
  },
  ITEM_RATE_NOT_AVAILABLE: {
    code: "ISC_021",
    message: "Item rate not updated.",
    statusCode: 422,
  },
  PAIR_NOT_IN_SESSION: {
    code: "ISC_022",
    message: "This pair is not part of the current active scan session.",
    statusCode: 404,
  },
  INVOICE_ALREADY_EXISTS: {
    code: "ISC_023",
    message:
      "An invoice with this invoice number and master ID has already been ingested",
    statusCode: 409,
  },
  INVALID_ITEM_REFERENCE: {
    code: "ISC_024",
    message:
      'assortmentdetail[{index}].itemcode "{itemcode}" does not match any entry in itemlist',
    statusCode: 422,
  },
  INVOICE_DISTRIBUTOR_MISMATCH: {
    code: "ISC_025",
    message:
      "This invoice does not belong to a distributor mapped to your account",
    statusCode: 403,
  },
  INVOICE_ALREADY_CLAIMED: {
    code: "ISC_026",
    message: "This invoice is already claimed by another retailer",
    statusCode: 422,
  },
  INVOICE_IN_PROGRESS_OTHER_USER: {
    code: "ISC_027",
    message: "Invoice is currently being scanned in another active session",
    statusCode: 409,
  },
  INVOICE_NOT_SCANNED: {
    code: "ISC_028",
    message: "Invoice scan process is not yet completed",
    statusCode: 422,
  },
} as const;
