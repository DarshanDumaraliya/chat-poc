import { Injectable } from '@nestjs/common';
import { APIResponseInterface } from './interface/response.interface';

@Injectable()
export class AppService {
  async getHello(): Promise<APIResponseInterface<string>> {
    return Promise.resolve({
      code: 200,
      message: 'Hello World!',
      data: 'Hello World!',
    });
  }
}
