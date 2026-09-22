import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ConversationsService } from './conversations.service.js';
import { CreateMessageDto } from './dto/create-conversation.dto.js';

@Controller('conversations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ConversationsController {
  constructor(private readonly conversationsService: ConversationsService) {}

  /**
   * GET /conversations — List conversations for current user.
   */
  @Get()
  @Roles('admin', 'company', 'job_seeker')
  async list(@Req() req: any) {
    return this.conversationsService.listForUser(req.user.id, req.user.role);
  }

  /**
   * GET /conversations/:id — Get single conversation.
   */
  @Get(':id')
  @Roles('admin', 'company', 'job_seeker')
  async getOne(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.getById(id, req.user.id, req.user.role);
  }

  /**
   * GET /conversations/:id/messages — List messages in a conversation.
   */
  @Get(':id/messages')
  @Roles('admin', 'company', 'job_seeker')
  async listMessages(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.listMessages(id, req.user.id, req.user.role);
  }

  /**
   * POST /conversations/:id/messages — Send a message.
   */
  @Post(':id/messages')
  @Roles('admin', 'company', 'job_seeker')
  async sendMessage(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
  ) {
    return this.conversationsService.sendMessage(id, req.user.id, dto.text);
  }

  /**
   * PATCH /conversations/:id/read — Mark messages as read.
   */
  @Patch(':id/read')
  @Roles('admin', 'company', 'job_seeker')
  async markRead(@Req() req: any, @Param('id') id: string) {
    return this.conversationsService.markRead(id, req.user.id, req.user.role);
  }
}