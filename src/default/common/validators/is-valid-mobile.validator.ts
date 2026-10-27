// src/common/validators/is-valid-mobile.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsValidMobile(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsValidMobile",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (!value) return false;

          const mobileRegex = /^[6-9]\d{9}$/;

          return mobileRegex.test(value);
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid 10-digit mobile number`;
        },
      },
    });
  };
}
