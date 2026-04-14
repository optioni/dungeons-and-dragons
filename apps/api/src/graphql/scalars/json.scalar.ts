import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Kind, type ValueNode } from 'graphql';

@Scalar('JSON', () => Object)
export class JsonScalar implements CustomScalar<unknown, unknown> {
    description = 'Arbitrary JSON value — maps to JSONB columns';

    serialize(value: unknown): unknown {
        return value;
    }

    parseValue(value: unknown): unknown {
        return value;
    }

    parseLiteral(ast: ValueNode): unknown {
        switch (ast.kind) {
            case Kind.INT:
            case Kind.FLOAT:
                return Number(ast.value);
            case Kind.BOOLEAN:
                return ast.value;
            case Kind.STRING:
                try {
                    return JSON.parse(ast.value) as unknown;
                } catch {
                    return ast.value;
                }
            default:
                return null;
        }
    }
}
