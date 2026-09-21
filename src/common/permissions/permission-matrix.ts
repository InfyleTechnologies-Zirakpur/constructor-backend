// §10.1 Example permission matrix — §2.1 roles, §10 RBAC
// Capability → allowed roles. Site isolation (assigned scope) is checked in service via verifySiteAccess.

export type Capability =
  | 'manageUsers'
  | 'createProject'
  | 'createSite'
  | 'enterDailyData'
  | 'submitDailyReport'
  | 'viewProfitability'
  | 'createJob'
  | 'applyJob'
  | 'manageCalculators';

export const PermissionMatrix: Record<Capability, readonly string[]> = {
  manageUsers: ['admin'],
  createProject: ['admin', 'contractor'],
  createSite: ['admin', 'contractor'],
  enterDailyData: ['admin', 'contractor', 'site_engineer'], // must be assigned site — service checks
  submitDailyReport: ['admin', 'contractor', 'site_engineer'], // same
  viewProfitability: ['admin', 'contractor'], // site_engineer → assigned scope only (service)
  createJob: ['admin', 'company'],
  applyJob: ['job_seeker'],
  manageCalculators: ['admin'],
} as const;

export function can(capability: Capability, role: string): boolean {
  return (PermissionMatrix[capability] as readonly string[]).includes(role);
}

export function assertCan(capability: Capability, role: string): void {
  if (!can(capability, role)) {
    // Keep message same as RolesGuard for consistency
    throw new Error(`Access restricted to roles: ${PermissionMatrix[capability].join(', ')}`);
  }
}
