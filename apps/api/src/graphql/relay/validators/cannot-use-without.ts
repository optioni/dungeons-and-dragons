import { type ValidationArguments, ValidatorConstraint, ValidatorConstraintInterface } from 'class-validator';

@ValidatorConstraint({ async: false })
export class CannotUseWithout implements ValidatorConstraintInterface {
    validate(value: never, args: ValidationArguments): boolean {
        const object = args.object as Record<string, unknown>;
        const required = args.constraints[0];

        return object[required] !== undefined;
    }

    defaultMessage(args: ValidationArguments): string {
        return `Cannot be used without \`${args.constraints[0]}\`.`;
    }
}
