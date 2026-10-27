import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

export function IsFromDateBeforeToDate(
  property: string,
  validationOptions?: ValidationOptions,
) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isFromDateBeforeToDate",
      target: object.constructor,
      propertyName,
      constraints: [property],
      options: validationOptions,
      validator: {
        validate(value: string, args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;
          const relatedValue = (args.object as any)[relatedPropertyName];

          if (!value || !relatedValue) {
            return true;
          }

          const fromDate = new Date(value);
          const toDate = new Date(relatedValue);

          return fromDate <= toDate;
        },

        defaultMessage(args: ValidationArguments) {
          const [relatedPropertyName] = args.constraints;

          return `${args.property} must be less than or equal to ${relatedPropertyName}`;
        },
      },
    });
  };
}
