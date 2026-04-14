import { type CustomDecorator, SetMetadata } from '@nestjs/common';

/**
 * Marks a route or method as publicly accessible.
 * @returns A custom decorator function.
 */
// eslint-disable-next-line @typescript-eslint/naming-convention
export function Public(): CustomDecorator {
    return SetMetadata('isPublic', true);
}
