import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate limiting controlled by env:
 *
 *   RATE_LIMIT_ENABLED=false  → always off (dev default)
 *   RATE_LIMIT_ENABLED=true   → always on
 *   (unset)                   → on in production, off everywhere else
 */
export function isRateLimitEnabled(): boolean {
  const flag = process.env.RATE_LIMIT_ENABLED?.toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'off') return false;
  if (flag === 'true' || flag === '1' || flag === 'on') return true;
  return process.env.NODE_ENV === 'production';
}

@Injectable()
export class RateLimitGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!isRateLimitEnabled()) return true;
    return super.canActivate(context);
  }
}
