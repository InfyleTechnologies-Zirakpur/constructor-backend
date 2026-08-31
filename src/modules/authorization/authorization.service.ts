import { Injectable, ForbiddenException } from '@nestjs/common';
import { User } from '../users/entities/user.entity.js';

@Injectable()
export class AuthorizationService {
  /**
   * Complex RBAC and Ownership rules will go here.
   * e.g., Checking if a Site Engineer is assigned to a specific Site ID.
   */

  async assertSiteAccess(user: User, _siteId: string): Promise<void> {
    if (user.role === 'admin') return;

    if (user.role === 'site_engineer') {
      // TODO: Query the database to check if this user is assigned to this siteId
      // const isAssigned = await this.projectSitesService.isEngineerAssigned(user.id, siteId);
      // if (!isAssigned) throw new ForbiddenException('You are not assigned to this site.');
      throw new ForbiddenException(
        'Site assignment verification not yet implemented.',
      );
    }

    if (user.role === 'contractor') {
      // TODO: Query the database to check if this contractor owns the project this site belongs to
      // const ownsProject = await this.projectsService.isOwnedByContractor(user.id, siteId);
      // if (!ownsProject) throw new ForbiddenException('You do not own this site.');
      throw new ForbiddenException(
        'Contractor ownership verification not yet implemented.',
      );
    }

    throw new ForbiddenException('You do not have access to this site.');
  }
}
