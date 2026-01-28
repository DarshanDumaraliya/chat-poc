import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { APIResponseInterface } from './interface/response.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<APIResponseInterface<string>> {
    return await this.appService.getHello();
  }
}
