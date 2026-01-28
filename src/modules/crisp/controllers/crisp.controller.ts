import {
  Controller,
  Get,
  Param,
  Query,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { CrispService } from '../services/crisp.service';
import { APIResponseInterface } from '../../../interface/response.interface';

@Controller('crisp')
export class CrispController {
  constructor(private readonly crispService: CrispService) {}

  /**
   * Get list of all conversations for a website
   * Automatically paginates through all pages until all conversations are fetched
   * GET /crisp/conversations/:websiteId
   * Query params: page (optional, ignored - always starts from page 1 and fetches all)
   * 
   * This endpoint will:
   * 1. Start from page 1
   * 2. Fetch 20 conversations per page
   * 3. Automatically continue to next page if 20 conversations are returned
   * 4. Stop when less than 20 conversations are returned
   * 5. Fetch and save messages for all conversations
   * 6. Return all conversations in a single response
   */
  @Get('conversations/:websiteId')
  async listConversations(
    @Param('websiteId') websiteId: string,
    @Query('page') page?: string
  ): Promise<APIResponseInterface<any>> {
    if (!websiteId) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Website ID is required',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    // Page parameter is ignored - always starts from page 1 and fetches all
    // Keeping it for backward compatibility but not using it
    const pageNumber = page ? parseInt(page, 10) : 1;
    if (page && (isNaN(pageNumber) || pageNumber < 1)) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Page number must be a positive integer',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.crispService.listConversations(websiteId, pageNumber);
  }

  /**
   * Get messages from a specific conversation
   * GET /crisp/messages/:websiteId/:sessionId
   */
  @Get('messages/:websiteId/:sessionId')
  async getMessages(
    @Param('websiteId') websiteId: string,
    @Param('sessionId') sessionId: string
  ): Promise<APIResponseInterface<any>> {
    if (!websiteId || !sessionId) {
      throw new HttpException(
        {
          code: HttpStatus.BAD_REQUEST,
          message: 'Website ID and Session ID are required',
          data: null,
        },
        HttpStatus.BAD_REQUEST
      );
    }

    return await this.crispService.getMessagesInConversation(
      websiteId,
      sessionId
    );
  }
}

