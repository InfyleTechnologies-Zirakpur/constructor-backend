# Companies Module

## Overview
The Companies module is responsible for managing Company profiles, their contact details, and their verification status. In the RBAC model, a User with the `company` role owns a Company profile. A Company is the entity that publishes Jobs and reviews Job Seeker applications.

## Key Features
- **Company Profile Creation**: Authorized users (`company` or `admin`) can create new company profiles containing contact and physical address details.
- **Verification Workflow**: Every new company is created with a `pending` verification status. It is the responsibility of an `admin` to review the uploaded documents and change the status to `verified` or `rejected`.
- **Document Storage**: `documentUrls` stores links (e.g., AWS S3 URLs) to verification documents like tax IDs, business licenses, etc.

## Endpoints

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/api/v1/companies` | `company`, `admin` | Register a new company profile |
| GET | `/api/v1/companies/my-profiles` | `company` | Retrieve companies owned by the current user |
| PATCH| `/api/v1/companies/:id` | `company`, `admin` | Update company profile details |
| GET | `/api/v1/companies` | `admin` | List all companies (paginated, filterable by status) |
| GET | `/api/v1/companies/:id` | `admin` | View a specific company |
| PATCH| `/api/v1/companies/:id/verify` | `admin` | Update verification status and remarks |

## Entities

### `Company`
- `id` (UUID)
- `name` (String)
- `registrationNumber` (String, Optional)
- `contactEmail` (String)
- `contactPhone` (String)
- `address` (Text, Optional)
- `verificationStatus` (Enum: `pending`, `verified`, `rejected`) - Default: `pending`
- `verificationRemarks` (Text, Optional) - Admin notes regarding verification
- `documentUrls` (String[]) - Array of document URLs
- `user` (ManyToOne -> User) - Owner of the company profile

## Workflow Example
1. A user logs in and calls `POST /companies` with their details and document URLs.
2. The system creates the company with `verificationStatus = 'pending'`.
3. An admin calls `GET /companies?status=pending` to see companies awaiting review.
4. The admin reviews the documents offline or via the panel, then calls `PATCH /companies/:id/verify` with `{ "verificationStatus": "verified" }`.
5. The company is now active and authorized to post jobs.
