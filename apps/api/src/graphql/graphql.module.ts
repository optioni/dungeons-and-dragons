import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';

import { User } from '../auth/entities/user.entity';
import { GraphqlService } from './graphql.service';
import { AuthGuard } from './guards/auth.guard';
import { WhereService } from './where.service';

@Module({
    imports: [
        MikroOrmModule.forFeature([User]),
        JwtModule.registerAsync({
            useFactory: (configService: ConfigService) => ({
                secret: configService.getOrThrow<string>('JWT_SECRET'),
                signOptions: { expiresIn: '7d' },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [
        AuthGuard,
        {
            provide: APP_GUARD,
            useClass: AuthGuard,
        },
        GraphqlService,
        WhereService,
    ],
    exports: [AuthGuard, GraphqlService],
})
export class GraphqlModule {}
