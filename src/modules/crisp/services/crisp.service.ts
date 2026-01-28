import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as Crisp from 'crisp-api';
import { APIResponseInterface } from '../../../interface/response.interface';
import { Conversation } from '../entities/conversation.entity';
import { ConversationMessage } from '../entities/conversation-message.entity';

@Injectable()
export class CrispService {
  private crispClient: any;

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private conversationMessageRepository: Repository<ConversationMessage>,
  ) {
    this.crispClient = new Crisp.default();
    const identifier = process.env.CRISP_IDENTIFIER;
    const key = process.env.CRISP_KEY;
    const tier = process.env.CRISP_TIER || 'plugin'; // Default to 'plugin' tier

    if (!identifier || !key) {
      throw new Error(
        'Crisp API credentials are missing. Please set CRISP_IDENTIFIER and CRISP_KEY environment variables.'
      );
    }

    // Use authenticateTier for plugin authentication (recommended)
    // Fallback to authenticate if authenticateTier is not available
    if (this.crispClient.authenticateTier) {
      this.crispClient.authenticateTier(tier, identifier, key);
    } else {
      this.crispClient.authenticate(identifier, key);
    }
  }

  /**
   * Transform API conversation data to entity format
   */
  private transformConversationData(conversationData: any): Partial<Conversation> {
    return {
      sessionId: conversationData.session_id,
      websiteId: conversationData.website_id,
      activeLast: conversationData.active?.last,
      activeNow: conversationData.active?.now ?? false,
      availability: conversationData.availability,
      createdAtCrisp: conversationData.created_at,
      isBlocked: conversationData.is_blocked ?? false,
      mentions: conversationData.mentions,
      metaNickname: conversationData.meta?.nickname,
      metaEmail: conversationData.meta?.email,
      metaPhone: conversationData.meta?.phone,
      metaAvatar: conversationData.meta?.avatar,
      metaIp: conversationData.meta?.ip,
      metaOrigin: conversationData.meta?.origin,
      metaSegments: conversationData.meta?.segments,
      metaData: conversationData.meta?.data,
      metaDevice: conversationData.meta?.device,
      metaConnection: conversationData.meta?.connection,
      participants: conversationData.participants,
      state: conversationData.state,
      status: conversationData.status ?? 0,
      unreadOperator: conversationData.unread?.operator ?? 0,
      unreadVisitor: conversationData.unread?.visitor ?? 0,
      updatedAtCrisp: conversationData.updated_at,
      verifications: conversationData.verifications,
      lastMessage: conversationData.last_message,
      previewMessageType: conversationData.preview_message?.type,
      previewMessageFrom: conversationData.preview_message?.from,
      previewMessageExcerpt: conversationData.preview_message?.excerpt,
      previewMessageFingerprint: conversationData.preview_message?.fingerprint,
      waitingSince: conversationData.waiting_since,
      assignedUserId: conversationData.assigned?.user_id,
      peopleId: conversationData.people_id,
      compose: conversationData.compose,
    };
  }

  /**
   * Save or update conversation in database
   */
  private async saveOrUpdateConversation(
    conversationData: any
  ): Promise<Conversation> {
    const conversationEntity = this.transformConversationData(conversationData);
    
    // Check if conversation exists
    const existingConversation = await this.conversationRepository.findOne({
      where: { sessionId: conversationEntity.sessionId },
    });

    if (existingConversation) {
      // Update existing conversation
      Object.assign(existingConversation, conversationEntity);
      return await this.conversationRepository.save(existingConversation);
    } else {
      // Create new conversation
      const newConversation = this.conversationRepository.create(conversationEntity);
      return await this.conversationRepository.save(newConversation);
    }
  }

  /**
   * Fetch messages for all conversations and bulk insert/update them
   * @param conversations - Array of conversation objects with session_id and website_id
   * @returns Number of messages saved
   */
  private async fetchAndBulkSaveMessages(
    conversations: any[]
  ): Promise<number> {
    if (!Array.isArray(conversations) || conversations.length === 0) {
      return 0;
    }

    try {
      // Fetch messages for all conversations in parallel
      const messagePromises = conversations.map((conv) =>
        this.crispClient.website
          .getMessagesInConversation(conv.website_id, conv.session_id)
          .catch((error) => {
            console.error(
              `Error fetching messages for session ${conv.session_id}:`,
              error.message
            );
            return []; // Return empty array on error to continue processing
          })
      );

      const messagesArrays = await Promise.all(messagePromises);

      // Flatten all messages into a single array
      const allMessages: any[] = [];
      messagesArrays.forEach((messages) => {
        if (Array.isArray(messages)) {
          allMessages.push(...messages);
        }
      });

      if (allMessages.length === 0) {
        return 0;
      }

      // Deduplicate messages by fingerprint (keep the latest one if duplicates exist)
      const messagesMap = new Map<number, any>();
      allMessages.forEach((msg) => {
        const fingerprint = msg.fingerprint;
        if (fingerprint !== undefined && fingerprint !== null) {
          // If fingerprint already exists, keep the one with higher timestamp (latest)
          const existing = messagesMap.get(fingerprint);
          if (!existing || (msg.timestamp && msg.timestamp > (existing.timestamp || 0))) {
            messagesMap.set(fingerprint, msg);
          }
        }
      });

      // Convert map back to array
      const uniqueMessages = Array.from(messagesMap.values());

      if (uniqueMessages.length === 0) {
        return 0;
      }

      // Transform all messages to entity format
      const messageEntities = uniqueMessages.map((msg) =>
        this.transformMessageData(msg)
      );

      if (messageEntities.length === 0) {
        return 0;
      }

      // Get all unique fingerprints to check existing messages
      const fingerprints = Array.from(new Set(
        messageEntities
          .map((msg) => msg.fingerprint)
          .filter((fp) => fp !== undefined && fp !== null) as number[]
      ));

      if (fingerprints.length === 0) {
        return 0;
      }

      // Find existing messages by fingerprint using In operator
      const existingMessages = await this.conversationMessageRepository.find({
        where: { fingerprint: In(fingerprints) },
      });

      const existingFingerprintsMap = new Map(
        existingMessages.map((msg) => [msg.fingerprint, msg])
      );

      // Separate new and existing messages
      const messagesToInsertMap = new Map<number, Partial<ConversationMessage>>();
      const messagesToUpdate: ConversationMessage[] = [];

      messageEntities.forEach((msgData) => {
        if (!msgData.fingerprint) {
          return; // Skip messages without fingerprint
        }

        if (existingFingerprintsMap.has(msgData.fingerprint)) {
          // Update existing message
          const existing = existingFingerprintsMap.get(msgData.fingerprint)!;
          Object.assign(existing, msgData);
          messagesToUpdate.push(existing);
        } else {
          // New message to insert - use map to ensure no duplicates
          // If same fingerprint appears multiple times, keep the latest one
          const existingInInsert = messagesToInsertMap.get(msgData.fingerprint);
          if (!existingInInsert || (msgData.timestamp && msgData.timestamp > (existingInInsert.timestamp || 0))) {
            messagesToInsertMap.set(msgData.fingerprint, msgData);
          }
        }
      });

      // Convert map to array for insertion
      const messagesToInsert = Array.from(messagesToInsertMap.values());

      let savedCount = 0;

      // Bulk insert new messages with error handling for duplicates
      if (messagesToInsert.length > 0) {
        try {
          const newEntities = messagesToInsert.map((msgData) =>
            this.conversationMessageRepository.create(msgData)
          );
          const inserted = await this.conversationMessageRepository.save(newEntities);
          savedCount += inserted.length;
        } catch (error: any) {
          // If bulk insert fails due to duplicates, try individual inserts with upsert
          // PostgreSQL error code for unique constraint violation
          if (error.code === '23505') {
            console.warn('Bulk insert failed due to duplicates, falling back to individual upserts');
            for (const msgData of messagesToInsert) {
              try {
                const entity = this.conversationMessageRepository.create(msgData);
                await this.conversationMessageRepository.save(entity);
                savedCount++;
              } catch (individualError: any) {
                // If still duplicate, try to update instead
                // PostgreSQL error code for unique constraint violation
                if (individualError.code === '23505' && msgData.fingerprint) {
                  const existing = await this.conversationMessageRepository.findOne({
                    where: { fingerprint: msgData.fingerprint },
                  });
                  if (existing) {
                    Object.assign(existing, msgData);
                    await this.conversationMessageRepository.save(existing);
                    savedCount++;
                  }
                } else {
                  console.error(`Error saving message with fingerprint ${msgData.fingerprint}:`, individualError.message);
                }
              }
            }
          } else {
            throw error;
          }
        }
      }

      // Bulk update existing messages
      if (messagesToUpdate.length > 0) {
        const updated = await this.conversationMessageRepository.save(messagesToUpdate);
        savedCount += updated.length;
      }

      return savedCount;
    } catch (error) {
      console.error('Error in bulk save messages:', error);
      throw error;
    }
  }

  /**
   * List conversations for a website
   * Automatically fetches all conversations by paginating through pages
   * @param websiteId - The Crisp website ID
   * @param pageNumber - Starting page number (default: 1, ignored - always starts from page 1)
   * @returns List of all conversations
   */
  async listConversations(
    websiteId: string,
    pageNumber: number = 1
  ): Promise<APIResponseInterface<any>> {
    try {
      const options = {
        per_page: 20
      };
      
      const allConversations: any[] = [];
      const allSavedConversations: Conversation[] = [];
      let currentPage = 1;
      let totalMessagesSaved = 0;
      let hasMorePages = true;

      console.log(`Starting to fetch all conversations for website: ${websiteId}`);

      // Loop through pages until we get less than 20 conversations
      while (hasMorePages) {
        try {
          console.log(`Fetching page ${currentPage}...`);
          
          const conversations = await this.crispClient.website.listConversations(
            websiteId,
            currentPage,
            options
          );

          if (!Array.isArray(conversations) || conversations.length === 0) {
            console.log(`No conversations found on page ${currentPage}. Stopping pagination.`);
            hasMorePages = false;
            break;
          }

          console.log(`Fetched ${conversations.length} conversations from page ${currentPage}`);

          // Add to accumulated list
          allConversations.push(...conversations);

          // Save/update conversations in database for this batch
          for (const conversation of conversations) {
            const saved = await this.saveOrUpdateConversation(conversation);
            allSavedConversations.push(saved);
          }

          // Fetch and bulk save messages for this batch of conversations
          const messagesSaved = await this.fetchAndBulkSaveMessages(conversations);
          totalMessagesSaved += messagesSaved;
          console.log(`Bulk saved ${messagesSaved} messages for ${conversations.length} conversations from page ${currentPage}`);

          // If we got less than 20 conversations, we've reached the end
          if (conversations.length < 20) {
            console.log(`Received ${conversations.length} conversations (less than 20). Reached end of pagination.`);
            hasMorePages = false;
          } else {
            // Move to next page
            currentPage++;
          }
        } catch (pageError) {
          console.error(`Error fetching page ${currentPage}:`, pageError.message);
          // If there's an error on a page, stop pagination
          hasMorePages = false;
          // If this is the first page and it fails, throw the error
          if (currentPage === 1) {
            throw pageError;
          }
          // Otherwise, just break and return what we have
          break;
        }
      }

      console.log(`Completed fetching all conversations. Total: ${allConversations.length} conversations, ${totalMessagesSaved} messages saved across ${currentPage} page(s)`);

      return {
        code: HttpStatus.OK,
        message: `All conversations retrieved, saved, and messages synced successfully. Fetched ${allConversations.length} conversations and ${totalMessagesSaved} messages from ${currentPage} page(s)`,
        data: allConversations,
        pagination: {
          total: allConversations.length,
          page: currentPage,
          pageParRecord: allConversations.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve conversations',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Transform API message data to entity format
   */
  private transformMessageData(messageData: any): Partial<ConversationMessage> {
    return {
      fingerprint: messageData.fingerprint,
      sessionId: messageData.session_id,
      websiteId: messageData.website_id,
      type: messageData.type,
      from: messageData.from,
      origin: messageData.origin,
      content: messageData.content,
      userId: messageData.user?.user_id,
      userNickname: messageData.user?.nickname,
      preview: messageData.preview,
      mentions: messageData.mentions,
      read: messageData.read,
      delivered: messageData.delivered,
      stamped: messageData.stamped ?? false,
      timestamp: messageData.timestamp,
    };
  }

  /**
   * Save or update message in database
   */
  private async saveOrUpdateMessage(
    messageData: any
  ): Promise<ConversationMessage> {
          const messageEntity = this.transformMessageData(messageData);
    
    // Check if message exists
    const existingMessage = await this.conversationMessageRepository.findOne({
      where: { fingerprint: messageEntity.fingerprint },
    });

    if (existingMessage) {
      // Update existing message
      Object.assign(existingMessage, messageEntity);
      return await this.conversationMessageRepository.save(existingMessage);
    } else {
      // Create new message
      const newMessage = this.conversationMessageRepository.create(messageEntity);
      return await this.conversationMessageRepository.save(newMessage);
    }
  }

  /**
   * Get messages from a specific conversation
   * @param websiteId - The Crisp website ID
   * @param sessionId - The conversation session ID
   * @returns List of messages in the conversation
   */
  async getMessagesInConversation(
    websiteId: string,
    sessionId: string
  ): Promise<APIResponseInterface<any>> {
    try {
      const messages = await this.crispClient.website.getMessagesInConversation(
        websiteId,
        sessionId
      );

      // Save/update messages in database
      const savedMessages: ConversationMessage[] = [];
      if (Array.isArray(messages)) {
        for (const message of messages) {
          const saved = await this.saveOrUpdateMessage(message);
          savedMessages.push(saved);
        }
      }

      return {
        code: HttpStatus.OK,
        message: 'Messages retrieved and saved successfully',
        data: messages,
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve messages',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get all conversations from local database with pagination
   * @param page - Page number (default: 1)
   * @param limit - Number of records per page (default: 10)
   * @param websiteId - Optional website ID filter
   * @returns Paginated list of conversations
   */
  async getAllConversationsFromDb(
    page: number = 1,
    limit: number = 10,
    websiteId?: string
  ): Promise<APIResponseInterface<any>> {
    try {
      const skip = (page - 1) * limit;
      
      // Build query
      const queryBuilder = this.conversationRepository.createQueryBuilder('conversation');
      
      if (websiteId) {
        queryBuilder.where('conversation.websiteId = :websiteId', { websiteId });
      }
      
      // Get total count
      const total = await queryBuilder.getCount();
      
      // Get paginated results
      const conversations = await queryBuilder
        .orderBy('conversation.updatedAtCrisp', 'DESC')
        .skip(skip)
        .take(limit)
        .getMany();

      return {
        code: HttpStatus.OK,
        message: 'Conversations retrieved from database successfully',
        data: conversations,
        pagination: {
          total,
          page,
          pageParRecord: conversations.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve conversations from database',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get messages from local database by conversation session ID with pagination
   * @param sessionId - The conversation session ID
   * @param page - Page number (default: 1)
   * @param limit - Number of records per page (default: 10)
   * @returns Paginated list of messages
   */
  async getMessagesByConversationIdFromDb(
    sessionId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<APIResponseInterface<any>> {
    try {
      const skip = (page - 1) * limit;
      
      // Get total count
      const total = await this.conversationMessageRepository.count({
        where: { sessionId },
      });
      
      // Get paginated results
      const messages = await this.conversationMessageRepository.find({
        where: { sessionId },
        order: { timestamp: 'ASC' },
        skip,
        take: limit,
      });

      return {
        code: HttpStatus.OK,
        message: 'Messages retrieved from database successfully',
        data: messages,
        pagination: {
          total,
          page,
          pageParRecord: messages.length,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to retrieve messages from database',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete all conversations from local database
   * WARNING: This will cascade delete all related messages due to CASCADE relationship
   * @returns Number of deleted conversations
   */
  async deleteAllConversationsFromDb(): Promise<APIResponseInterface<any>> {
    try {
      // Get count before deletion
      const countBefore = await this.conversationRepository.count();
      const messagesCountBefore = await this.conversationMessageRepository.count();
      
      // Use DELETE query instead of TRUNCATE to respect foreign key constraints
      // Messages will be cascade deleted automatically due to CASCADE relationship
      await this.conversationRepository
        .createQueryBuilder()
        .delete()
        .from(Conversation)
        .execute();

      return {  
        code: HttpStatus.OK,
        message: `Successfully deleted ${countBefore} conversation(s) and ${messagesCountBefore} related message(s)`,
        data: {
          deletedConversations: countBefore,
          deletedMessages: messagesCountBefore,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to delete conversations from database',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Delete all messages from local database
   * @returns Number of deleted messages
   */
  async deleteAllMessagesFromDb(): Promise<APIResponseInterface<any>> {
    try {
      // Get count before deletion
      const countBefore = await this.conversationMessageRepository.count();
      
      // Use DELETE query instead of TRUNCATE to respect foreign key constraints
      await this.conversationMessageRepository
        .createQueryBuilder()
        .delete()
        .from(ConversationMessage)
        .execute();

      return {
        code: HttpStatus.OK,
        message: `Successfully deleted ${countBefore} message(s)`,
        data: {
          deletedMessages: countBefore,
        },
      };
    } catch (error) {
      throw new HttpException(
        {
          code: HttpStatus.INTERNAL_SERVER_ERROR,
          message: error.message || 'Failed to delete messages from database',
          data: null,
        },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}

