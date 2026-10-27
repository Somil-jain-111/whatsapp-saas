// src/common/validators/is-past-date.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsPastDate(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsPastDate",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: string) {
          if (!value) return false;

          const inputDate = new Date(value);

          if (Number.isNaN(inputDate.getTime())) return false;

          return inputDate < new Date();
        },

        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a past date`;
        },
      },
    });
  };
}
