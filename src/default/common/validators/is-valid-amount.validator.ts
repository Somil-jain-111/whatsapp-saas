// src/common/validators/is-valid-amount.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsValidAmount(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsValidAmount",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: number) {
          if (typeof value !== "number") return false;

          return value > 0 && Number.isFinite(value);
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid amount greater than 0`;
        },
      },
    });
  };
}
