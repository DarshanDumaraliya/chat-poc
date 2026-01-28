import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Crisp from 'crisp-api';
import { Conversation } from '../entities/conversation.entity';
import { ConversationMessage } from '../entities/conversation-message.entity';

/**
 * Crisp RTM (Real-Time Messaging) Service
 * 
 * This service uses Crisp WebSocket RTM to sync real-time messages and conversations
 * to PostgreSQL database.
 * 
 * Features:
 * - Listens for new conversations (session:request:initiated)
 * - Syncs visitor messages (message:send)
 * - Syncs operator messages (message:receive)
 * - Stores all data in PostgreSQL with idempotency
 * 
 * Usage:
 * 1. Set environment variables: CRISP_IDENTIFIER, CRISP_KEY, CRISP_TIER
 * 2. Service auto-starts on module init
 * 3. All events are automatically synced to database
 */
@Injectable()
export class CrispRtmService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CrispRtmService.name);
  private crispClient: any;
  private isConnected = false;

  constructor(
    @InjectRepository(Conversation)
    private conversationRepository: Repository<Conversation>,
    @InjectRepository(ConversationMessage)
    private conversationMessageRepository: Repository<ConversationMessage>,
  ) {
    // Initialize Crisp client
    this.crispClient = new Crisp.default();
    
    const identifier = process.env.CRISP_IDENTIFIER;
    const key = process.env.CRISP_KEY;
    const tier = process.env.CRISP_TIER || 'plugin';

    if (!identifier || !key) {
      this.logger.error(
        'CRISP_IDENTIFIER and CRISP_KEY are required for RTM service. RTM will not start.'
      );
      return;
    }

    // Authenticate
    if (this.crispClient.authenticateTier) {
      this.crispClient.authenticateTier(tier, identifier, key);
    } else {
      this.crispClient.authenticate(identifier, key);
    }

    // Set RTM mode to WebSockets
    if (this.crispClient.setRtmMode) {
      this.crispClient.setRtmMode('websockets');
    }

    this.setupEventHandlers();
  }

  /**
   * Initialize RTM connection when module starts
   */
  async onModuleInit() {
    try {
      this.logger.log('Initializing Crisp RTM service...');
      
      // Connect to RTM (if connection method exists)
      if (this.crispClient.connect) {
        await this.crispClient.connect();
        this.isConnected = true;
        this.logger.log('Crisp RTM connected successfully');
      } else {
        // Some versions auto-connect on event registration
        this.isConnected = true;
        this.logger.log('Crisp RTM event handlers registered');
      }
    } catch (error) {
      this.logger.error('Failed to initialize Crisp RTM:', error);
      this.isConnected = false;
    }
  }

  /**
   * Cleanup on module destroy
   */
  async onModuleDestroy() {
    try {
      if (this.crispClient && this.crispClient.disconnect) {
        await this.crispClient.disconnect();
        this.logger.log('Crisp RTM disconnected');
      }
      this.isConnected = false;
    } catch (error) {
      this.logger.error('Error disconnecting Crisp RTM:', error);
    }
  }

  /**
   * Setup all RTM event handlers
   */
  private setupEventHandlers() {
    // 1. NEW CONVERSATION EVENT
    // Detects when a new conversation session is initiated
    this.crispClient.on('session:request:initiated', async (data: any) => {
      try {
        this.logger.log(`New conversation started: ${data.session_id}`);
        // Store session in database
        await this.syncNewConversation(data);
      } catch (error) {
        this.logger.error('Error handling session:request:initiated:', error);
      }
    });

    // 2. VISITOR MESSAGE EVENT
    // Messages sent by visitors
    this.crispClient.on('message:send', async (msg: any) => {
      try {
        this.logger.debug(`Visitor message received: ${msg.fingerprint || msg.message_id}`);
        // Store message in database
        await this.syncMessage(msg, 'visitor');
      } catch (error) {
        this.logger.error('Error handling message:send:', error);
      }
    });

    // 3. OPERATOR MESSAGE EVENT
    // Messages sent by operators or bots
    this.crispClient.on('message:received', async (msg: any) => {
      try {
        this.logger.debug(`Operator message received: ${msg.fingerprint || msg.message_id}`);
        // Store message in database
        await this.syncMessage(msg, 'operator');
      } catch (error) {
        this.logger.error('Error handling message:received:', error);
      }
    });

    // Note: Crisp RTM API does not support generic 'connect', 'disconnect', or 'error' events
    // Connection status is managed through onModuleInit/onModuleDestroy lifecycle hooks
  }

  /**
   * Sync new conversation to database
   * Creates conversation record when session is initiated
   */
  private async syncNewConversation(data: any): Promise<void> {
    try {
      const sessionId = data.session_id;
      const websiteId = data.website_id;

      if (!sessionId || !websiteId) {
        this.logger.warn('Missing session_id or website_id in session:request:initiated event');
        return;
      }

      // Check if conversation already exists
      const existing = await this.conversationRepository.findOne({
        where: { sessionId },
      });

      if (existing) {
        this.logger.debug(`Conversation ${sessionId} already exists, skipping`);
        return;
      }

      // Create new conversation
      const conversation = this.conversationRepository.create({
        sessionId,
        websiteId,
        createdAtCrisp: data.created_at || Date.now(),
        updatedAtCrisp: data.updated_at || Date.now(),
        status: 0, // Active
        state: data.state || 'active',
        activeNow: true,
        isBlocked: false,
        unreadOperator: 0,
        unreadVisitor: 0,
        // Map additional fields if available
        metaNickname: data.meta?.nickname,
        metaEmail: data.meta?.email,
        metaPhone: data.meta?.phone,
        metaIp: data.meta?.ip,
        metaOrigin: data.meta?.origin,
        participants: data.participants || [],
      });

      await this.conversationRepository.save(conversation);
      this.logger.log(`Synced new conversation: ${sessionId}`);
    } catch (error) {
      this.logger.error('Error syncing new conversation:', error);
      throw error;
    }
  }

  /**
   * Transform API message data to entity format
   * Maps Crisp API response to ConversationMessage entity fields
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
   * Sync message to database
   * Fetches full message details from Crisp API and saves to database
   * Handles both visitor and operator messages with idempotency
   */
  private async syncMessage(msg: any, author: 'visitor' | 'operator'): Promise<void> {
    try {
      const fingerprint = msg.fingerprint || msg.message_id;
      const sessionId = msg.session_id;
      const websiteId = msg.website_id;

      if (!fingerprint || !sessionId || !websiteId) {
        this.logger.warn('Missing required fields in message event', { msg });
        return;
      }

      // Check for duplicate (idempotency)
      const existing = await this.conversationMessageRepository.findOne({
        where: { fingerprint: fingerprint },
      });

      if (existing) {
        this.logger.debug(`Message ${fingerprint} already exists, skipping`);
        return;
      }

      // Ensure conversation exists
      await this.ensureConversationExists(sessionId, websiteId);

      // Fetch full message details from Crisp API
      let messageData: any;
      try {
        this.logger.debug(`Fetching full message details for fingerprint ${fingerprint} from Crisp API`);
        
        // Get all messages from conversation and find the one with matching fingerprint
        // The Crisp API wrapper doesn't have a direct method to get a single message
        const messagesResponse = await this.crispClient.website.getMessagesInConversation(
          websiteId,
          sessionId
        );

        // Handle API response structure (messages may be an array directly or nested)
        const messages = Array.isArray(messagesResponse) 
          ? messagesResponse 
          : messagesResponse?.data || [];

        // Find the message with matching fingerprint
        const foundMessage = messages.find((m: any) => 
          m.fingerprint === fingerprint || m.fingerprint?.toString() === fingerprint?.toString()
        );

        if (foundMessage) {
          messageData = foundMessage;
          this.logger.debug(`Successfully found message ${fingerprint} in conversation messages`);
        } else {
          this.logger.warn(
            `Message ${fingerprint} not found in conversation messages, using RTM event data`
          );
          // Fallback to RTM event data
          messageData = msg;
          // Override 'from' field with author from RTM event
          messageData.from = author;
        }
      } catch (error) {
        this.logger.warn(`Error fetching messages from Crisp API:`, error.message);
        // Fallback to RTM event data
        messageData = msg;
        // Override 'from' field with author from RTM event
        messageData.from = author;
      }

      // Transform API response to entity format
      const messageEntity = this.transformMessageData(messageData);

      // Ensure required fields are set
      if (!messageEntity.fingerprint) {
        messageEntity.fingerprint = fingerprint;
      }
      if (!messageEntity.sessionId) {
        messageEntity.sessionId = sessionId;
      }
      if (!messageEntity.websiteId) {
        messageEntity.websiteId = websiteId;
      }
      if (!messageEntity.from) {
        messageEntity.from = author;
      }
      if (!messageEntity.timestamp) {
        messageEntity.timestamp = Date.now();
      }

      // Create and save message with full details
      const message = this.conversationMessageRepository.create(messageEntity);
      await this.conversationMessageRepository.save(message);
      
      this.logger.debug(`Synced ${author} message: ${fingerprint} for session ${sessionId}`);
    } catch (error) {
      // Handle duplicate key errors gracefully (race conditions)
      if (error.code === '23505') {
        this.logger.debug(`Message ${msg.fingerprint || msg.message_id} was already inserted (race condition)`);
      } else {
        this.logger.error('Error syncing message:', error);
        throw error;
      }
    }
  }

  /**
   * Transform API conversation data to entity format
   * Maps Crisp API response to Conversation entity fields
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
   * Ensure conversation exists for a session
   * Fetches full conversation details from Crisp API if it doesn't exist
   */
  private async ensureConversationExists(sessionId: string, websiteId: string): Promise<void> {
    const existing = await this.conversationRepository.findOne({
      where: { sessionId },
    });

    if (!existing) {
      this.logger.debug(`Conversation not found for session ${sessionId}, fetching from Crisp API`);
      
      try {
        // Fetch full conversation details from Crisp API
        const conversationResponse = await this.crispClient.website.getConversation(
          websiteId,
          sessionId
        );

        // Handle API response structure (data may be nested in 'data' property)
        const conversationData = conversationResponse?.data || conversationResponse;

        if (!conversationData || conversationData.error) {
          this.logger.warn(
            `Failed to fetch conversation ${sessionId} from Crisp API: ${conversationData?.reason || 'Unknown error'}`
          );
          // Fallback to creating minimal conversation
          const fallbackConversation = this.conversationRepository.create({
            sessionId,
            websiteId,
            createdAtCrisp: Date.now(),
            updatedAtCrisp: Date.now(),
            status: 0,
            state: 'active',
            activeNow: true,
            isBlocked: false,
            unreadOperator: 0,
            unreadVisitor: 0,
          });
          await this.conversationRepository.save(fallbackConversation);
          this.logger.debug(`Created fallback conversation for session ${sessionId}`);
          return;
        }

        // Transform API response to entity format
        const conversationEntity = this.transformConversationData(conversationData);

        // Create and save conversation with full details
        const conversation = this.conversationRepository.create(conversationEntity);
        await this.conversationRepository.save(conversation);
        
        this.logger.log(`Fetched and saved full conversation details for session ${sessionId}`);
      } catch (error) {
        this.logger.error(`Error fetching conversation ${sessionId} from Crisp API:`, error);
        
        // Fallback to creating minimal conversation on error
        const fallbackConversation = this.conversationRepository.create({
          sessionId,
          websiteId,
          createdAtCrisp: Date.now(),
          updatedAtCrisp: Date.now(),
          status: 0,
          state: 'active',
          activeNow: true,
          isBlocked: false,
          unreadOperator: 0,
          unreadVisitor: 0,
        });
        await this.conversationRepository.save(fallbackConversation);
        this.logger.debug(`Created fallback conversation for session ${sessionId} due to API error`);
      }
    }
  }

  /**
   * Get RTM connection status
   */
  getConnectionStatus(): boolean {
    return this.isConnected;
  }

  /**
   * Manually reconnect RTM (if needed)
   */
  async reconnect(): Promise<void> {
    try {
      if (this.crispClient && this.crispClient.disconnect) {
        await this.crispClient.disconnect();
      }
      if (this.crispClient && this.crispClient.connect) {
        await this.crispClient.connect();
        this.isConnected = true;
        this.logger.log('Crisp RTM reconnected');
      }
    } catch (error) {
      this.logger.error('Error reconnecting Crisp RTM:', error);
      throw error;
    }
  }
}
