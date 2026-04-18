import { Args, Context, Mutation, Resolver } from '@nestjs/graphql';

import { Public } from '../graphql/decorators/public.decorator';
import { AuthService } from './auth.service';
import { AuthPayload } from './dto/auth-payload.type';
import { LoginInput } from './dto/login.input';
import { RegisterInput } from './dto/register.input';

@Resolver()
export class AuthResolver {
    constructor(private readonly authService: AuthService) {}

    @Public()
    @Mutation(() => AuthPayload)
    async register(
        @Args('input') input: RegisterInput,
        @Context() context: { res: { cookie: (name: string, value: string, options: object) => void } },
    ): Promise<AuthPayload> {
        const accessToken = await this.authService.register(input.email, input.password);
        this.setAuthCookie(context.res, accessToken);
        return { accessToken };
    }

    @Public()
    @Mutation(() => AuthPayload)
    async login(
        @Args('input') input: LoginInput,
        @Context() context: { res: { cookie: (name: string, value: string, options: object) => void } },
    ): Promise<AuthPayload> {
        const accessToken = await this.authService.login(input.email, input.password);
        this.setAuthCookie(context.res, accessToken);
        return { accessToken };
    }

    private setAuthCookie(
        response: { cookie: (name: string, value: string, options: object) => void },
        token: string,
    ): void {
        response.cookie('access_token', token, {
            httpOnly: true,
            sameSite: 'strict',
            maxAge: 7 * 24 * 60 * 60 * 1000,
        });
    }
}
