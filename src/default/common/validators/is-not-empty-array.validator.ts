// src/common/validators/is-not-empty-array.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsNotEmptyArray(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsNotEmptyArray",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: any[]) {
          return Array.isArray(value) && value.length > 0;
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a non-empty array`;
        },
      },
    });
  };
}
