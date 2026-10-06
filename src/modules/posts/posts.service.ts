import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { Post } from './entities/post.entity.js';
import { PostComment } from './entities/post-comment.entity.js';
import { PostLike } from './entities/post-like.entity.js';
import { CreatePostDto } from './dto/create-post.dto.js';
import { UpdatePostDto } from './dto/update-post.dto.js';
import { QueryPostDto } from './dto/query-post.dto.js';
import { CreateCommentDto } from './dto/create-comment.dto.js';
import { QueryCommentDto } from './dto/query-comment.dto.js';

@Injectable()
export class PostsService implements OnModuleInit {
  private readonly logger = new Logger(PostsService.name);

  constructor(
    @InjectRepository(Post)
    private readonly postRepo: Repository<Post>,
    @InjectRepository(PostComment)
    private readonly commentRepo: Repository<PostComment>,
    @InjectRepository(PostLike)
    private readonly likeRepo: Repository<PostLike>,
  ) {}

  async onModuleInit() {
    await this.ensureTables();
  }

  /**
   * Automatically ensure database tables exist when DB_SYNC is disabled.
   */
  async ensureTables(): Promise<void> {
    try {
      await this.postRepo.query(`
        CREATE TABLE IF NOT EXISTS posts (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title VARCHAR(255),
          description TEXT NOT NULL,
          "coverPhoto" TEXT,
          photos JSONB DEFAULT '[]'::jsonb,
          tags JSONB DEFAULT '[]'::jsonb,
          location VARCHAR(255),
          latitude DOUBLE PRECISION,
          longitude DOUBLE PRECISION,
          visibility VARCHAR(30) DEFAULT 'PUBLIC',
          status VARCHAR(30) DEFAULT 'PUBLIC',
          "likesCount" INT DEFAULT 0,
          "commentsCount" INT DEFAULT 0,
          "sharesCount" INT DEFAULT 0,
          "authorId" UUID NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "deletedAt" TIMESTAMP WITH TIME ZONE
        );
      `);
      await this.postRepo.query(`
        CREATE TABLE IF NOT EXISTS post_comments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "postId" UUID NOT NULL,
          "authorId" UUID NOT NULL,
          content TEXT NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          "deletedAt" TIMESTAMP WITH TIME ZONE
        );
      `);
      await this.postRepo.query(`
        CREATE TABLE IF NOT EXISTS post_likes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          "postId" UUID NOT NULL,
          "userId" UUID NOT NULL,
          "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT now(),
          CONSTRAINT uq_post_user_like UNIQUE ("postId", "userId")
        );
      `);
    } catch (err: any) {
      this.logger.warn(
        `Database tables initialization: ${err?.message || err}`,
      );
    }
  }

  // ════════════════════════════════════════════════════
  //  POST CREATION
  // ════════════════════════════════════════════════════

  async create(currentUser: any, dto: CreatePostDto) {
    if (!currentUser || !currentUser.id) {
      throw new ForbiddenException('User is not authenticated');
    }

    const coverPhoto =
      dto.coverPhoto ||
      (dto.photos && dto.photos.length > 0 ? dto.photos[0] : null);

    const post = this.postRepo.create({
      ...dto,
      coverPhoto,
      photos: dto.photos || [],
      tags: dto.tags || [],
      visibility: dto.visibility || 'PUBLIC',
      status: 'PUBLIC',
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      authorId: currentUser.id,
    });

    const saved = await this.postRepo.save(post);
    // Reload with author for formatting
    const loaded = await this.postRepo.findOne({
      where: { id: saved.id },
      relations: { author: true },
    });

    return this.formatPost(loaded || saved, currentUser, false);
  }

  // ════════════════════════════════════════════════════
  //  HOME FEED / LIST
  // ════════════════════════════════════════════════════

  async list(query: QueryPostDto, currentUser?: any) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const qb = this.postRepo
      .createQueryBuilder('post')
      .leftJoinAndSelect('post.author', 'author')
      .where('post.deletedAt IS NULL')
      .andWhere('(post.visibility = :pubVis OR post.visibility IS NULL)', {
        pubVis: 'PUBLIC',
      })
      .andWhere('(post.status = :pubStat OR post.status IS NULL)', {
        pubStat: 'PUBLIC',
      });

