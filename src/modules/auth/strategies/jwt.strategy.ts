import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../users/entities/user.entity.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User) private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET') ?? 'fallback-secret',
    });
  }

  async validate(payload: any) {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive || (user as any).isBlocked) {
      throw new UnauthorizedException('Account blocked or inactive');
    }
    if ((user as any).lockoutUntil && new Date() < (user as any).lockoutUntil) {
      throw new UnauthorizedException('Account locked');
    }
    if (payload.ver !== undefined && payload.ver !== (user as any).tokenVersion) {
      throw new UnauthorizedException('Session expired — logged in elsewhere');
    }
    // Omit sensitive fields
    const {
      passwordHash: _,
      otpHash: __,
      refreshTokenHash: ___,
      ...result
    } = user as any;
    // Attach payload claims for convenience
    return {
      ...result,
      _jwt: {
        sub: payload.sub,
        email: payload.email,
        phone: payload.phone,
        role: payload.role,
        employeeId: payload.employeeId ?? null,
        policy: payload.policy ?? null,
        verified: payload.verified,
        blocked: payload.blocked,
        ver: payload.ver,
      },
    };
  }
}
