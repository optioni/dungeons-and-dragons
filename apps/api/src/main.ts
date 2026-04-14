import cookieParser from 'cookie-parser';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());

    app.enableCors({
        origin: process.env.WEB_ORIGIN ?? 'http://localhost:4000',
        credentials: true,
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    process.stdout.write(`API is running on http://localhost:${port}/graphql\n`);
}

bootstrap();
