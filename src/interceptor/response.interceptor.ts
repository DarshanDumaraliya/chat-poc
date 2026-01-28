import { Pagination } from '../interface/response.interface';
import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
    HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
    statusCode: number;
    message: string;
    data: T;
    pagination: Pagination;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<T, Response<T> | any> {
    intercept(context: ExecutionContext, next: CallHandler): Observable<Response<T>> {
        return next.handle().pipe(
            map((data) => {
                const controller: any = context.getClass();
                const response = context.switchToHttp().getResponse();
                if (controller?.name === 'FileController') {
                    return response;
                }
                // Check if the status code is not 200
                if (
                    (response.statusCode === HttpStatus.OK || response.statusCode === HttpStatus.CREATED) &&
                    data?.code !== HttpStatus.OK
                ) {
                    const errorCode = data?.code || response.statusCode;
                    const errorMessage = data?.message || null;
                    throw new HttpException(
                        {
                            statusCode: errorCode,
                            message: errorMessage,
                            data: data?.data || null,
                            pagination: data?.pagination || null,
                        },
                        errorCode
                    );
                }

                return {
                    statusCode: data?.code || response.statusCode,
                    data: data?.data || null,
                    message: data?.message || null,
                    pagination: data?.pagination || null,
                };
            })
        );
    }
}
