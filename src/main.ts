import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { 
    cors: true,
  });

  await app.listen(process.env.PORT ?? 4000);
  console.log(`Server is running on port ${process.env.PORT ?? 4000}`);
}
bootstrap();
