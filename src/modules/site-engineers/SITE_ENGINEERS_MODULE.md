# Site Engineers Module

## Overview
The Site Engineers module provides dedicated profile management and listing for users with the `site_engineer` role. Site Engineers are the operational data-entry role on construction sites.

According to the Technical Brief, access is heavily constrained by **assignments** (handled in the `ProjectSites` module via `SiteEngineerAssignment`). 

## Key Features
- **Account Creation**: Contractors and Admins can create new Site Engineer accounts directly.
- **Contractor Isolation**: When a Contractor lists Site Engineers or views a profile, they can *only* see engineers that have been assigned to at least one of their Project Sites.
- **Engineer Self-Service**: Site Engineers can view their own profile and all active site assignments.

## Entity: `User` (Role = `site_engineer`)
Site engineers do not have a dedicated entity table; they use the central `User` table but are identified by `role: 'site_engineer'`. Their connection to projects is managed via `SiteEngineerAssignment`.

## Endpoints

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/site-engineers` | `contractor`, `admin` | Create a new Site Engineer account |
| GET | `/site-engineers` | `contractor`, `admin` | List site engineers (Contractors only see their assigned engineers) |
| GET | `/site-engineers/my-profile` | `site_engineer` | Site Engineer gets their profile + active site assignments |
| GET | `/site-engineers/:id` | `contractor`, `admin` | View specific engineer profile (Contractors must have an assignment link) |

## Related Modules
- **Project Sites Module**: Handles the actual assignment logic (`POST /sites/:siteId/assign-engineer`).
- **Users Module**: Handles the underlying base entity.
