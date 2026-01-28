import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CrispController } from './controllers/crisp.controller';
import { CrispDbController } from './controllers/crisp-db.controller';
import { CrispService } from './services/crisp.service';
import { CrispRtmService } from './services/crisp-rtm.service';
import { Conversation } from './entities/conversation.entity';
import { ConversationMessage } from './entities/conversation-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Conversation, ConversationMessage]),
  ],
  controllers: [CrispController, CrispDbController],
  providers: [CrispService, CrispRtmService],
  exports: [CrispService],
})
export class CrispModule {}

