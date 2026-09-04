# Projects Module

## Overview
The Projects module manages the master data for construction projects. Per the Technical Brief (Scenario B), a **Contractor creates a project** and assigns sites to it. A project has a budget, contract value, duration, location, and dates.

This module enforces **Contractor Isolation**: a contractor can only view, update, and manage their own projects. Admins have global access.

## Key Features
- **Project Creation**: Contractors can create projects. The service automatically resolves the user's contractor profile and links the project to it.
- **Contractor Isolation**: `ProjectsService` verifies ownership (`contractorId`) before allowing a contractor to view or update a project.
- **Project Relationships**: A `Project` belongs to a `Contractor` (ManyToOne) and contains one or more `ProjectSite`s (OneToMany).
- **Status Transitions**: Projects can move between `draft`, `active`, `completed`, and `archived`.

## Entity: `Project`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated primary key |
| `name` | string | Project name (e.g., Skyline Tower) |
| `description` | text (optional) | Project scope/description |
| `location` | string | Geographic location or address |
| `durationDays` | int | Estimated duration in days |
| `startDate` | date (optional) | Project start date |
| `endDate` | date (optional) | Project completion date |
| `budget` | decimal(14,2) | Planned budget for the project |
| `contractValue`| decimal(14,2) | Total contract value |
| `status` | varchar(20) | `draft` / `active` / `completed` / `archived` |
| `contractorId` | UUID (FK) | Reference to `Contractor` profile |
| `sites` | ProjectSite[] | OneToMany relation to project sites |
| `createdAt` | timestamp | Auto-generated |
| `updatedAt` | timestamp | Auto-updated |

## Endpoints

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/projects` | `contractor`, `admin` | Create a new project |
| GET | `/projects/my-projects` | `contractor` | List projects owned by the contractor |
| PATCH | `/projects/:id` | `contractor`, `admin` | Update a project (must own if contractor) |
| GET | `/projects` | `admin` | List all projects (paginated) |
| GET | `/projects/:id` | `contractor`, `admin` | View a specific project |

## Workflow Example (Scenario B)
1. **Contractor logs in.**
2. Calls `POST /projects` with name, location, and budget.
3. Backend looks up their `Contractor` profile using their JWT `userId`.
4. Project is created and linked to `contractorId`.
5. Contractor calls `POST /projects/:id/sites` (handled by `ProjectSitesModule`) to add sites.
6. Contractor assigns a Site Engineer to the site.
