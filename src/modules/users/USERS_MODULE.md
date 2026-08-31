# Users Module

## Overview
Manages user profiles and account lifecycle. The User entity is kept **lean** (auth + basic info only). Role-specific profile data (company details, contractor details, etc.) lives in their respective modules (`companies`, `contractors`, `site-engineers`).

**Design Decision**: One user = one role. A person who needs both Company and Contractor access would have two separate accounts. This keeps the architecture clean for the MVP.

## File Structure
```
src/modules/users/
├── users.controller.ts         # Route definitions for /api/v1/users/*
├── users.module.ts             # Module registration (TypeORM, exports UsersService)
├── users.service.ts            # User CRUD, profile updates, admin management
├── dto/
│   ├── create-users.dto.ts     # Validation for admin user creation
│   └── update-users.dto.ts     # UpdateUserDto (self) + AdminUpdateUserDto (admin)
├── entities/
│   └── user.entity.ts          # TypeORM entity (lean: auth fields + avatarUrl)
└── tests/
    └── users.spec.ts           # Unit tests

bruno/Users/
├── List All Users.bru          # GET /users (Admin)
├── Get User By ID.bru          # GET /users/:id (Admin)
├── Get My Profile.bru          # GET /users/profile (Any authenticated user)
├── Update My Profile.bru       # PATCH /users/profile (Any authenticated user)
├── Create User.bru             # POST /users (Admin)
├── Admin Update User.bru       # PATCH /users/:id (Admin)
└── Deactivate User.bru         # DELETE /users/:id (Admin)
```

## API Endpoints

| Method | Route                   | Auth       | Description                             |
|--------|-------------------------|------------|-----------------------------------------|
| GET    | `/api/v1/users`         | JWT+Admin  | List all users with pagination & filter |
| GET    | `/api/v1/users/profile` | JWT        | Get your own profile                    |
| PATCH  | `/api/v1/users/profile` | JWT        | Update your own profile                 |
| GET    | `/api/v1/users/:id`     | JWT+Admin  | Get any user by UUID                    |
| POST   | `/api/v1/users`         | JWT+Admin  | Create a new user (admin only)          |
| PATCH  | `/api/v1/users/:id`     | JWT+Admin  | Update any user's role/status           |
| DELETE | `/api/v1/users/:id`     | JWT+Admin  | Deactivate a user (soft delete)         |

## API Flow

```mermaid
flowchart TD
    A[Client Request] --> B{Is Authenticated?}
    B -- No --> C[401 Unauthorized]
    B -- Yes --> D{Route Type?}

    D -- "/users/profile" --> E[Self Profile Routes]
    E --> E1[GET: Return own user data]
    E --> E2[PATCH: Update own name/phone/avatar]

    D -- "/users" or "/users/:id" --> F{Is Admin?}
    F -- No --> G[403 Forbidden]
    F -- Yes --> H[Admin Routes]
    H --> H1[GET: List users with pagination]
    H --> H2[GET :id: View any user]
    H --> H3[POST: Create new user]
    H --> H4[PATCH :id: Change role/status]
    H --> H5[DELETE :id: Deactivate user]
```

## Key Design Decisions
- **Lean User Entity**: The `User` table only stores auth-related data (email, password hash, role, OTP, tokens) plus basic profile (fullName, phone, avatarUrl). Rich profile data (skills, experience, company docs) belongs in role-specific modules.
- **Sanitization**: All responses strip `passwordHash`, `otpHash`, `otpExpiresAt`, and `refreshTokenHash` via a private `sanitize()` method.
- **Soft Delete**: The `DELETE` endpoint does not remove the user from the database. It sets `isActive = false` and invalidates their refresh token.
- **Self-Protection**: An admin cannot deactivate their own account (prevents accidental lockout).
- **Pagination**: `GET /users` supports `?page=1&limit=20&role=contractor` query params.

## User Entity Fields
| Field            | Type      | Description                              |
|------------------|-----------|------------------------------------------|
| id               | UUID      | Auto-generated primary key               |
| fullName         | string    | User's display name                      |
| email            | string    | Unique login identifier                  |
| phone            | string?   | Optional phone number                    |
| passwordHash     | string    | bcrypt hashed password (never exposed)   |
| role             | string    | One of: admin, job_seeker, company, contractor, site_engineer |
| isActive         | boolean   | Account status (default: true)           |
| avatarUrl        | string?   | Profile photo URL (S3 link when Documents module is ready) |
| otpHash          | string?   | Hashed OTP for password reset            |
| otpExpiresAt     | timestamp?| OTP expiration time                      |
| refreshTokenHash | string?   | Hashed refresh token for session mgmt    |
| createdAt        | timestamp | Auto-generated creation timestamp        |
| updatedAt        | timestamp | Auto-generated update timestamp          |
