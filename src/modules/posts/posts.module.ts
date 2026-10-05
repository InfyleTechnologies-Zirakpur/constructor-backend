import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PassportModule } from '@nestjs/passport';
import { Post } from './entities/post.entity.js';
import { PostComment } from './entities/post-comment.entity.js';
import { PostLike } from './entities/post-like.entity.js';
import { PostsService } from './posts.service.js';
import { PostsController } from './posts.controller.js';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    TypeOrmModule.forFeature([Post, PostComment, PostLike]),
  ],
  controllers: [PostsController],
  providers: [PostsService],
  exports: [PostsService],
})
export class PostsModule {}
