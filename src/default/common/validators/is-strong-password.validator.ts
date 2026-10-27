// src/common/validators/is-strong-password.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function isStrongPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    /[A-Z]/.test(value) &&
    /[a-z]/.test(value) &&
    /\d/.test(value) &&
    /[@$!%*?&#^()[\]{}_\-+=]/.test(value)
  );
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsStrongPassword",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (!value) return false;

          return isStrongPassword(value);
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must contain at least 8 characters, one uppercase letter, one lowercase letter, one number, and one special character`;
        },
      },
    });
  };
}
