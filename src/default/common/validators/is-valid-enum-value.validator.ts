// src/common/validators/is-valid-enum-value.validator.ts

import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsValidEnumValue(
  enumObject: object,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "IsValidEnumValue",
      target: object.constructor,
      propertyName,
      constraints: [enumObject],
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const [targetEnum] = args.constraints;
          return Object.values(targetEnum).includes(value);
        },

        defaultMessage(args: ValidationArguments) {
          const [targetEnum] = args.constraints;
          return `${args.property} must be one of: ${Object.values(targetEnum).join(", ")}`;
        },
      },
    });
  };
}
