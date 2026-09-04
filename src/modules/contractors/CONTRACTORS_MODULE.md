# Contractors Module

## Overview
The Contractors module manages **Contractor profiles**, their verification workflow, and document storage. In the platform architecture, a Contractor is the entity that **owns and manages Projects**. They operate through the Contractor ERP Android App alongside Site Engineers who are assigned to specific project sites.

Per the RBAC matrix:
- **Contractor** can: Create projects, create sites, enter daily site data, submit daily reports, view project profitability.
- **Admin** can: Manage all contractors, verify/reject profiles, view all data.

## Key Features
- **Contractor Registration**: Users with the `contractor` role can create a profile with company info, contact details, and upload verification documents (S3 URLs).
- **Verification Workflow**: New contractors start as `pending`. An admin reviews documents and transitions them to `verified` or `rejected` with optional remarks.
- **Ownership Enforcement**: A contractor can only update their own profile. The service layer validates `userId` ownership before any mutation.
- **Admin Management**: Admins can list all contractors with pagination and filter by verification status.

## Entity: `Contractor`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated primary key |
| `companyName` | string | Construction company/firm name |
| `registrationNumber` | string (optional) | GST / Business registration number |
| `contactEmail` | string | Primary contact email |
| `contactPhone` | string | Primary contact phone |
| `address` | text (optional) | Physical address |
| `description` | text (optional) | Brief description of the firm |
| `verificationStatus` | varchar(20) | `pending` / `verified` / `rejected` |
| `verificationRemarks` | text (optional) | Admin notes on verification decision |
| `documentUrls` | jsonb | Array of S3 document URLs |
| `userId` | UUID (FK → User) | Owner of this contractor profile |
| `createdAt` | timestamp | Auto-generated |
| `updatedAt` | timestamp | Auto-updated |

## Endpoints

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/contractors` | `contractor`, `admin` | Register a new contractor profile |
| GET | `/contractors/my-profile` | `contractor` | Get own contractor profile(s) |
| PATCH | `/contractors/:id` | `contractor`, `admin` | Update own contractor profile |
| GET | `/contractors` | `admin` | List all contractors (paginated, filterable by status) |
| GET | `/contractors/:id` | `admin` | View a specific contractor |
| PATCH | `/contractors/:id/verify` | `admin` | Approve or reject a contractor |

## API Flow

### Contractor Registration & Verification
```
Contractor registers → POST /contractors (status: pending)
       ↓
Admin reviews → GET /contractors?status=pending
       ↓
Admin verifies → PATCH /contractors/:id/verify { status: "verified" }
       ↓
Contractor can now create Projects & Sites
```

### Contractor Self-Service
```
Contractor logs in → GET /contractors/my-profile
       ↓
Updates profile → PATCH /contractors/:id { companyName: "..." }
       ↓
Uploads new documents → PATCH /contractors/:id { documentUrls: [...] }
```

## File Structure
```
src/modules/contractors/
├── contractors.controller.ts   # HTTP routes with RBAC guards
├── contractors.module.ts       # NestJS module with TypeORM
├── contractors.service.ts      # Business logic & ownership checks
├── dto/
│   ├── create-contractors.dto.ts   # Validation for registration
│   └── update-contractors.dto.ts   # Partial update + admin verify DTO
├── entities/
│   └── contractor.entity.ts    # TypeORM entity
├── tests/
│   └── contractors.spec.ts     # Unit tests
└── CONTRACTORS_MODULE.md       # This file
```

## Relationship to Other Modules
- **Users**: A `Contractor` profile belongs to a `User` (ManyToOne).
- **Projects**: A `Contractor` owns/manages multiple `Projects` (future: OneToMany).
- **Site Engineers**: Assigned to contractor's project sites (future: via `SiteEngineerAssignment`).
