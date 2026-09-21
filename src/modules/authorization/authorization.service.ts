import { ForbiddenException, Injectable } from '@nestjs/common';
import { User } from '../users/entities/user.entity.js';
import { can, type Capability } from '../../common/permissions/permission-matrix.js';

@Injectable()
export class AuthorizationService {
  /** Generic matrix check — §10.1 */
  assertCan(capability: Capability, role: string): void {
    if (!can(capability, role)) {
      throw new ForbiddenException(
        `Access restricted to roles: ${capability} → allowed ${role} not in matrix`,
      );
    }
  }

  /**
   * Site access — delegates to per-service verifySiteAccess which checks
   * SiteEngineerAssignment.isActive or contractor ownership.
   * Keep this stub for global use; services do the real DB check.
   */
  async assertSiteAccess(user: User, _siteId: string): Promise<void> {
    if (user.role === 'admin') return;
    if (user.role === 'site_engineer' || user.role === 'contractor') return; // service will verify
    throw new ForbiddenException('You do not have access to this site.');
  }
}
