export class DataSanitizer {
  private static readonly defaultSensitiveFields = [
    "password",
    "otp",
    "otpGeneratedAt",
    "refreshToken",
    "refreshTokenExpiry",
    "accessToken",
    "verificationToken",
    "token",
    "tokenHash",
    "token_hash",
  ];

  private static readonly defaultDateFields = [
    "createdAt",
    "updatedAt",
    "deletedAt",
    "created_at",
    "updated_at",
    "deleted_at",
    "otp_expiry",
    "otpExpiry",
    "redeem_date",
    "redeemDate",
    "date",
  ];

  /**
   * Sanitize data based on sensitive fields and format date fields.
   *
   * @param data The data to sanitize.
   * @param additionalFields Fields to add to the default sensitive fields.
   * @param overrideSensitiveFields Fields to completely override the default sensitive fields.
   */
  static sanitizeData(
    data: any,
    additionalFields: string[] = [],
    overrideSensitiveFields?: string[],
  ): any {
    if (data === null || data === undefined) {
      return data;
    }

    const sensitiveFields = overrideSensitiveFields
      ? overrideSensitiveFields
      : [...this.defaultSensitiveFields, ...additionalFields];

    if (Array.isArray(data)) {
      return data.map((item) =>
        this.sanitizeData(item, additionalFields, overrideSensitiveFields),
      );
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (typeof data === "object") {
      const sanitized = this.removeSensitiveFields(data, sensitiveFields);
      return this.formatDateFieldsForResponse(sanitized);
    }

    return data;
  }

  private static removeSensitiveFields(
    obj: Record<string, any>,
    sensitiveFields: string[],
  ): any {
    if (obj === null || obj === undefined || obj instanceof Date) {
      return obj;
    }

    const sanitizedObject: Record<string, any> = { ...obj };

    for (const key of Object.keys(sanitizedObject)) {
      if (sensitiveFields.includes(key)) {
        delete sanitizedObject[key];
      } else if (
        typeof sanitizedObject[key] === "object" &&
        sanitizedObject[key] !== null &&
        !(sanitizedObject[key] instanceof Date)
      ) {
        sanitizedObject[key] = this.sanitizeData(
          sanitizedObject[key],
          [],
          sensitiveFields,
        );
      }
    }

    return sanitizedObject;
  }

  /**
   * Format date fields in an object, array, or nested response to ISO string format.
   *
   * @param data The data containing date fields to format.
   * @param customFields Additional field names to treat as date fields.
   */
  static formatDateFieldsForResponse(
    data: any,
    customFields: string[] = [],
  ): any {
    if (data === null || data === undefined) {
      return data;
    }

    const fieldsToFormat = [...this.defaultDateFields, ...customFields];

    if (Array.isArray(data)) {
      return data.map((item) =>
        this.formatDateFieldsForResponse(item, customFields),
      );
    }

    if (data instanceof Date) {
      return data.toISOString();
    }

    if (typeof data === "object") {
      const result: Record<string, any> = { ...data };

      for (const key of Object.keys(result)) {
        result[key] = this.formatDateFieldValue(
          result[key],
          key,
          fieldsToFormat,
          customFields,
        );
      }

      return result;
    }

    return data;
  }

  private static formatDateFieldValue(
    val: any,
    key: string,
    fieldsToFormat: string[],
    customFields: string[],
  ): any {
    if (val instanceof Date) {
      return val.toISOString();
    }

    if (fieldsToFormat.includes(key) && val !== null && val !== undefined) {
      return this.parseDateStringOrNumber(val);
    }

    if (typeof val === "object" && val !== null) {
      return this.formatDateFieldsForResponse(val, customFields);
    }

    return val;
  }

  private static parseDateStringOrNumber(val: any): any {
    if (typeof val !== "string" && typeof val !== "number") {
      return val;
    }

    const parsedDate = new Date(val);
    return isNaN(parsedDate.getTime()) ? val : parsedDate.toISOString();
  }
}
