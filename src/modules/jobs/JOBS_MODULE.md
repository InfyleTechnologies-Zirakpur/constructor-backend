# Jobs Module

## Overview
The Jobs module handles job postings created by **Companies**. Job Seekers browse these jobs to submit applications. The module enforces strict company isolation and supports admin moderation.

## Key Features
- **Job Posting**: Companies can create jobs (saved as `draft` by default). They can define title, location, skills, description, compensation, and workforce requirements.
- **Publishing & Closing**: Companies can transition their jobs to `published` (to make them visible to seekers) or `closed` via dedicated endpoints.
- **Moderation**: Admins have centralized control over all jobs and can use the moderation endpoint to `reject` or alter the status of a job, optionally leaving `moderationRemarks`.
- **Role-Based Visibility**: 
  - Admins see all jobs.
  - Companies see only jobs they created.
  - Job Seekers see only `published` jobs.

## Entity: `Job`

| Column | Type | Description |
|---|---|---|
| `id` | UUID (PK) | Auto-generated primary key |
| `title` | string | Job title |
| `location` | string | Job location |
| `skills` | simple-array | Array of string skill names |
| `description` | text | Job description |
| `compensation` | decimal | Offered compensation |
| `workforceRequired`| int | Number of workers needed |
| `status` | varchar | `draft`, `published`, `closed`, `rejected` |
| `moderationRemarks`| text (opt) | Admin remarks when moderating |
| `companyId` | UUID (FK) | Reference to the `Company` profile |

## Endpoints

| Method | Route | Roles | Description |
|---|---|---|---|
| POST | `/jobs` | `company` | Create a job posting |
| GET | `/jobs` | `admin`, `company`, `job_seeker` | List jobs (visibility filtered by role) |
| GET | `/jobs/:id` | `admin`, `company`, `job_seeker` | View a job (visibility filtered by role) |
| PATCH | `/jobs/:id` | `company` | Edit a job (must own) |
| POST | `/jobs/:id/close` | `company` | Close a job (must own) |
| PATCH | `/jobs/:id/moderate` | `admin` | Admin moderation endpoint |
