import {
  Controller,
  Get,
  Delete,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CrispService } from '../services/crisp.service';
import { APIResponseInterface } from '../../../interface/response.interface';

@Controller('crisp-db')
export class CrispDbController {
  constructor(private readonly crispService: CrispService) {}

  /**
   * Get all conversations from local database
   * GET /crisp-db/conversations
   * Query params: 
   *   - page (optional, default: 1)
   *   - limit (optional, default: 10)
   *   - websiteId (optional, filter by website ID)
   */
  @Get('conversations')
  async getAllConversations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('websiteId') websiteId?: string,
  ): Promise<APIResponseInterface<any>> {
    const pageNumber = page ? parseInt(page, 10) : 1;
    const pageLimit = limit ? parseInt(limit, 10) : 10;

    if (isNaN(pageNumber) || pageNumber < 1) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Page number must be a positive integer',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (isNaN(pageLimit) || pageLimit < 1 || pageLimit > 100) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Limit must be a positive integer between 1 and 100',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.crispService.getAllConversationsFromDb(
      pageNumber,
      pageLimit,
      websiteId
    );
  }

  /**
   * Get messages from local database by conversation session ID
   * GET /crisp-db/messages/:sessionId
   * Query params:
   *   - page (optional, default: 1)
   *   - limit (optional, default: 10)
   */
  @Get('messages/:sessionId')
  async getMessagesByConversationId(
    @Param('sessionId') sessionId: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<APIResponseInterface<any>> {
    if (!sessionId) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Session ID is required',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    const pageNumber = page ? parseInt(page, 10) : 1;
    const pageLimit = limit ? parseInt(limit, 10) : 10;

    if (isNaN(pageNumber) || pageNumber < 1) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Page number must be a positive integer',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    if (isNaN(pageLimit) || pageLimit < 1 || pageLimit > 1000) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Limit must be a positive integer between 1 and 100',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.crispService.getMessagesByConversationIdFromDb(
      sessionId,
      pageNumber,
      pageLimit
    );
  }

  /**
   * Delete all conversations from local database
   * DELETE /crisp-db/conversations
   * 
   * WARNING: This will delete all conversation records and cascade delete all related messages
   */
  @Delete('conversations')
  async deleteAllConversations(): Promise<APIResponseInterface<any>> {
    return await this.crispService.deleteAllConversationsFromDb();
  }

  /**
   * Delete all messages from local database
   * DELETE /crisp-db/messages
   * 
   * WARNING: This will delete all message records
   */
  @Delete('messages')
  async deleteAllMessages(): Promise<APIResponseInterface<any>> {
    return await this.crispService.deleteAllMessagesFromDb();
  }
}

