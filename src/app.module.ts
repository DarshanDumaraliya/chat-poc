import { Module, OnModuleInit } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from './interceptor/response.interceptor';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InjectConnection } from '@nestjs/typeorm';
import { Connection } from 'typeorm';
import dbDataSource from './database/databaseConfig';
import { CrispModule } from './modules/crisp/crisp.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbDataSource.options),
    CrispModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TransformInterceptor,
    },
  ],
})
export class AppModule implements OnModuleInit {
  constructor(@InjectConnection() private connection: Connection) {}

  async onModuleInit() {
    if (this.connection.isConnected) {
      console.log('Database connection successfully connected');
    }
  }
}
