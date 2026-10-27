import * as Joi from "joi";

export const validationSchema = Joi.object({
  // Existing monetary records are INR. Changing their denomination needs a separate migration.
  PRICING_QUOTE_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(1800)
    .default(600),
  PRICING_BASE_CURRENCY: Joi.string().valid("INR").default("INR"),
  FX_API_BASE_URL: Joi.when("FX_SYNC_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string()
      .uri({ scheme: ["https"] })
      .optional(),
  }),
  FX_SYNC_ENABLED: Joi.boolean().default(false),
  FX_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(30000)
    .default(8000),
  FX_MAX_RATE_AGE_SECONDS: Joi.number()
    .integer()
    .min(86400)
    .max(604800)
    .default(172800),
  // General Config
  PORT: Joi.number().default(4002),
  CORS_ALLOWED_ORIGINS: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(1).required(),
    otherwise: Joi.string().allow("").default(""),
  }),
  PAYLOAD_LIMIT: Joi.string()
    .pattern(/^\d+(kb|mb)$/i)
    .default("1mb"),

  NODE_ENV: Joi.string()
    .valid("local", "development", "production", "test", "uat", "preprod")
    .required(),

  API_VERSION: Joi.number().required(),
  SWAGGER_ENABLED: Joi.boolean().truthy("true").falsy("false").default(true),
  SWAGGER_PATH: Joi.string()
    .pattern(/^[a-zA-Z0-9/_-]+$/)
    .default("docs"),
  API_KEY: Joi.string().required(),
  API_SECRET: Joi.string().required(),
  API_KEY_HASH_SECRET: Joi.when("DB_TYPE", {
    is: "postgres",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(32).optional().allow(""),
  }),
  PUBLIC_API_ACCESS_TOKEN_SECRET: Joi.when("DB_TYPE", {
    is: "postgres",
    then: Joi.string()
      .min(32)
      .required()
      .invalid(Joi.ref("API_KEY_HASH_SECRET")),
    otherwise: Joi.string().min(32).optional().allow(""),
  }),
  PUBLIC_API_ACCESS_TOKEN_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(900)
    .default(300),
  PUBLIC_API_KEY_RATE_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(100000)
    .default(60),
  PUBLIC_API_ORG_RATE_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(1000000)
    .default(300),
  PUBLIC_API_SENDER_RATE_PER_MINUTE: Joi.number()
    .integer()
    .min(1)
    .max(100000)
    .default(80),
  PUBLIC_API_DAILY_MESSAGE_LIMIT: Joi.number()
    .integer()
    .min(1)
    .max(100000000)
    .default(10000),
  TLS_CERT_PATH: Joi.string().optional().allow(""),
  TLS_KEY_PATH: Joi.string().optional().allow(""),
  MTLS_CA_PATH: Joi.string().optional().allow(""),

  // Database Config
  DB_TYPE: Joi.string().valid("mysql", "postgres").default("postgres"),
  MYSQL_HOST: Joi.string().optional(),
  MYSQL_PORT: Joi.number().default(3306),
  MYSQL_USERNAME: Joi.string().optional(),
  MYSQL_PASSWORD: Joi.string().allow("").optional(),
  MYSQL_DATABASE: Joi.string().optional(),

  // PostgreSQL Config
  POSTGRES_HOST: Joi.string().optional(),
  POSTGRES_PORT: Joi.number().default(5432),
  POSTGRES_USERNAME: Joi.string().optional(),
  POSTGRES_PASSWORD: Joi.string().allow("").optional(),
  POSTGRES_DATABASE: Joi.string().optional(),

  // JWT Config
  JWT_ACCESS_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required().invalid(Joi.ref("API_SECRET")),
    otherwise: Joi.string().min(16).optional(),
  }),
  JWT_REFRESH_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .min(32)
      .required()
      .invalid(Joi.ref("API_SECRET"), Joi.ref("JWT_ACCESS_SECRET")),
    otherwise: Joi.string().min(16).optional(),
  }),
  JWT_ACCESS_EXPIRES_IN: Joi.string().default("15m"),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default("7d"),
  API_REFRESH_SECRET: Joi.string().optional(),

  EMAIL_VERIFICATION_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(604800)
    .default(86400),
  PASSWORD_RESET_TTL_SECONDS: Joi.number()
    .integer()
    .min(300)
    .max(86400)
    .default(3600),
  APP_WEB_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  MAIL_FROM: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().email().required(),
    otherwise: Joi.string().email().optional().allow(""),
  }),
  COMMUNICATION_API_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  COMMUNICATION_API_TOKEN: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),

  // Meta WhatsApp Cloud API. Required only when the integration is enabled so
  // existing local development remains bootable without production secrets.
  META_INTEGRATION_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),
  META_GRAPH_BASE_URL: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
  }),
  META_GRAPH_API_VERSION: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string()
      .pattern(/^v\d+\.\d+$/)
      .required(),
    otherwise: Joi.string()
      .pattern(/^v\d+\.\d+$/)
      .optional()
      .allow(""),
  }),
  META_APP_ID: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string().max(64).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_APP_SECRET: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_EMBEDDED_SIGNUP_CONFIG_ID: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string().max(64).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_WEBHOOK_CALLBACK_URL: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
  }),
  META_REQUIRED_PERMISSIONS: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string()
      .pattern(/^[a-z_]+(?:,[a-z_]+)*$/)
      .required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_WEBHOOK_VERIFY_TOKEN: Joi.when("META_INTEGRATION_ENABLED", {
    is: true,
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_CREDENTIAL_ENCRYPTION_KEY_BASE64: Joi.when("DB_TYPE", {
    is: "postgres",
    then: Joi.string()
      .base64()
      .custom((value: string, helpers) =>
        Buffer.from(value, "base64").length === 32
          ? value
          : helpers.error("any.invalid"),
      )
      .required(),
    otherwise: Joi.string().base64().optional().allow(""),
  }),
  META_CREDENTIAL_KEY_VERSION: Joi.when("DB_TYPE", {
    is: "postgres",
    then: Joi.string().max(100).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  META_REQUEST_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(30000)
    .default(8000),
  META_SEND_RATE_PER_SECOND: Joi.number()
    .integer()
    .min(1)
    .max(1000)
    .default(20),
  META_WEBHOOK_RETENTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(90)
    .default(30),
  META_ONBOARDING_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .max(1800)
    .default(600),

  BILLING_ENABLED: Joi.boolean().truthy("true").falsy("false").default(false),
  STRIPE_BILLING_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),
  STRIPE_API_BASE_URL: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.when("STRIPE_BILLING_ENABLED", {
      is: true,
      then: Joi.string()
        .uri({ scheme: ["https"] })
        .required(),
      otherwise: Joi.string().uri().optional().allow(""),
    }),
    otherwise: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
  }),
  STRIPE_SECRET_KEY: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.when("STRIPE_BILLING_ENABLED", {
      is: true,
      then: Joi.string().min(16).required(),
      otherwise: Joi.string().optional().allow(""),
    }),
    otherwise: Joi.string().optional().allow(""),
  }),
  STRIPE_WEBHOOK_SECRET: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.when("STRIPE_BILLING_ENABLED", {
      is: true,
      then: Joi.string().min(16).required(),
      otherwise: Joi.string().optional().allow(""),
    }),
    otherwise: Joi.string().optional().allow(""),
  }),
  STRIPE_STARTER_USD_PRICE_ID: Joi.string()
    .pattern(/^price_[A-Za-z0-9]+$/)
    .optional()
    .allow(""),
  RAZORPAY_BILLING_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(false),
  RAZORPAY_API_BASE_URL: Joi.when("RAZORPAY_BILLING_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  RAZORPAY_KEY_ID: Joi.when("RAZORPAY_BILLING_ENABLED", {
    is: true,
    then: Joi.string()
      .pattern(/^rzp_(test|live)_[A-Za-z0-9]+$/)
      .required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  RAZORPAY_KEY_SECRET: Joi.when("RAZORPAY_BILLING_ENABLED", {
    is: true,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  RAZORPAY_WEBHOOK_SECRET: Joi.when("RAZORPAY_BILLING_ENABLED", {
    is: true,
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  RAZORPAY_STARTER_INR_PLAN_ID: Joi.string()
    .pattern(/^plan_[A-Za-z0-9]+$/)
    .optional()
    .allow(""),
  RAZORPAY_SUBSCRIPTION_TOTAL_COUNT: Joi.number()
    .integer()
    .min(1)
    .max(1200)
    .default(120),
  BILLING_CHECKOUT_SUCCESS_URL: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  BILLING_CHECKOUT_CANCEL_URL: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  BILLING_PORTAL_RETURN_URL: Joi.when("BILLING_ENABLED", {
    is: true,
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  KYC_ENCRYPTION_SECRET_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).required(),
  }),
  // Read-only compatibility for records written by the former CBC implementation.
  KYC_ENCRYPTION_FIXED_IV: Joi.string().hex().length(32).optional(),

  // MongoDB Config
  MONGO_HOST: Joi.string().optional(),
  // MONGO_PORT: Joi.number().default(27017),
  MONGO_USERNAME: Joi.string().optional(),
  MONGO_PASSWORD: Joi.string().optional(),
  MONGO_DATABASE: Joi.string().optional(),

  // Redis Config
  REDIS_HOST: Joi.string().required(),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().optional().allow(""),
  REDIS_TLS: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(process.env.NODE_ENV === "production"),
  REDIS_TTL: Joi.number().default(5), // minutes
  LOCATION_PINCODE_CACHE_TTL_SECONDS: Joi.number()
    .integer()
    .positive()
    .default(86400),
  DEVICE_TOKEN_ENCRYPTION_SECRET: Joi.string().min(16).optional(),
  FIREBASE_SERVICE_ACCOUNT_JSON: Joi.string().optional().allow(""),
  FIREBASE_PROJECT_ID: Joi.string().optional().allow(""),
  FIREBASE_CLIENT_EMAIL: Joi.string().email().optional().allow(""),
  FIREBASE_PRIVATE_KEY: Joi.string().optional().allow(""),
  FCM_STALE_TOKEN_DAYS: Joi.number().integer().min(30).max(730).default(90),
  COMMERCE_NOTIFICATION_WORKER_ENABLED: Joi.boolean()
    .truthy("true")
    .falsy("false")
    .default(true),

  // Legacy OTP delivery provider. Optional for the WhatsApp SaaS runtime.
  WHATSAPP_API_URL: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  WHATSAPP_AUTH_TOKEN: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string().min(16).optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  WHATSAPP_PROJECT_ID: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  WHATSAPP_ADMIN_ID: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  WHATSAPP_OTP_TEMPLATE_NAME: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  WHATSAPP_OTP_TEMPLATE_ID: Joi.when("NODE_ENV", {
    is: Joi.valid("production", "uat", "preprod"),
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  WHATSAPP_TIMEOUT_MS: Joi.number().integer().min(500).max(30000).default(8000),

  // Customer checkout payment provider (vendor-neutral adapter).
  PAYMENT_PROVIDER: Joi.string().default("GENERIC"),
  PAYMENT_PROVIDER_CREATE_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  PAYMENT_PROVIDER_REFUND_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  PAYMENT_PROVIDER_STATUS_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  PAYMENT_PROVIDER_API_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  PAYMENT_PROVIDER_WEBHOOK_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).optional().allow(""),
    otherwise: Joi.string().min(16).optional(),
  }),
  PAYMENT_PROVIDER_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(30000)
    .default(8000),
  RETURN_WINDOW_DAYS: Joi.number().integer().min(1).max(365).default(7),
  REPLACEMENT_WINDOW_DAYS: Joi.number().integer().min(1).max(365).default(10),
  SETTLEMENT_HOLD_DAYS: Joi.number().integer().min(0).max(90).default(10),

  // Legal identity used as invoice issuer for marketplace commission services.
  MARKETPLACE_LEGAL_NAME: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(2).max(150).optional().allow(""),
    otherwise: Joi.string().allow("").default(""),
  }),
  MARKETPLACE_GSTIN: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .pattern(/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/)
      .optional()
      .allow(""),
    otherwise: Joi.string().allow("").default(""),
  }),
  MARKETPLACE_REGISTERED_ADDRESS: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(5).max(500).optional().allow(""),
    otherwise: Joi.string().allow("").default(""),
  }),
  MARKETPLACE_STATE: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(2).max(100).optional().allow(""),
    otherwise: Joi.string().allow("").default(""),
  }),
  MARKETPLACE_PINCODE: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .pattern(/^\d{6}$/)
      .optional()
      .allow(""),
    otherwise: Joi.string().allow("").default(""),
  }),

  SHIPPING_PROVIDER: Joi.string().default("GENERIC"),
  SHIPPING_PROVIDER_BASE_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .optional()
      .allow(""),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  SHIPPING_PROVIDER_API_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  SHIPPING_WEBHOOK_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).optional().allow(""),
    otherwise: Joi.string().min(16).optional(),
  }),
  SHIPPING_PROVIDER_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .max(30000)
    .default(8000),

  // Sponsored product boosts
  BOOST_PRICE_PER_DAY: Joi.number().positive().default(100),
  BOOST_CATEGORY_PRICE_MULTIPLIER: Joi.number().min(1).default(2),
  BOOST_CLICK_ATTRIBUTION_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(30)
    .default(7),
  BOOST_PAYMENT_WEBHOOK_SECRET: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(32).optional().allow(""),
    otherwise: Joi.string().min(16).default("local-boost-webhook-secret"),
  }),

  // AWS Config (Required only in production)
  AWS_REGION: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  AWS_ACCESS_KEY_ID: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  AWS_SECRET_ACCESS_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().optional().allow(""),
    otherwise: Joi.string().optional().allow(""),
  }),
  AWS_S3_BUCKET_NAME: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  AWS_S3_BASE_URL: Joi.string().uri().optional().allow(""),
  MEDIA_UPLOAD_PROVIDER: Joi.string()
    .valid("AUTO", "AWS", "R2_TO_S3")
    .default("AUTO"),
  R2_ACCOUNT_ID: Joi.when("MEDIA_UPLOAD_PROVIDER", {
    is: "R2_TO_S3",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  R2_ACCESS_KEY_ID: Joi.when("MEDIA_UPLOAD_PROVIDER", {
    is: "R2_TO_S3",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  R2_SECRET_ACCESS_KEY: Joi.when("MEDIA_UPLOAD_PROVIDER", {
    is: "R2_TO_S3",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  R2_BUCKET_NAME: Joi.when("MEDIA_UPLOAD_PROVIDER", {
    is: "R2_TO_S3",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  R2_ENDPOINT: Joi.string()
    .uri({ scheme: ["https"] })
    .optional()
    .allow(""),
  R2_CDN_BASE_URL: Joi.string().uri().optional().allow(""),
  MALWARE_SCANNER_URL: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string()
      .uri({ scheme: ["https"] })
      .required(),
    otherwise: Joi.string().uri().optional().allow(""),
  }),
  MALWARE_SCANNER_API_KEY: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  MALWARE_SCANNER_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(120000)
    .default(15000),
  MEDIA_PROCESSOR_URL: Joi.string().uri().optional().allow(""),
  MEDIA_PROCESSOR_API_KEY: Joi.when("MEDIA_PROCESSOR_URL", {
    is: Joi.string().min(1).required(),
    then: Joi.string().min(16).required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  MEDIA_PROCESSOR_TIMEOUT_MS: Joi.number()
    .integer()
    .min(1000)
    .max(300000)
    .default(120000),
  MEDIA_PROCESSOR_CALLBACK_SECRET: Joi.when("MEDIA_PROCESSOR_URL", {
    is: Joi.string().min(1).required(),
    then: Joi.string().min(32).required(),
    otherwise: Joi.string().min(16).optional().allow(""),
  }),
  APP_NAME: Joi.when("NODE_ENV", {
    is: "production",
    then: Joi.string().required(),
    otherwise: Joi.string().optional().allow(""),
  }),
  // COMMUNICATION_API_URL: Joi.string()
  //   .uri({ scheme: ['https'] })
  //   .required(),
  // COMMUNICATION_API_TOKEN: Joi.string().min(16).required(),
});
