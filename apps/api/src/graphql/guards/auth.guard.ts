import { InjectRepository } from '@mikro-orm/nestjs';
import { type EntityRepository } from '@mikro-orm/postgresql';
import { CanActivate, type ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import { JwtService } from '@nestjs/jwt';

import { User } from '../../auth/entities/user.entity';
import { type JwtPayload } from '../payload/jwt.payload';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(
        private readonly reflector: Reflector,
        private readonly jwtService: JwtService,
        @InjectRepository(User)
        private readonly userRepository: EntityRepository<User>,
    ) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const isPublic = this.reflector.get<boolean>('isPublic', context.getHandler()) ?? false;

        if (isPublic) {
            return true;
        }

        // Allow unauthenticated access to metrics endpoint
        const httpRequest = context.switchToHttp().getRequest<{ url?: string } | null>();
        if (httpRequest?.url === '/metrics') {
            return true;
        }

        const gqlContext = GqlExecutionContext.create(context).getContext<{
            req: { headers: { cookie?: string; authorization?: string }; dbUser?: User }
        }>();
        const request = gqlContext.req;

        const token = this.extractToken(request.headers);

        if (!token) {
            throw new UnauthorizedException('Authentication required');
        }

        let payload: JwtPayload;
        try {
            payload = this.jwtService.verify<JwtPayload>(token);
        } catch {
            throw new UnauthorizedException('Invalid or expired token');
        }

        const user = await this.userRepository.getEntityManager().findOne(User, { id: Number(payload.sub) });

        if (!user) {
            throw new UnauthorizedException('User not found');
        }

        request.dbUser = user;
        return true;
    }

    private extractToken(headers: { cookie?: string; authorization?: string }): string | undefined {
        // Try httpOnly cookie first
        if (headers.cookie) {
            const match = /access_token=([^;]+)/u.exec(headers.cookie);
            if (match?.[1]) {
                return match[1];
            }
        }

        // Fall back to Authorization bearer
        if (headers.authorization?.startsWith('Bearer ')) {
            return headers.authorization.slice(7);
        }

        return undefined;
    }
}
