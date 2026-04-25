import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
    const logger = new Logger('Bootstrap');
    const app = await NestFactory.create(AppModule);

    app.use(cookieParser());

    const corsOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:4000';
    app.enableCors({
        origin: corsOrigin,
        credentials: true,
    });

    const port = process.env.PORT ?? 3000;
    await app.listen(port);
    logger.log(`Port: ${port}`);
    logger.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
    logger.log(`CORS origin: ${corsOrigin}`);
    logger.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
}

bootstrap().catch((error: unknown) => {
    const logger = new Logger('Bootstrap');
    const errorClass = error instanceof Error ? error.constructor.name : 'UnknownError';
    logger.error(`Bootstrap failed: errorClass=${errorClass}`, error instanceof Error ? error.stack : String(error));
    process.exit(1);
});
