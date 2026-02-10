import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrispController } from './controllers/crisp.controller';
import { CrispDbController } from './controllers/crisp-db.controller';
import { CrispService } from './services/crisp.service';
import { CrispRtmService } from './services/crisp-rtm.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';
import { CompletedConversation } from './entities/completed-conversation.entity';
import { CompletedConversationSummary } from './entities/completed-conversation-summary.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Conversation,
      ConversationMessage,
      CompletedConversation,
      CompletedConversationSummary,
    ]),
  ],
  controllers: [CrispController, CrispDbController],
  providers: [CrispService, CrispRtmService],
  exports: [CrispService],
})
export class CrispModule {}
