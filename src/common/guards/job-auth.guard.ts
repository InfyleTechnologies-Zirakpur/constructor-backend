import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JobAuthGuard extends AuthGuard('jwt') {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const url = req.url || req.path || '';
    // Allow public access to /counts and /stats when no authorization header is provided
    if (url.includes('/counts') || url.includes('/stats')) {
      if (!req.headers?.authorization) {
        return true;
      }
    }
    return super.canActivate(context);
  }

  handleRequest<TUser = any>(
    err: any,
    user: any,
    _info: any,
    context: ExecutionContext,
  ): TUser {
    const req = context.switchToHttp().getRequest();
    const url = req.url || req.path || '';
    if (url.includes('/counts') || url.includes('/stats')) {
      return (user || null) as TUser;
    }
    if (err || !user) {
      throw err || new UnauthorizedException('Unauthorized');
    }
    return user as TUser;
  }
}
