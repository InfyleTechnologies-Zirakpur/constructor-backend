import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
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
import { OptionalJwtAuthGuard } from '../../common/guards/optional-jwt-auth.guard.js';
import { PostsService } from './posts.service.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { QueryPostDto } from './dto/query-post.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { QueryCommentDto } from './dto/query-comment.dto.js';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  /**
   * POST /posts — Create a new post.
   * Allowed roles: admin, job_seeker, company.
   */
  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'job_seeker', 'company')
  async create(@Req() req: any, @Body() dto: CreatePostDto) {
    const post = await this.postsService.create(req.user, dto);
    return post;
  }

  /**
   * GET /posts — Public Home Feed with optional JWT authentication.
   * Public users, Job Seekers, Companies, and Admins can access this endpoint.
   * Admin receives author information. Non-admin users do not receive author info.
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  async list(@Req() req: any, @Query() query: QueryPostDto) {
    return this.postsService.list(query, req.user);
  }

  /**
   * GET /posts/:id — Post detail with optional JWT authentication.
   * Full details, media, tags, engagement stats, isMine, isLiked.
   */
  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  async getById(@Req() req: any, @Param('id') id: string) {
    return this.postsService.getById(id, req.user);
  }

  /**
   * PATCH /posts/:id — Update a post.
   * Admin can edit any post. Job Seekers & Companies can edit only their own.
   */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'job_seeker', 'company')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: UpdatePostDto,
  ) {
    return this.postsService.update(id, req.user, dto);
  }

  /**
   * DELETE /posts/:id — Soft-delete a post.
   * Admin can delete any post. Job Seekers & Companies can delete only their own.
   */
  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'job_seeker', 'company')
  async delete(@Req() req: any, @Param('id') id: string) {
    return this.postsService.delete(id, req.user);
  }

  /**
   * POST /posts/:id/like — Toggle like on a post.
   * Authenticated Job Seekers, Companies, and Admins can like/unlike.
   * Prevents duplicate likes; returns { isLiked, likesCount }.
   */
  @Post(':id/like')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'job_seeker', 'company')
  async toggleLike(@Req() req: any, @Param('id') id: string) {
    return this.postsService.toggleLike(id, req.user);
  }

  /**
   * POST /posts/:id/share — Share a post.
   * Public or authenticated users can share. Atomically increments sharesCount.
   */
  @Post(':id/share')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  async share(@Param('id') id: string) {
    return this.postsService.share(id);
  }

  /**
   * POST /posts/:id/comments — Add a comment to a post.
   * Authenticated Job Seekers, Companies, and Admins can comment.
   * Atomically increments commentsCount on the post.
   */
  @Post(':id/comments')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('admin', 'job_seeker', 'company')
  async addComment(
    @Req() req: any,
    @Param('id') id: string,
    @Body() dto: CreateCommentDto,
  ) {
    return this.postsService.addComment(id, req.user, dto);
  }

  /**
   * GET /posts/:id/comments — List paginated comments for a post.
   * Public or authenticated users can view comments.
   */
  @Get(':id/comments')
  @UseGuards(OptionalJwtAuthGuard)
  async getComments(@Param('id') id: string, @Query() query: QueryCommentDto) {
    return this.postsService.getComments(id, query);
  }
}