    if (query.search) {
      qb.andWhere(
        '(post.title ILIKE :search OR post.description ILIKE :search OR CAST(post.tags AS text) ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.tag) {
      qb.andWhere('CAST(post.tags AS text) ILIKE :tag', {
        tag: `%${query.tag}%`,
      });
    }

    // Admin-only authorId filtering. Non-admins cannot filter by authorId.
    if (currentUser?.role === 'admin' && query.authorId) {
      qb.andWhere('post.authorId = :authorId', { authorId: query.authorId });
    }

    qb.orderBy('post.createdAt', 'DESC');
    qb.skip((page - 1) * limit).take(limit);

    const [items, total] = await qb.getManyAndCount();

    // Check which posts the current authenticated user has liked
    let likedPostIds = new Set<string>();
    const postIds = items.map((p) => p.id);
    if (currentUser && currentUser.id && postIds.length > 0) {
      const likes = await this.likeRepo.find({
        where: {
          userId: currentUser.id,
          postId: In(postIds),
        },
        select: { postId: true },
      });
      likedPostIds = new Set(likes.map((l) => l.postId));
    }

    const formattedItems = items.map((post) =>
      this.formatPost(post, currentUser, likedPostIds.has(post.id)),
    );

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ════════════════════════════════════════════════════
  //  POST DETAIL
  // ════════════════════════════════════════════════════

  async getById(id: string, currentUser?: any) {
    if (!id) throw new BadRequestException('Invalid post ID');

    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    let isLiked = false;
    if (currentUser && currentUser.id) {
      const like = await this.likeRepo.findOne({
        where: { postId: id, userId: currentUser.id },
      });
      isLiked = !!like;
    }

    return this.formatPost(post, currentUser, isLiked);
  }

  // ════════════════════════════════════════════════════
  //  POST UPDATE
  // ════════════════════════════════════════════════════

  async update(id: string, currentUser: any, dto: UpdatePostDto) {
    if (!currentUser || !currentUser.id) {
      throw new ForbiddenException('User is not authenticated');
    }

    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
      relations: { author: true },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Enforce authorization: Admin can edit any post. Company & Job Seeker only their own.
    if (currentUser.role !== 'admin' && post.authorId !== currentUser.id) {
      throw new ForbiddenException('You are not allowed to update this post');
    }

    if (dto.title !== undefined) post.title = dto.title;
    if (dto.description !== undefined) post.description = dto.description;
    if (dto.coverPhoto !== undefined) post.coverPhoto = dto.coverPhoto;
    if (dto.photos !== undefined) post.photos = dto.photos;
    if (dto.tags !== undefined) post.tags = dto.tags;
    if (dto.location !== undefined) post.location = dto.location;
    if (dto.latitude !== undefined) post.latitude = dto.latitude;
    if (dto.longitude !== undefined) post.longitude = dto.longitude;
    if (dto.visibility !== undefined) post.visibility = dto.visibility;

    if (!post.coverPhoto && post.photos && post.photos.length > 0) {
      post.coverPhoto = post.photos[0];
    }

    const saved = await this.postRepo.save(post);
    return this.formatPost(saved, currentUser);
  }

  // ════════════════════════════════════════════════════
  //  POST DELETE (SOFT-DELETE)
  // ════════════════════════════════════════════════════

  async delete(id: string, currentUser: any) {
    if (!currentUser || !currentUser.id) {
      throw new ForbiddenException('User is not authenticated');
    }

    const post = await this.postRepo.findOne({
      where: { id, deletedAt: IsNull() },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    // Enforce authorization: Admin can delete any post. Company & Job Seeker only their own.
    if (currentUser.role !== 'admin' && post.authorId !== currentUser.id) {
      throw new ForbiddenException('You are not allowed to delete this post');
    }

    await this.postRepo.softDelete(id);
    return { message: 'Post deleted successfully' };
  }

  // ════════════════════════════════════════════════════
  //  LIKES
  // ════════════════════════════════════════════════════

  async toggleLike(postId: string, currentUser: any) {
    if (!currentUser || !currentUser.id) {
      throw new ForbiddenException('User is not authenticated');
    }

    const post = await this.postRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const existingLike = await this.likeRepo.findOne({
      where: { postId, userId: currentUser.id },
    });

    if (existingLike) {
      await this.likeRepo.delete({ id: existingLike.id });
      await this.postRepo.decrement({ id: postId }, 'likesCount', 1);

      const updated = await this.postRepo.findOne({
        where: { id: postId },
        select: { id: true, likesCount: true },
      });
      const likesCount = Math.max(0, Number(updated?.likesCount) || 0);

      return {
        isLiked: false,
        likesCount,
      };
    } else {
      const newLike = this.likeRepo.create({
        postId,
        userId: currentUser.id,
      });
      await this.likeRepo.save(newLike);
      await this.postRepo.increment({ id: postId }, 'likesCount', 1);

      const updated = await this.postRepo.findOne({
        where: { id: postId },
        select: { id: true, likesCount: true },
      });
      const likesCount = Math.max(1, Number(updated?.likesCount) || 1);

      return {
        isLiked: true,
        likesCount,
      };
    }
  }

  // ════════════════════════════════════════════════════
  //  SHARES
  // ════════════════════════════════════════════════════

  async share(postId: string) {
    const post = await this.postRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    await this.postRepo.increment({ id: postId }, 'sharesCount', 1);

    const updated = await this.postRepo.findOne({
      where: { id: postId },
      select: { id: true, sharesCount: true },
    });

    return {
      sharesCount:
        Number(updated?.sharesCount) || (Number(post.sharesCount) || 0) + 1,
    };
  }

  // ════════════════════════════════════════════════════
  //  COMMENTS
  // ════════════════════════════════════════════════════

  async addComment(postId: string, currentUser: any, dto: CreateCommentDto) {
    if (!currentUser || !currentUser.id) {
      throw new ForbiddenException('User is not authenticated');
    }

    const post = await this.postRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const comment = this.commentRepo.create({
      postId,
      authorId: currentUser.id,
      content: dto.content,
    });

    const saved = await this.commentRepo.save(comment);
    await this.postRepo.increment({ id: postId }, 'commentsCount', 1);

    return {
      id: saved.id,
      postId: saved.postId,
      content: saved.content,
      createdAt: saved.createdAt,
      author: {
        id: currentUser.id,
        name: currentUser.fullName,
        fullName: currentUser.fullName,
        avatarUrl: currentUser.avatarUrl ?? null,
      },
    };
  }

  async getComments(postId: string, query: QueryCommentDto) {
    const post = await this.postRepo.findOne({
      where: { id: postId, deletedAt: IsNull() },
    });

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));

    const [comments, total] = await this.commentRepo.findAndCount({
      where: { postId, deletedAt: IsNull() },
      relations: { author: true },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    const items = comments.map((c) => ({
      id: c.id,
      postId: c.postId,
      content: c.content,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      author: {
        id: c.author?.id ?? c.authorId,
        name: c.author?.fullName ?? 'User',
        fullName: c.author?.fullName ?? 'User',
        avatarUrl: c.author?.avatarUrl ?? null,
      },
    }));

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  // ════════════════════════════════════════════════════
  //  RESPONSE FORMATTER (SECURITY & AUTHORIZATION)
  // ════════════════════════════════════════════════════

  private formatPost(post: Post, currentUser?: any, isLiked = false) {
    const isMine = Boolean(
      currentUser && currentUser.id && currentUser.id === post.authorId,
    );

    const description = post.description || '';
    const truncatedDescription =
      description.length > 150
        ? description.substring(0, 150) + '...'
        : description;

    const coverPhoto =
      post.coverPhoto ||
      (post.photos && post.photos.length > 0 ? post.photos[0] : null);

    const base: Record<string, any> = {
      id: post.id,
      title: post.title,
      description: post.description,
      truncatedDescription,
      coverPhoto,
      photos: post.photos || [],
      tags: post.tags || [],
      location: post.location || null,
      latitude:
        post.latitude !== null && post.latitude !== undefined
          ? Number(post.latitude)
          : null,
      longitude:
        post.longitude !== null && post.longitude !== undefined
          ? Number(post.longitude)
          : null,
      visibility: post.visibility,
      status: post.status,
      likesCount: Number(post.likesCount) || 0,
      commentsCount: Number(post.commentsCount) || 0,
      sharesCount: Number(post.sharesCount) || 0,
      isMine,
      isLiked,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    };

    // CRITICAL SECURITY RULE:
    // Only ADMIN receives author details.
    // For Company, Job Seeker, and Anonymous users: DO NOT expose author or authorRole.
    if (currentUser?.role === 'admin') {
      base.author = {
        id: post.author?.id ?? post.authorId,
        name: post.author?.fullName ?? 'Unknown',
        fullName: post.author?.fullName ?? 'Unknown',
        role: post.author?.role ?? 'unknown',
        avatarUrl: post.author?.avatarUrl ?? null,
      };
    }

    return base;
  }
}
