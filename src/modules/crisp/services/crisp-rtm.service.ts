import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Crisp from 'crisp-api';
import { Conversation } from '../entities/conversation.entity';
import { ConversationMessage } from '../entities/conversation-message.entity';
import { CompletedConversation } from '../entities/completed-conversation.entity';
import { CrispService } from './crisp.service';

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
    @InjectRepository(CompletedConversation)
    private completedConversationRepository: Repository<CompletedConversation>,
    private crispService: CrispService,
  ) {
    // Initialize Crisp client
    this.crispClient = new Crisp.default();

    const identifier = process.env.CRISP_IDENTIFIER;
    const key = process.env.CRISP_KEY;
    const tier = process.env.CRISP_TIER || 'plugin';

    if (!identifier || !key) {
      this.logger.error(
        'CRISP_IDENTIFIER and CRISP_KEY are required for RTM service. RTM will not start.',
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
    // CONVERSATION EVENT
    // Detects when a new conversation session is initiated
    // Single handler for "new conversation" – only for session:request:initiated
    this.crispClient.on('session:request:initiated', async (data: any) => {
      try {
        this.logger.log(`New conversation started: ${data.session_id}`);
        await this.syncNewConversation(data);
        if (data?.session_id && data?.website_id) {
          await this.refreshConversationDetails(data.session_id, data.website_id);
        }
      } catch (error) {
        this.logger.error('Error handling session:request:initiated:', error);
      }
    });

    // Multiple session events → same handler: refresh conversation in DB
    const sessionEventsToRefresh = [
      'session:update_availability',
      'session:update_verify',
      'session:set_email',
      'session:set_phone',
      'session:set_address',
      'session:set_subject',
      'session:set_avatar',
      'session:set_nickname',
      'session:set_origin',
      'session:set_data',
      'session:set_segments',
      'session:set_block',
      'session:set_opened',
      'session:set_closed',
      'session:set_participants',
      'session:set_mentions',
      'session:set_routing',
      'session:set_inbox',
      'session:set_state',
      'session:sync:capabilities',
      'session:sync:geolocation',
      'session:sync:system',
      'session:sync:network',
      'session:sync:timezone',
      'session:sync:locales',
      'session:sync:pages',
      'session:sync:events',
      'session:sync:rating',
      'session:sync:topic',
      'session:error',
    ];
    sessionEventsToRefresh.forEach((eventName) => {
      this.crispClient.on(eventName, async (data: any) => {
        try {
          const sessionId = data?.session_id;
          const websiteId = data?.website_id;
          if (!sessionId || !websiteId) return;
          this.logger.debug(`[${eventName}] ${sessionId}`);
          // When state becomes "resolved", snapshot session + all messages into completed_conversations
          if (eventName === 'session:set_state') {
            if (data?.state === 'resolved') {
              await this.createCompletedConversation(sessionId, websiteId);
            } else {
              // When state is not resolved, mark existing completed_conversation as inactive
              const existing = await this.completedConversationRepository.findOne({
                where: { sessionId },
              });
              if (existing) {
                existing.isActive = false;
                await this.completedConversationRepository.save(existing);
                this.logger.debug(
                  `Set completed_conversation is_active=false for session ${sessionId}`,
                );
              }
              await this.crispService.setSummaryInactive(sessionId);
            }
          }
          await this.refreshConversationDetails(sessionId, websiteId);
        } catch (error) {
          this.logger.error(`Error handling ${eventName}:`, error);
        }
      });
    });

    // Session removed → delete conversation (cascade messages)
    this.crispClient.on('session:removed', async (data: any) => {
      try {
        const sessionId = data?.session_id;
        if (!sessionId) return;
        const conv = await this.conversationRepository.findOne({
          where: { sessionId },
        });
        if (conv) {
          await this.conversationRepository.remove(conv);
          this.logger.log(`Session removed: ${sessionId}`);
        }
      } catch (error) {
        this.logger.error('Error handling session:removed:', error);
      }
    });

    // VISITOR MESSAGE EVENT
    // Messages sent by visitors
    this.crispClient.on('message:send', async (msg: any) => {
      try {
        this.logger.debug(
          `Visitor message received: ${msg.fingerprint || msg.message_id}`,
        );
        // Store message in database
        await this.syncMessage(msg, 'visitor');
      } catch (error) {
        this.logger.error('Error handling message:send:', error);
      }
    });

    // Messages sent by operators or bots
    this.crispClient.on('message:received', async (msg: any) => {
      try {
        this.logger.debug(
          `Operator message received: ${msg.fingerprint || msg.message_id}`,
        );
        await this.syncMessage(msg, 'operator');
      } catch (error) {
        this.logger.error('Error handling message:received:', error);
      }
    });

    // --- Message Events (https://docs.crisp.chat/references/rtm-api/v1/#message-events) ---
    // message:updated → update message by fingerprint, refresh conversation
    this.crispClient.on('message:updated', async (data: any) => {
      try {
        const sessionId = data?.session_id;
        const websiteId = data?.website_id;
        if (!sessionId || !websiteId) return;
        await this.handleMessageUpdated(data);
      } catch (error) {
        this.logger.error('Error handling message:updated:', error);
      }
    });

    // message:removed → delete message by fingerprint, refresh conversation
    this.crispClient.on('message:removed', async (data: any) => {
      try {
        const sessionId = data?.session_id;
        const websiteId = data?.website_id;
        if (!sessionId || !websiteId) return;
        await this.handleMessageRemoved(data);
      } catch (error) {
        this.logger.error('Error handling message:removed:', error);
      }
    });

    // message:compose:send, message:compose:receive → refresh conversation (typing/compose state)
    const messageComposeEvents = ['message:compose:send', 'message:compose:receive'];
    messageComposeEvents.forEach((eventName) => {
      this.crispClient.on(eventName, async (data: any) => {
        try {
          const sessionId = data?.session_id;
          const websiteId = data?.website_id;
          if (!sessionId || !websiteId) return;
          this.logger.debug(`[${eventName}] ${sessionId}`);
          await this.refreshConversationDetails(sessionId, websiteId);
        } catch (error) {
          this.logger.error(`Error handling ${eventName}:`, error);
        }
      });
    });

    // message:acknowledge:* and message:notify:* → refresh conversation and messages (read/delivered state)
    const messageAckNotifyEvents = [
      'message:acknowledge:read:send',
      'message:acknowledge:read:received',
      'message:acknowledge:unread:send',
      'message:acknowledge:delivered',
      'message:acknowledge:ignored',
      'message:notify:unread:send',
      'message:notify:unread:received',
    ];
    messageAckNotifyEvents.forEach((eventName) => {
      this.crispClient.on(eventName, async (data: any) => {
        try {
          const sessionId = data?.session_id;
          const websiteId = data?.website_id;
          if (!sessionId || !websiteId) return;
          this.logger.debug(`[${eventName}] ${sessionId}`);
          await this.refreshConversationAndMessages(sessionId, websiteId);
        } catch (error) {
          this.logger.error(`Error handling ${eventName}:`, error);
        }
      });
    });

    // --- Browsing Events (https://docs.crisp.chat/references/rtm-api/v1/#browsing-events) ---
    const browsingEvents = ['browsing:request:initiated', 'browsing:request:rejected'];
    browsingEvents.forEach((eventName) => {
      this.crispClient.on(eventName, async (data: any) => {
        try {
          const sessionId = data?.session_id;
          const websiteId = data?.website_id;
          if (!sessionId || !websiteId) return;
          this.logger.debug(`[${eventName}] ${sessionId}`);
          await this.refreshConversationDetails(sessionId, websiteId);
        } catch (error) {
          this.logger.error(`Error handling ${eventName}:`, error);
        }
      });
    });

    // --- Call Events (https://docs.crisp.chat/references/rtm-api/v1/#call-events) ---
    const callEvents = ['call:request:initiated', 'call:request:rejected'];
    callEvents.forEach((eventName) => {
      this.crispClient.on(eventName, async (data: any) => {
        try {
          const sessionId = data?.session_id;
          const websiteId = data?.website_id;
          if (!sessionId || !websiteId) return;
          this.logger.debug(`[${eventName}] ${sessionId}`);
          await this.refreshConversationDetails(sessionId, websiteId);
        } catch (error) {
          this.logger.error(`Error handling ${eventName}:`, error);
        }
      });
    });

    // --- Identity Events (https://docs.crisp.chat/references/rtm-api/v1/#identity-events) ---
    this.crispClient.on('identity:verify:request', async (data: any) => {
      try {
        const sessionId = data?.session_id;
        const websiteId = data?.website_id;
        if (!sessionId || !websiteId) return;
        this.logger.debug('[identity:verify:request] ' + sessionId);
        await this.refreshConversationDetails(sessionId, websiteId);
      } catch (error) {
        this.logger.error('Error handling identity:verify:request:', error);
      }
    });
  }

  /**
   * Handle message:updated – update message by fingerprint, then refresh conversation.
   * See https://docs.crisp.chat/references/rtm-api/v1/#message-updated
   */
  private async handleMessageUpdated(data: any): Promise<void> {
    const sessionId = data.session_id;
    const websiteId = data.website_id;
    const fingerprint = data.fingerprint;
    await this.ensureConversationExists(sessionId, websiteId);
    if (fingerprint != null) {
      try {
        const messagesResponse =
          await this.crispClient.website.getMessagesInConversation(websiteId, sessionId);
        const list = Array.isArray(messagesResponse)
          ? messagesResponse
          : messagesResponse?.data ?? [];
        const msg = list.find(
          (m: any) =>
            m.fingerprint === fingerprint ||
            m.fingerprint?.toString() === String(fingerprint),
        );
        if (msg) {
          const entity = this.transformMessageData(msg);
          if (!entity.sessionId) entity.sessionId = sessionId;
          if (!entity.websiteId) entity.websiteId = websiteId;
          if (!entity.fingerprint) entity.fingerprint = fingerprint;
          const existing = await this.conversationMessageRepository.findOne({
            where: { fingerprint },
          });
          if (existing) {
            Object.assign(existing, entity);
            await this.conversationMessageRepository.save(existing);
          } else {
            const created = this.conversationMessageRepository.create(entity);
            await this.conversationMessageRepository.save(created);
          }
        }
      } catch (e: any) {
        this.logger.warn(`handleMessageUpdated fetch messages: ${e?.message ?? e}`);
      }
    }
    await this.refreshConversationDetails(sessionId, websiteId);
  }

  /**
   * Handle message:removed – delete message by fingerprint, then refresh conversation.
   * See https://docs.crisp.chat/references/rtm-api/v1/#message-removed
   */
  private async handleMessageRemoved(data: any): Promise<void> {
    const sessionId = data.session_id;
    const websiteId = data.website_id;
    const fingerprint = data.fingerprint;
    if (fingerprint != null) {
      try {
        const existing = await this.conversationMessageRepository.findOne({
          where: { fingerprint },
        });
        if (existing) {
          await this.conversationMessageRepository.remove(existing);
          this.logger.debug(`Message removed: fingerprint ${fingerprint}`);
        }
      } catch (e: any) {
        this.logger.warn(`handleMessageRemoved: ${e?.message ?? e}`);
      }
    }
    await this.refreshConversationDetails(sessionId, websiteId);
  }

  /**
   * Refresh conversation and all messages for a session (e.g. after acknowledge/notify events).
   */
  private async refreshConversationAndMessages(
    sessionId: string,
    websiteId: string,
  ): Promise<void> {
    await this.ensureConversationExists(sessionId, websiteId);
    try {
      const messagesResponse =
        await this.crispClient.website.getMessagesInConversation(websiteId, sessionId);
      const list = Array.isArray(messagesResponse)
        ? messagesResponse
        : messagesResponse?.data ?? [];
      for (const msg of list) {
        if (msg.fingerprint == null) continue;
        const entity = this.transformMessageData(msg);
        if (!entity.sessionId) entity.sessionId = sessionId;
        if (!entity.websiteId) entity.websiteId = websiteId;
        if (!entity.fingerprint) entity.fingerprint = msg.fingerprint;
        const existing = await this.conversationMessageRepository.findOne({
          where: { fingerprint: msg.fingerprint },
        });
        if (existing) {
          Object.assign(existing, entity);
          await this.conversationMessageRepository.save(existing);
        } else {
          const created = this.conversationMessageRepository.create(entity);
          await this.conversationMessageRepository.save(created);
        }
      }
    } catch (e: any) {
      this.logger.warn(
        `refreshConversationAndMessages for ${sessionId}: ${e?.message ?? e}`,
      );
    }
    await this.refreshConversationDetails(sessionId, websiteId);
  }

  /**
   * When session state becomes "resolved", snapshot full session + all messages
   * into completed_conversations (session_json stores everything, no length limit in logic).
   */
  private async createCompletedConversation(
    sessionId: string,
    websiteId: string,
  ): Promise<void> {
    try {
      const conversationResponse =
        await this.crispClient.website.getConversation(websiteId, sessionId);
      const conversationData =
        conversationResponse?.data ?? conversationResponse;
      if (!conversationData || conversationData.error) {
        this.logger.warn(
          `createCompletedConversation: no conversation for ${sessionId}`,
        );
        return;
      }

      let messagesList: any[] = [];
      try {
        const messagesResponse =
          await this.crispClient.website.getMessagesInConversation(
            websiteId,
            sessionId,
          );
        messagesList = Array.isArray(messagesResponse)
          ? messagesResponse
          : messagesResponse?.data ?? [];
      } catch (e: any) {
        this.logger.warn(
          `createCompletedConversation: messages fetch failed for ${sessionId}: ${e?.message ?? e}`,
        );
      }

      const sessionJson = {
        session: conversationData,
        messages: messagesList,
      };

      const existing = await this.completedConversationRepository.findOne({
        where: { sessionId },
      });
      if (existing) {
        existing.sessionJson = sessionJson;
        existing.isActive = true;
        await this.completedConversationRepository.save(existing);
        this.logger.log(`Updated completed_conversation for session ${sessionId}`);
      } else {
        const row = this.completedConversationRepository.create({
          sessionId,
          sessionJson,
          isActive: true,
        });
        await this.completedConversationRepository.save(row);
        this.logger.log(`Created completed_conversation for session ${sessionId}`);
      }
      await this.crispService.generateAndSaveSummary(sessionId, sessionJson);
    } catch (error: any) {
      this.logger.error(
        `createCompletedConversation for ${sessionId}: ${error?.message ?? error}`,
      );
    }
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
        this.logger.warn(
          'Missing session_id or website_id in session:request:initiated event',
        );
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
  private async syncMessage(
    msg: any,
    author: 'visitor' | 'operator',
  ): Promise<void> {
    try {
      const fingerprint = msg.fingerprint || msg.message_id;
      const sessionId = msg.session_id;
      const websiteId = msg.website_id;

      if (!fingerprint || !sessionId || !websiteId) {
        this.logger.warn('Missing required fields in message event', { msg });
        return;
      }

      // Ensure conversation exists (we upsert message below; no early skip)
      await this.ensureConversationExists(sessionId, websiteId);

      // Always refresh latest conversation details on message events
      // (keeps unread counts, last_message, preview_message, status/state, etc. up-to-date)
      await this.refreshConversationDetails(sessionId, websiteId);

      // Fetch full message details from Crisp API
      let messageData: any;
      try {
        this.logger.debug(
          `Fetching full message details for fingerprint ${fingerprint} from Crisp API`,
        );

        // Get all messages from conversation and find the one with matching fingerprint
        // The Crisp API wrapper doesn't have a direct method to get a single message
        const messagesResponse =
          await this.crispClient.website.getMessagesInConversation(
            websiteId,
            sessionId,
          );

        // Handle API response structure (messages may be an array directly or nested)
        const messages = Array.isArray(messagesResponse)
          ? messagesResponse
          : messagesResponse?.data || [];

        // Find the message with matching fingerprint
        const foundMessage = messages.find(
          (m: any) =>
            m.fingerprint === fingerprint ||
            m.fingerprint?.toString() === fingerprint?.toString(),
        );

        if (foundMessage) {
          messageData = foundMessage;
          this.logger.debug(
            `Successfully found message ${fingerprint} in conversation messages`,
          );
        } else {
          this.logger.warn(
            `Message ${fingerprint} not found in conversation messages, using RTM event data`,
          );
          // Fallback to RTM event data
          messageData = msg;
          // Override 'from' field with author from RTM event
          messageData.from = author;
        }
      } catch (error) {
        this.logger.warn(
          `Error fetching messages from Crisp API:`,
          error.message,
        );
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

      // Upsert: update if exists, else insert
      let existing = await this.conversationMessageRepository.findOne({
        where: { fingerprint: messageEntity.fingerprint },
      });
      if (existing) {
        Object.assign(existing, messageEntity);
        await this.conversationMessageRepository.save(existing);
        this.logger.debug(`Updated message: ${fingerprint} for session ${sessionId}`);
      } else {
        const message = this.conversationMessageRepository.create(messageEntity);
        try {
          await this.conversationMessageRepository.save(message);
          this.logger.debug(`Synced ${author} message: ${fingerprint} for session ${sessionId}`);
        } catch (err: any) {
          if (err?.code === '23505') {
            existing = await this.conversationMessageRepository.findOne({
              where: { fingerprint: messageEntity.fingerprint },
            });
            if (existing) {
              Object.assign(existing, messageEntity);
              await this.conversationMessageRepository.save(existing);
              this.logger.debug(`Updated message (after race): ${fingerprint} for session ${sessionId}`);
            }
          } else {
            throw err;
          }
        }
      }
    } catch (error: any) {
      if (error?.code === '23505') {
        try {
          const fp = msg.fingerprint || msg.message_id;
          const existing = await this.conversationMessageRepository.findOne({
            where: { fingerprint: fp },
          });
          if (existing) {
            const messageEntity = this.transformMessageData(msg);
            if (!messageEntity.fingerprint) messageEntity.fingerprint = fp;
            if (!messageEntity.sessionId) messageEntity.sessionId = msg.session_id;
            if (!messageEntity.websiteId) messageEntity.websiteId = msg.website_id;
            if (!messageEntity.from) messageEntity.from = author;
            if (!messageEntity.timestamp) messageEntity.timestamp = Date.now();
            Object.assign(existing, messageEntity);
            await this.conversationMessageRepository.save(existing);
            this.logger.debug(`Updated message (catch 23505): ${fp} for session ${msg.session_id}`);
          }
        } catch (e) {
          this.logger.warn(`Failed to update message after 23505: ${e?.message ?? e}`);
        }
      } else {
        this.logger.error('Error syncing message:', error);
        throw error;
      }
    }
  }

  /**
   * Refresh (upsert) latest conversation details from Crisp API into DB.
   * Called on message events to keep conversation row updated (unread counts, last_message, preview, etc.).
   */
  private async refreshConversationDetails(
    sessionId: string,
    websiteId: string,
  ): Promise<void> {
    try {
      if (!sessionId || !websiteId) return;

      const conversationResponse =
        await this.crispClient.website.getConversation(websiteId, sessionId);

      // Handle API response structure (data may be nested in 'data' property)
      const conversationData =
        conversationResponse?.data || conversationResponse;

      if (!conversationData || conversationData.error) {
        this.logger.warn(
          `Failed to refresh conversation ${sessionId} from Crisp API: ${conversationData?.reason || 'Unknown error'}`,
        );
        return;
      }

      const conversationEntity =
        this.transformConversationData(conversationData);
      if (!conversationEntity.sessionId)
        conversationEntity.sessionId = sessionId;
      if (!conversationEntity.websiteId)
        conversationEntity.websiteId = websiteId;

      const existing = await this.conversationRepository.findOne({
        where: { sessionId },
      });
      if (existing) {
        Object.assign(existing, conversationEntity);
        await this.conversationRepository.save(existing);
      } else {
        const created = this.conversationRepository.create(conversationEntity);
        await this.conversationRepository.save(created);
      }

      this.logger.debug(
        `Refreshed conversation details for session ${sessionId}`,
      );
    } catch (error: any) {
      this.logger.warn(
        `Error refreshing conversation details for session ${sessionId}: ${error?.message || error}`,
      );
    }
  }

  /**
   * Transform API conversation data to entity format
   * Maps Crisp API response to Conversation entity fields
   */
  private transformConversationData(
    conversationData: any,
  ): Partial<Conversation> {
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
  private async ensureConversationExists(
    sessionId: string,
    websiteId: string,
  ): Promise<void> {
    const existing = await this.conversationRepository.findOne({
      where: { sessionId },
    });

    if (!existing) {
      this.logger.debug(
        `Conversation not found for session ${sessionId}, fetching from Crisp API`,
      );

      try {
        // Fetch full conversation details from Crisp API
        const conversationResponse =
          await this.crispClient.website.getConversation(websiteId, sessionId);

        // Handle API response structure (data may be nested in 'data' property)
        const conversationData =
          conversationResponse?.data || conversationResponse;

        if (!conversationData || conversationData.error) {
          this.logger.warn(
            `Failed to fetch conversation ${sessionId} from Crisp API: ${conversationData?.reason || 'Unknown error'}`,
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
          this.logger.debug(
            `Created fallback conversation for session ${sessionId}`,
          );
          return;
        }

        // Transform API response to entity format
        const conversationEntity =
          this.transformConversationData(conversationData);

        // Create and save conversation with full details
        const conversation =
          this.conversationRepository.create(conversationEntity);
        await this.conversationRepository.save(conversation);

        this.logger.log(
          `Fetched and saved full conversation details for session ${sessionId}`,
        );
      } catch (error) {
        this.logger.error(
          `Error fetching conversation ${sessionId} from Crisp API:`,
          error,
        );

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
        this.logger.debug(
          `Created fallback conversation for session ${sessionId} due to API error`,
        );
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
