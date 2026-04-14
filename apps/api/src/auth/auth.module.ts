import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { User } from './entities/user.entity';

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
    providers: [AuthService, AuthResolver],
    exports: [AuthService],
})
export class AuthModule {}
