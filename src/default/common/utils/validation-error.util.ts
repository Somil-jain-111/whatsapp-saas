import { ValidationError } from "@nestjs/common";
import { BusinessException } from "../../error/business.exception";
import { ERROR_CODES } from "../../error/error.code";

export type RequestValidationError = {
  field: string;
  messages: string[];
};

/** Returns client-safe DTO errors without exposing rejected values or DTO instances. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = "",
): RequestValidationError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const current = error.constraints
      ? [{ field, messages: Object.values(error.constraints).map(String) }]
      : [];

    return [
      ...current,
      ...flattenValidationErrors(error.children ?? [], field),
    ];
  });
}

/** Returns the first client-safe DTO message for the response headline. */
export function firstValidationErrorMessage(
  errors: RequestValidationError[],
): string {
  return errors[0]?.messages[0] ?? "Validation failed";
}

/** Use for service-level validation that cannot be expressed in a DTO decorator. */
export function validationFailure(reason: string): BusinessException {
  return new BusinessException(ERROR_CODES.VALIDATION.INVALID_REQUEST, {
    reason,
  });
}
