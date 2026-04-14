import { registerEnumType } from '@nestjs/graphql';

export enum OrderByDirection {
    ASC = 'ASC',
    DESC = 'DESC',
}

export interface OrderBy<T = string> {
    field: T;

    direction: OrderByDirection;
}

registerEnumType(OrderByDirection, { name: 'OrderByDirection' });
