// src/common/validators/is-valid-status.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsValidStatus(
  allowedStatuses: string[],
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsValidStatus",
      target: object.constructor,
      propertyName,
      constraints: [allowedStatuses],
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const [statuses] = args.constraints;
          return statuses.includes(value);
        },

        defaultMessage(args: ValidationArguments) {
          const [statuses] = args.constraints;
          return `${args.property} must be one of: ${statuses.join(", ")}`;
        },
      },
    });
  };
}
