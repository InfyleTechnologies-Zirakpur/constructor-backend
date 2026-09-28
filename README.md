# INFYLE Construction Platform (Backend)

Welcome to the backend repository for the INFYLE Construction Platform! This project is a Modular Monolith built with **NestJS**, **TypeScript**, **PostgreSQL** (via TypeORM), and **Redis**.

It serves as the core backend infrastructure powering:
- The Job Seeker / Worker Mobile App
- The Contractor ERP App
- The Admin Web Panel

---

## 🚀 Quick Start & Setup

### 1. Installation
Install project dependencies:
```bash
yarn install
```

### 2. Environment Variables
Configure a `.env` file in the root directory:
```env
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/constructor
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
NODE_ENV=development
THROTTLE_TTL=60000
THROTTLE_LIMIT=60
```

### 3. Database Migration & Seeding
```bash
# Terminal 1: Run dev server to auto-sync schema
yarn start:dev

# Terminal 2: Seed initial administrative and testing data
yarn seed
```

---

## 🛠️ Available Scripts

- **`yarn start:dev`**: Runs the NestJS server with hot-reload via tsx/nodemon.
- **`yarn build`**: Compiles TypeScript into `dist/`.
- **`yarn start:prod`**: Runs the compiled production build.
- **`yarn lint`**: Runs **Oxlint** for fast, high-performance static analysis.
- **`yarn format`**: Formats all files using **Prettier**.
- **`yarn test`**: Runs unit and integration tests using **Vitest**.
- **`yarn test:cov`**: Runs Vitest with coverage report.

---

## 🔐 Security & RBAC Architecture

The platform implements multi-tenant security, site isolation, and role-based access control (RBAC):

### 1. Authentication & Session Security
- **JWT & Real-time Status Validation**: All protected endpoints validate JWT tokens via `PassportModule` and `JwtStrategy`. On every request, `JwtStrategy` validates user existence and asserts `isActive: true` and `isBlocked: false`. Blocked or deactivated users are rejected immediately with `401 Unauthorized`.
- **Password Security**: Passwords are encrypted using `bcryptjs` (salt rounds: 12). Password hashes and OTPs are stripped from responses and JWT payloads.
- **Account Lockout & Anti-Enumeration**:
  - Failed logins return a uniform `401 Unauthorized: Invalid credentials` to prevent username enumeration.
  - After 5 consecutive failed login attempts, the account is locked for 15 minutes (`lockoutUntil`).
- **Production OTP Masking**: OTP codes are never logged to console or returned in responses when `NODE_ENV=production`.
- **Rate Limiting**: Configured via `@nestjs/throttler` (`ThrottlerGuard`) to prevent brute force and SMS flooding:
  - Register: 5 req/min
  - Login: 10 req/min
  - OTP Request: 5 req/min
  - OTP Verification: 10 req/min
  - Password Reset: 5 req/min
  - Token Refresh: 10 req/min

### 2. RBAC & Multi-Tenancy Isolation
- **Role Guards**: Centralized `RolesGuard` evaluates endpoint `@Roles(...)` metadata. Supported roles:
  - `admin`: Global system administrative access.
  - `contractor`: Manages company projects, sites, engineers, and financial tracking.
  - `site_engineer`: Manages on-site daily operations, labor attendance, material requests, and expenses.
  - `company`: Enterprise client accounts.
  - `job_seeker`: Blue-collar and white-collar workers applying for jobs.
- **Site Isolation**: A `site_engineer` can only access and modify data belonging to sites they are actively assigned to via `SiteEngineerAssignment` (`isActive: true`).
- **Contractor Isolation**: A `contractor` can only access projects and sites where `project.contractorId = contractor.id`.
- **Self-Registration Restrictions**: Public self-registration (`POST /auth/register`) only permits the `job_seeker` role. Privileged accounts (`admin`, `contractor`, `site_engineer`, `company`) must be provisioned by an administrator via `POST /users`.
- **IDOR Protection**: `POST /auth/refresh` and `POST /auth/logout` use the authenticated session (`req.user.id`) rather than route parameters.

---

## 📡 API Reference

All requests and responses use JSON. Unless noted as public, every endpoint requires an `Authorization: Bearer <accessToken>` header.

Standard response envelope:
```json
{
  "success": true,
  "message": "Optional message",
  "data": { ... }
}
```

Standard error response envelope:
```json
{
  "statusCode": 400,
  "message": "Error description or validation errors array",
  "error": "Bad Request"
}
```

---

### Module 1: Authentication (`/auth`)

#### 1. Register
- **Endpoint**: `/auth/register`
- **Method**: `POST`
- **Authentication**: None (Public)
- **Role Restrictions**: Only `role: "job_seeker"` allowed. Privileged roles (`admin`, `contractor`, `site_engineer`, `company`) are rejected with `400 Bad Request`.
- **Rate Limit**: 5 requests / minute
- **Validation Rules**:
  - `fullName`: string, required, non-empty.
  - `email`: valid email string, optional.
  - `phone`: string, optional.
  - `password`: string, min 8 characters, optional.
  - `role`: enum (`job_seeker`, `admin`, `contractor`, `site_engineer`, `company`), defaults to `job_seeker`.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/register \
    -H "Content-Type: application/json" \
    -d '{
      "fullName": "Ramesh Kumar",
      "email": "ramesh@example.com",
      "phone": "9876543210",
      "password": "Password123!",
      "role": "job_seeker"
    }'
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "user": {
      "id": "c1f7b8e0-1234-4a56-8b90-abcdef123456",
      "fullName": "Ramesh Kumar",
      "email": "ramesh@example.com",
      "phone": "9876543210",
      "role": "job_seeker",
      "isActive": true
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "d8e7c6b5a4..."
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Role 'contractor' cannot be self-registered. Contact an administrator.
  - `409 Conflict`: Email already registered.
  - `429 Too Many Requests`: ThrottlerException.

---

#### 2. Login
- **Endpoint**: `/auth/login`
- **Method**: `POST`
- **Authentication**: None (Public)
- **Rate Limit**: 10 requests / minute
- **Validation Rules**:
  - `email`: valid email string, required.
  - `password`: string, min 8 characters, required.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/login \
    -H "Content-Type: application/json" \
    -d '{
      "email": "contractor@example.com",
      "password": "Password123!"
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "b2f6c5d4-5678-4a90-8b12-123456abcdef",
      "fullName": "John Contractor",
      "email": "contractor@example.com",
      "role": "contractor"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "f1e2d3c4b5..."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid credentials (returned uniformly if user doesn't exist or password mismatch).
  - `401 Unauthorized`: Account is locked due to too many failed attempts. Please try again after 15 minutes.
  - `401 Unauthorized`: Account is deactivated / Account is blocked.

---

#### 3. Request OTP
- **Endpoint**: `/auth/request-otp`
- **Method**: `POST`
- **Authentication**: None (Public)
- **Rate Limit**: 5 requests / minute
- **Validation Rules**:
  - `phone`: string, exactly 10 digits (`Length(10, 10)`).
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/request-otp \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "9876543210"
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "OTP sent successfully"
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Phone must be a valid 10-digit number.
  - `429 Too Many Requests`: Rate limit exceeded.

---

#### 4. Verify OTP
- **Endpoint**: `/auth/verify-otp`
- **Method**: `POST`
- **Authentication**: None (Public)
- **Rate Limit**: 10 requests / minute
- **Validation Rules**:
  - `phone`: string, length 10-15 digits.
  - `otp`: string, length 6-2000 chars (accepts 6-digit OTP or Firebase ID token).
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/verify-otp \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "9876543210",
      "otp": "123456"
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "user": {
      "id": "c1f7b8e0-1234-4a56-8b90-abcdef123456",
      "phone": "9876543210",
      "role": "job_seeker"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "a1b2c3d4e5..."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid or expired OTP.
  - `401 Unauthorized`: Account is blocked / deactivated.

---

#### 5. Reset Password
- **Endpoint**: `/auth/reset-password`
- **Method**: `POST`
- **Authentication**: None (Public)
- **Rate Limit**: 5 requests / minute
- **Validation Rules**:
  - `phone`: string, exactly 10 digits.
  - `otp`: string, exactly 6 digits.
  - `newPassword`: string, min 8 characters.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/reset-password \
    -H "Content-Type: application/json" \
    -d '{
      "phone": "9876543210",
      "otp": "123456",
      "newPassword": "NewStrongPassword123!"
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Password reset successfully. Please login with your new password."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid or expired OTP.
  - `404 Not Found`: User not found with this phone number.

---

#### 6. Refresh Access Token
- **Endpoint**: `/auth/refresh`
- **Method**: `POST`
- **Authentication**: Bearer JWT (Expired tokens accepted for refresh identity)
- **Rate Limit**: 10 requests / minute
- **Access Restrictions**: Uses authenticated identity (`req.user.id`). Prevents IDOR attacks.
- **Validation Rules**:
  - `refreshToken`: string, non-empty.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/auth/refresh \
    -H "Authorization: Bearer <accessToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "refreshToken": "d8e7c6b5a4..."
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "e9f8a7b6c5..."
  }
  ```
- **Error Responses**:
  - `401 Unauthorized`: Invalid session or invalid refresh token.

---

#### 7. Logout
- **Endpoint**: `/auth/logout`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Logged out successfully"
  }
  ```

---

#### 8. Get Current Profile
- **Endpoint**: `/auth/me`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Success Response (200 OK)**:
  ```json
  {
    "id": "b2f6c5d4-5678-4a90-8b12-123456abcdef",
    "email": "contractor@example.com",
    "fullName": "John Contractor",
    "role": "contractor",
    "isActive": true
  }
  ```

---

### Module 2: User Management (`/users`)

#### 1. List Users (Admin)
- **Endpoint**: `/users`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Query Parameters**:
  - `page`: number (default: 1)
  - `limit`: number (default: 20)
  - `role`: optional filter (`admin`, `contractor`, `site_engineer`, `company`, `job_seeker`)
- **Success Response (200 OK)**:
  ```json
  {
    "users": [
      {
        "id": "uuid",
        "fullName": "Alice Smith",
        "email": "alice@example.com",
        "role": "contractor",
        "isActive": true
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 20
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: Forbidden resource (non-admin).

---

#### 2. Create User (Admin Provisioning)
- **Endpoint**: `/users`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Validation Rules**:
  - `fullName`: string, required.
  - `email`: valid email, optional.
  - `password`: string, min 8 chars, optional.
  - `phone`: string, optional.
  - `role`: enum (`admin`, `contractor`, `site_engineer`, `company`, `job_seeker`), required.
- **Success Response (201 Created)**:
  ```json
  {
    "id": "uuid",
    "fullName": "Bob Engineer",
    "email": "bob@example.com",
    "role": "site_engineer",
    "isActive": true
  }
  ```

---

#### 3. Update Own Profile
- **Endpoint**: `/users/profile`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: All authenticated roles
- **Body**: `{ "fullName": "New Name", "phone": "9876543210" }`
- **Success Response (200 OK)**: Updated user object without sensitive hashes.

---

#### 4. Deactivate User (Admin)
- **Endpoint**: `/users/:id`
- **Method**: `DELETE`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Restrictions**: Admins cannot deactivate their own account.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "User deactivated successfully"
  }
  ```

---

### Module 3: Projects & Contractor Isolation (`/projects`)

#### 1. Create Project
- **Endpoint**: `/projects`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Contractor Isolation**: Project is automatically bound to the calling contractor's ID.
- **Validation Rules**:
  - `title`: string, required.
  - `description`: string, optional.
  - `budget`: positive number, optional.
  - `startDate`: ISO date string, optional.
  - `endDate`: ISO date string, optional.
- **Success Response (201 Created)**: Created Project object.

---

#### 2. Get Contractor Dashboard Stats
- **Endpoint**: `/projects/stats`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Contractor Isolation**: Contractors only receive aggregated counts for projects they own. Admins receive global counts.
- **Success Response (200 OK)**:
  ```json
  {
    "total": 5,
    "draft": 1,
    "active": 3,
    "completed": 1,
    "sites": 8,
    "budget": 5000000
  }
  ```

---

#### 3. List Own Projects
- **Endpoint**: `/projects/my-projects`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`
- **Query Parameters**: `page`, `limit`, `status`
- **Success Response (200 OK)**: Paginated array of projects owned by caller.

---

#### 4. Get Project by ID
- **Endpoint**: `/projects/:id`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Contractor Isolation**: Throws `403 Forbidden` if a contractor attempts to access another contractor's project.
- **Success Response (200 OK)**: Project entity with related sites.

---

#### 5. Update Project
- **Endpoint**: `/projects/:id`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Contractor Isolation**: Only the project owner or admin can modify project details.

---

### Module 4: Site Engineers & Assignment Access (`/site-engineers`)

#### 1. Create Site Engineer
- **Endpoint**: `/site-engineers`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Body**: `{ "fullName": "Engineer Name", "phone": "9876543210", "email": "eng@example.com" }`

---

#### 2. List Site Engineers
- **Endpoint**: `/site-engineers`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `contractor`, `admin`
- **Contractor Isolation**: Contractors only see site engineers actively assigned to sites belonging to their projects. Admins see all engineers.

---

#### 3. Site Engineer Self Profile & Assignments
- **Endpoint**: `/site-engineers/my-profile`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `site_engineer`
- **Access Restrictions**: Restricted to caller's profile and active site assignments.

---

#### 4. Site Engineer Dashboard Stats
- **Endpoint**: `/site-engineers/stats`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `site_engineer`, `contractor`, `admin`
- **Access Restrictions**: Site Engineers receive stats for their assigned sites (labor counts, today's material transactions).

---

### Module 5: Site Operations Isolation (Attendance, Materials, Expenses)

#### 1. Attendance Check-In / Check-Out
- **Endpoints**:
  - `POST /sites/:siteId/attendance/check-in`
  - `POST /sites/:siteId/attendance/check-out`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Site Isolation Rule**: A `site_engineer` must be actively assigned to `:siteId`. A `contractor` must own the project containing `:siteId`. Violations result in `403 Forbidden: You are not assigned to this site`.
- **Body (Check-In)**: `{ "latitude": 30.7333, "longitude": 76.7794 }`

---

#### 2. Labour Attendance Records
- **Endpoints**:
  - `POST /sites/:siteId/attendance/labour`
  - `GET /sites/:siteId/attendance/labour`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Site Isolation Rule**: Strict site assignment verification for engineers and project ownership verification for contractors.

---

#### 3. Site Expenses
- **Endpoints**:
  - `POST /sites/:siteId/expenses`: Record expense
  - `GET /sites/:siteId/expenses`: List site expenses
  - `GET /expenses/:id`: Get expense details
  - `PATCH /expenses/:id`: Update expense
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Site Isolation Rule**: Both site engineers and contractors are strictly checked against site authorization before reading or writing expense records.

---

#### 4. Site Materials & Inventory
- **Endpoints**:
  - `POST /materials`: Create catalog material (Admin only)
  - `GET /materials`: List catalog materials (Admin, Contractor, Site Engineer)
  - `POST /sites/:siteId/materials`: Record transaction (purchase, consumption, transfer, request)
  - `GET /sites/:siteId/materials`: List site material transactions
  - `GET /sites/:siteId/materials/stock`: Get live material stock for site
  - `PATCH /materials/transactions/:id/status`: Approve / Reject material request (Contractor, Admin)
- **Authentication**: Bearer JWT
- **Isolation Rule**: Site transactions and stock queries verify site assignment for engineers and project ownership for contractors. Server-side computation enforces `totalCost = quantity * rate` without relying on client calculations.

---

### Module 6: Companies & Verification Workflow (`/companies`)

The Companies module handles business entity registration, corporate profile management, official document storage, and administrative verification. In the RBAC model, users with the `company` role own Company profiles which are required to publish job postings and hire workers.

#### 1. Create Company Profile
- **Endpoint**: `/companies`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `company`, `admin`
- **Access Restrictions**: Automatically associates the company profile with the authenticated user ID (`req.user.id`). Newly created profiles receive an initial `verificationStatus: 'pending'`.
- **Validation Rules**:
  - `name`: string, required, non-empty.
  - `contactEmail`: string, valid email format, required.
  - `contactPhone`: string, non-empty, required.
  - `registrationNumber`: string, optional.
  - `gstNumber`: string, optional.
  - `panNumber`: string, optional.
  - `alternatePhone`: string, optional.
  - `website`: string, optional.
  - `address`: string, optional.
  - `city`: string, optional.
  - `state`: string, optional.
  - `pincode`: string, optional.
  - `businessType`: string, optional (e.g. `Pvt Ltd`, `Partnership`, `Proprietorship`).
  - `yearEstablished`: integer number, optional.
  - `teamSizeRange`: string, optional (e.g. `10-50`, `50-200`).
  - `specializations`: array of strings, optional.
  - `operationalAreas`: array of strings, optional.
  - `logoUrl`: string URL, optional.
  - `description`: text string, optional.
  - `documentUrls`: array of string URLs, optional (AWS S3 file links).
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/companies \
    -H "Authorization: Bearer <accessToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Apex Buildcon Pvt Ltd",
      "registrationNumber": "U45200CH2020PTC012345",
      "gstNumber": "04AABCA1234A1Z5",
      "panNumber": "AABCA1234A",
      "contactEmail": "contact@apexbuildcon.com",
      "contactPhone": "9876543210",
      "address": "Plot 42, Industrial Area Phase 1",
      "city": "Chandigarh",
      "state": "Chandigarh",
      "pincode": "160002",
      "businessType": "Pvt Ltd",
      "yearEstablished": 2018,
      "teamSizeRange": "50-200",
      "specializations": ["Commercial", "Residential High-Rise"],
      "operationalAreas": ["Punjab", "Haryana", "Chandigarh"],
      "documentUrls": ["https://s3.amazonaws.com/constructor-docs/gst_cert.pdf"]
    }'
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Company profile created successfully",
    "data": {
      "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
      "name": "Apex Buildcon Pvt Ltd",
      "registrationNumber": "U45200CH2020PTC012345",
      "gstNumber": "04AABCA1234A1Z5",
      "panNumber": "AABCA1234A",
      "contactEmail": "contact@apexbuildcon.com",
      "contactPhone": "9876543210",
      "address": "Plot 42, Industrial Area Phase 1",
      "city": "Chandigarh",
      "state": "Chandigarh",
      "pincode": "160002",
      "businessType": "Pvt Ltd",
      "yearEstablished": 2018,
      "teamSizeRange": "50-200",
      "specializations": ["Commercial", "Residential High-Rise"],
      "operationalAreas": ["Punjab", "Haryana", "Chandigarh"],
      "verificationStatus": "pending",
      "verificationRemarks": null,
      "documentUrls": ["https://s3.amazonaws.com/constructor-docs/gst_cert.pdf"],
      "userId": "b2f6c5d4-5678-4a90-8b12-123456abcdef",
      "createdAt": "2026-09-28T10:00:00.000Z",
      "updatedAt": "2026-09-28T10:00:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Validation failure (missing required `name`, `contactEmail`, or `contactPhone`).
  - `401 Unauthorized`: Missing or invalid JWT token.
  - `403 Forbidden`: Role not authorized (e.g. `job_seeker` or `contractor`).

---

#### 2. Get My Company Profiles
- **Endpoint**: `/companies/my-profiles`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `company`
- **Access Restrictions**: Returns only companies owned by the authenticated user (`where: { userId: req.user.id }`).
- **Success Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
        "name": "Apex Buildcon Pvt Ltd",
        "contactEmail": "contact@apexbuildcon.com",
        "contactPhone": "9876543210",
        "city": "Chandigarh",
        "verificationStatus": "pending",
        "createdAt": "2026-09-28T10:00:00.000Z"
      }
    ]
  }
  ```

---

#### 3. Update Company Profile
- **Endpoint**: `/companies/:id`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `company`, `admin`
- **Access Restrictions**: The calling user must own the company profile (`company.userId === req.user.id`). Violations throw `403 Forbidden: You do not own this company profile`.
- **Validation Rules**: Accepts partial properties of `CreateCompanyDto`.
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/companies/e4f8b2c1-89ab-4cde-0123-456789abcdef \
    -H "Authorization: Bearer <accessToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "website": "https://apexbuildcon.com",
      "teamSizeRange": "200-500"
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Company profile updated successfully",
    "data": {
      "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
      "name": "Apex Buildcon Pvt Ltd",
      "website": "https://apexbuildcon.com",
      "teamSizeRange": "200-500",
      "verificationStatus": "pending"
    }
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: You do not own this company profile.
  - `404 Not Found`: Company not found.

---

#### 4. List All Companies (Admin)
- **Endpoint**: `/companies`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Query Parameters**:
  - `page`: integer, optional (default: 1).
  - `limit`: integer, optional (default: 10).
  - `status`: optional filter by `verificationStatus` (`pending`, `verified`, `rejected`).
- **Example Request**:
  ```bash
  curl -X GET "http://localhost:3000/companies?status=pending&page=1&limit=10" \
    -H "Authorization: Bearer <adminToken>"
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
        "name": "Apex Buildcon Pvt Ltd",
        "contactEmail": "contact@apexbuildcon.com",
        "verificationStatus": "pending",
        "createdAt": "2026-09-28T10:00:00.000Z"
      }
    ],
    "total": 1
  }
  ```

---

#### 5. Get Company by ID (Admin)
- **Endpoint**: `/companies/:id`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Success Response (200 OK)**:
  ```json
  {
    "data": {
      "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
      "name": "Apex Buildcon Pvt Ltd",
      "registrationNumber": "U45200CH2020PTC012345",
      "gstNumber": "04AABCA1234A1Z5",
      "verificationStatus": "pending",
      "documentUrls": ["https://s3.amazonaws.com/constructor-docs/gst_cert.pdf"]
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Company not found.

---

#### 6. Verify Company (Admin)
- **Endpoint**: `/companies/:id/verify`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Validation Rules**:
  - `verificationStatus`: enum (`pending`, `verified`, `rejected`), required.
  - `verificationRemarks`: string, optional feedback or reason for rejection.
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/companies/e4f8b2c1-89ab-4cde-0123-456789abcdef/verify \
    -H "Authorization: Bearer <adminToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "verificationStatus": "verified",
      "verificationRemarks": "GST and PAN documents verified against government records."
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Company verification status updated",
    "data": {
      "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
      "name": "Apex Buildcon Pvt Ltd",
      "verificationStatus": "verified",
      "verificationRemarks": "GST and PAN documents verified against government records."
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: `verificationStatus must be one of the following values: pending, verified, rejected`.
  - `403 Forbidden`: Admin role required.

---

### Module 7: Jobs & Moderation (`/jobs`)

The Jobs module manages job postings published by verified Companies. Blue-collar and white-collar Job Seekers discover jobs, filter by wages and skills, save listings, report discrepancies, and submit job applications. The module enforces company ownership isolation, seeker visibility rules, and administrative moderation.

#### 1. Create Job Posting
- **Endpoint**: `/jobs`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `company`
- **Access Restrictions**: The user must own an active `Company` profile. The job is automatically linked to the user's company and saved in `draft` status by default.
- **Validation Rules**:
  - `title`: string, required, non-empty.
  - `location`: string, required, non-empty.
  - `description`: text string, required, non-empty.
  - `skills`: array of string skill tags, optional (e.g. `["Masonry", "Steel Bending"]`).
  - `compensation`: numeric compensation amount, optional, min 0.
  - `workforceRequired`: integer number of workers needed, optional, min 1 (default: 1).
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/jobs \
    -H "Authorization: Bearer <accessToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "title": "Senior Mason & Shuttering Carpenter",
      "location": "Mohali Sector 82, Punjab",
      "skills": ["Masonry", "Formwork", "Shuttering"],
      "description": "Urgent requirement for 5 skilled masons and shuttering carpenters for a 12-story residential project.",
      "compensation": 950,
      "workforceRequired": 5
    }'
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Job created successfully",
    "data": {
      "id": "f5a7c3d2-1234-5678-9abc-def012345678",
      "title": "Senior Mason & Shuttering Carpenter",
      "location": "Mohali Sector 82, Punjab",
      "skills": ["Masonry", "Formwork", "Shuttering"],
      "description": "Urgent requirement for 5 skilled masons and shuttering carpenters for a 12-story residential project.",
      "compensation": 950,
      "dailyPay": 0,
      "workforceRequired": 5,
      "projectType": "Full-time",
      "experienceLevel": "Any",
      "status": "draft",
      "companyId": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
      "createdAt": "2026-09-28T10:15:00.000Z",
      "updatedAt": "2026-09-28T10:15:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `404 Not Found`: Company profile not found. Please create a company profile first.

---

#### 2. List Jobs (Role-Scoped & Filterable)
- **Endpoint**: `/jobs`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `company`, `job_seeker`
- **Role-Based Visibility**:
  - `admin`: sees all jobs across the platform across all statuses.
  - `company`: sees only jobs created by their company.
  - `job_seeker`: sees only `published` jobs, returned in a mobile-optimized shape containing `saved` (bookmarked) and `applied` status flags for each listing.
- **Query Parameters**:
  - `page`: integer (default: 1).
  - `limit`: integer (default: 10).
  - `search`: string (matches against job title or description).
  - `location`: string (matches against location).
  - `minDailyPay`: numeric minimum daily wage threshold (`dailyPay >= minDailyPay`).
  - `skill`: string (filters jobs matching skill name).
  - `projectType`: string (e.g. `Full-time`, `Contract`, `Daily Wage`).
  - `experienceLevel`: string (e.g. `Fresher`, `Experienced`, `Any`).
- **Example Request**:
  ```bash
  curl -X GET "http://localhost:3000/jobs?location=Mohali&search=Mason&page=1&limit=10" \
    -H "Authorization: Bearer <seekerToken>"
  ```
- **Success Response (Job Seeker View - 200 OK)**:
  ```json
  {
    "items": [
      {
        "id": "f5a7c3d2-1234-5678-9abc-def012345678",
        "title": "Senior Mason & Shuttering Carpenter",
        "company": "Apex Buildcon Pvt Ltd",
        "location": "Mohali Sector 82, Punjab",
        "dailyPay": 950,
        "skills": ["Masonry", "Formwork", "Shuttering"],
        "description": "Urgent requirement for 5 skilled masons and shuttering carpenters...",
        "requirements": ["Minimum 2 years experience", "Own tools preferred"],
        "saved": false,
        "applied": false,
        "projectType": "Full-time",
        "experienceLevel": "Experienced"
      }
    ],
    "total": 1
  }
  ```
- **Success Response (Admin / Company View - 200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "f5a7c3d2-1234-5678-9abc-def012345678",
        "title": "Senior Mason & Shuttering Carpenter",
        "status": "published",
        "workforceRequired": 5,
        "company": {
          "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
          "name": "Apex Buildcon Pvt Ltd"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```

---

#### 3. Get Job by ID
- **Endpoint**: `/jobs/:id`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `company`, `job_seeker`
- **Access Restrictions**:
  - `job_seeker` can only view jobs with `status: 'published'`. Non-published jobs return `404 Not Found`.
  - `company` can only view jobs belonging to their own company profile.
  - `admin` can view any job.
- **Success Response (200 OK)**:
  ```json
  {
    "data": {
      "id": "f5a7c3d2-1234-5678-9abc-def012345678",
      "title": "Senior Mason & Shuttering Carpenter",
      "location": "Mohali Sector 82, Punjab",
      "skills": ["Masonry", "Formwork", "Shuttering"],
      "description": "Urgent requirement for 5 skilled masons...",
      "compensation": 950,
      "dailyPay": 950,
      "workforceRequired": 5,
      "status": "published",
      "company": {
        "id": "e4f8b2c1-89ab-4cde-0123-456789abcdef",
        "name": "Apex Buildcon Pvt Ltd",
        "city": "Chandigarh"
      }
    }
  }
  ```
- **Error Responses**:
  - `403 Forbidden`: You do not have access to this job.
  - `404 Not Found`: Job not found or not published.

---

#### 4. Update Job Posting
- **Endpoint**: `/jobs/:id`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `company`
- **Access Restrictions**: Company ownership verification. Only the company that created the job can update it.
- **Validation Rules**: Accepts partial properties of `CreateJobDto` plus optional `status` (`draft`, `published`, `closed`).
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/jobs/f5a7c3d2-1234-5678-9abc-def012345678 \
    -H "Authorization: Bearer <companyToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "published",
      "compensation": 1000
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Job updated successfully",
    "data": {
      "id": "f5a7c3d2-1234-5678-9abc-def012345678",
      "status": "published",
      "compensation": 1000
    }
  }
  ```

---

#### 5. Close Job Posting
- **Endpoint**: `/jobs/:id/close`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `company`
- **Access Restrictions**: Calling user must own the company that posted the job. Transitions job status to `closed`.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Job closed successfully",
    "data": {
      "id": "f5a7c3d2-1234-5678-9abc-def012345678",
      "status": "closed"
    }
  }
  ```

---

#### 6. Toggle Save Job (Job Seeker Bookmark)
- **Endpoint**: `/jobs/:id/save`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `job_seeker`
- **Description**: Idempotent toggle endpoint. If the job is already saved, it removes the bookmark; otherwise, it saves it.
- **Success Response (200 OK)**:
  ```json
  {
    "data": {
      "saved": true,
      "jobId": "f5a7c3d2-1234-5678-9abc-def012345678"
    }
  }
  ```

---

#### 7. List Saved Jobs
- **Endpoint**: `/jobs/saved/list`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `job_seeker`
- **Success Response (200 OK)**:
  ```json
  {
    "items": [
      {
        "id": "f5a7c3d2-1234-5678-9abc-def012345678",
        "title": "Senior Mason & Shuttering Carpenter",
        "company": "Apex Buildcon Pvt Ltd",
        "location": "Mohali Sector 82, Punjab",
        "dailyPay": 950,
        "skills": ["Masonry", "Formwork", "Shuttering"],
        "saved": true,
        "applied": false
      }
    ],
    "total": 1
  }
  ```

---

#### 8. Report Job Posting
- **Endpoint**: `/jobs/:id/report`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `job_seeker`
- **Validation Rules**: `{ "reason": string }` (non-empty string describing the issue).
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Job reported",
    "data": {
      "reported": true,
      "jobId": "f5a7c3d2-1234-5678-9abc-def012345678",
      "reason": "Incorrect daily wage specified upon arrival",
      "reportedBy": "c1f7b8e0-1234-4a56-8b90-abcdef123456"
    }
  }
  ```

---

#### 9. Moderate Job (Admin)
- **Endpoint**: `/jobs/:id/moderate`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Validation Rules**:
  - `status`: enum (`published`, `rejected`, `closed`), required.
  - `moderationRemarks`: string, optional feedback explaining moderation action.
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/jobs/f5a7c3d2-1234-5678-9abc-def012345678/moderate \
    -H "Authorization: Bearer <adminToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "rejected",
      "moderationRemarks": "Violates fair wage guidelines."
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Job moderated successfully",
    "data": {
      "id": "f5a7c3d2-1234-5678-9abc-def012345678",
      "status": "rejected",
      "moderationRemarks": "Violates fair wage guidelines."
    }
  }
  ```

---

### Module 8: Job Applications & Candidate Pipeline (`/applications`)

The Applications module bridges Job Seekers and Companies. Seekers apply with daily wage expectations, availability, and contact numbers. Companies review applicant profiles, update candidate statuses through a multi-stage pipeline (`pending` -> `reviewed` -> `shortlisted` -> `accepted` / `rejected`), perform bulk shortlisting, and communicate updates via push notifications.

#### 1. Submit Application
- **Endpoint**: `/applications/jobs/:jobId/apply`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `job_seeker`
- **Access Restrictions**:
  - The target job must exist and have `status: 'published'`.
  - Duplicate applications are prevented (a worker cannot apply to the same job twice).
- **Validation Rules**:
  - `coverNote`: string, optional personal message or note.
  - `expectedDailyWage`: numeric daily wage expectation, optional, min 0.
  - `skills`: array of strings, optional.
  - `experienceYears`: numeric years of trade experience, optional, min 0.
  - `availableFrom`: ISO date string, optional.
  - `contactPhone`: string phone number, optional.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/applications/jobs/f5a7c3d2-1234-5678-9abc-def012345678/apply \
    -H "Authorization: Bearer <seekerToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "coverNote": "5 years experienced mason, ready to join immediately.",
      "expectedDailyWage": 950,
      "skills": ["Masonry", "Brickwork", "Plastering"],
      "experienceYears": 5,
      "availableFrom": "2026-10-01",
      "contactPhone": "9876543210"
    }'
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "message": "Application submitted successfully",
    "data": {
      "id": "a1b2c3d4-0000-1111-2222-333344445555",
      "jobId": "f5a7c3d2-1234-5678-9abc-def012345678",
      "userId": "c1f7b8e0-1234-4a56-8b90-abcdef123456",
      "status": "pending",
      "coverNote": "5 years experienced mason, ready to join immediately.",
      "expectedDailyWage": 950,
      "skills": ["Masonry", "Brickwork", "Plastering"],
      "experienceYears": 5,
      "availableFrom": "2026-10-01",
      "contactPhone": "9876543210",
      "createdAt": "2026-09-28T10:30:00.000Z"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: You have already applied for this job.
  - `404 Not Found`: Job not found or not published.

---

#### 2. List Applications
- **Endpoint**: `/applications`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `company`, `job_seeker`
- **Role-Based Visibility**:
  - `job_seeker`: sees only their own submitted applications.
  - `company`: sees applications submitted to jobs posted by their company.
  - `admin`: sees all applications across the platform.
- **Query Parameters**:
  - `page`: integer (default: 1).
  - `limit`: integer (default: 10).
  - `status`: optional filter (`pending`, `reviewed`, `shortlisted`, `accepted`, `rejected`, `withdrawn`).
- **Success Response (200 OK)**:
  ```json
  {
    "data": [
      {
        "id": "a1b2c3d4-0000-1111-2222-333344445555",
        "jobId": "f5a7c3d2-1234-5678-9abc-def012345678",
        "status": "pending",
        "expectedDailyWage": 950,
        "job": {
          "title": "Senior Mason & Shuttering Carpenter",
          "location": "Mohali Sector 82, Punjab"
        },
        "user": {
          "fullName": "Ramesh Kumar",
          "phone": "9876543210"
        }
      }
    ],
    "total": 1,
    "page": 1,
    "limit": 10
  }
  ```

---

#### 3. Get Application by ID
- **Endpoint**: `/applications/:id`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `company`, `job_seeker`
- **Access Restrictions**: Job Seekers can only access their own applications. Companies can only access applications for their company's jobs.
- **Success Response (200 OK)**: Application object with nested job, company, and applicant user details.

---

#### 4. Update Application Status
- **Endpoint**: `/applications/:id/status`
- **Method**: `PATCH`
- **Authentication**: Bearer JWT
- **Roles**: `company`, `admin`
- **Access Restrictions**: The company user must own the job associated with the application.
- **Validation Rules**:
  - `status`: enum (`pending`, `reviewed`, `shortlisted`, `accepted`, `rejected`), required.
  - `reviewRemarks`: string, optional feedback from employer.
- **Example Request**:
  ```bash
  curl -X PATCH http://localhost:3000/applications/a1b2c3d4-0000-1111-2222-333344445555/status \
    -H "Authorization: Bearer <companyToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "status": "shortlisted",
      "reviewRemarks": "Candidate meets trade criteria. Contacting for site trial."
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Application status updated",
    "data": {
      "id": "a1b2c3d4-0000-1111-2222-333344445555",
      "status": "shortlisted",
      "reviewRemarks": "Candidate meets trade criteria. Contacting for site trial."
    }
  }
  ```

---

#### 5. Bulk Shortlist Applications
- **Endpoint**: `/applications/bulk-shortlist`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `company`, `admin`
- **Access Restrictions**: Companies can only shortlist candidates for jobs they own.
- **Validation Rules**:
  - `applicationIds`: array of UUID strings, required, non-empty.
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/applications/bulk-shortlist \
    -H "Authorization: Bearer <companyToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "applicationIds": [
        "a1b2c3d4-0000-1111-2222-333344445555",
        "b2c3d4e5-1111-2222-3333-444455556666"
      ]
    }'
  ```
- **Success Response (200 OK)**:
  ```json
  {
    "message": "2 applications shortlisted",
    "data": {
      "updated": 2,
      "ids": [
        "a1b2c3d4-0000-1111-2222-333344445555",
        "b2c3d4e5-1111-2222-3333-444455556666"
      ]
    }
  }
  ```

---

#### 6. Withdraw Application
- **Endpoint**: `/applications/:id/withdraw`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `job_seeker`
- **Access Restrictions**: Only the applicant can withdraw their application. Applications that are already `accepted` cannot be withdrawn.
- **Success Response (200 OK)**:
  ```json
  {
    "message": "Application withdrawn",
    "data": {
      "id": "a1b2c3d4-0000-1111-2222-333344445555",
      "status": "withdrawn"
    }
  }
  ```
- **Error Responses**:
  - `400 Bad Request`: Cannot withdraw an already accepted application.
  - `403 Forbidden`: You can only withdraw your own applications.

---

### Module 9: Reporting & Analytics (`/reports`)

The Reporting & Analytics module provides executive, site-level, operational, and financial business intelligence derived directly from database records (attendance logs, labour entries, material transactions, ad-hoc expenses, and daily progress logs). It enforces role-based access control, project/site ownership isolation, server-side parameter validation, and supports asynchronous as well as direct streaming exports in CSV, Excel, and PDF formats.

---

#### 1. Project Reports

##### 1.1 Project Summary
- **Endpoint**: `/reports/projects/:projectId/summary`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Access Restrictions**: Contractors can only view summary reports for projects they own (`project.contractorId = contractor.id`).
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "project": {
        "id": "proj-1",
        "name": "Skyline Towers",
        "location": "Mohali Sector 82",
        "status": "active",
        "budget": 5000000,
        "contractValue": 6000000,
        "durationDays": 365,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31"
      },
      "sites": {
        "total": 3,
        "active": 2
      },
      "costs": {
        "labourCost": 450000,
        "materialCost": 1250000,
        "expenseCost": 85000,
        "otherCosts": 15000,
        "totalCost": 1800000
      },
      "profitability": {
        "totalRevenue": 6000000,
        "netProfit": 4200000,
        "profitMarginPercentage": 70
      },
      "progress": {
        "averagePercentage": 45.5,
        "totalReportsSubmitted": 48,
        "latestReportDate": "2026-09-28"
      }
    }
  }
  ```

##### 1.2 Project Progress
- **Endpoint**: `/reports/projects/:projectId/progress`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Success Response (200 OK)**: Overall completion percentage, site-by-site status/progress breakdown, and chronological progress milestones from daily reports.

##### 1.3 Project Cost Analysis
- **Endpoint**: `/reports/projects/:projectId/cost`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `startDate`, `endDate`, `siteId`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "projectId": "proj-1",
      "projectName": "Skyline Towers",
      "budget": 5000000,
      "totalSpent": 1800000,
      "remainingBudget": 3200000,
      "budgetUtilizationPercentage": 36,
      "breakdown": {
        "labour": 450000,
        "materials": 1250000,
        "expenses": 85000
      }
    }
  }
  ```

##### 1.4 Project Labour Cost
- **Endpoint**: `/reports/projects/:projectId/labour-cost`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `startDate`, `endDate`, `siteId`
- **Success Response (200 OK)**: Aggregated worker headcount, total overtime hours, and wage expenditure broken down by trade (Masons, Carpenters, Helpers, Steel Benders).

##### 1.5 Project Material Cost
- **Endpoint**: `/reports/projects/:projectId/material-cost`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `startDate`, `endDate`, `siteId`, `category`
- **Success Response (200 OK)**: Purchases vs consumption expenditure, material category distribution, top vendor/supplier rankings, and transaction volumes.

##### 1.6 Project Expense Summary
- **Endpoint**: `/reports/projects/:projectId/expenses`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `startDate`, `endDate`, `siteId`, `category`
- **Success Response (200 OK)**: Expense category distribution (Travel, Equipment, Fuel, Food, Permits), total expenditures, and recent receipts.

##### 1.7 Project Profitability
- **Endpoint**: `/reports/projects/:projectId/profitability`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Success Response (200 OK)**:
  ```json
  {
    "success": true,
    "data": {
      "projectId": "proj-1",
      "projectName": "Skyline Towers",
      "financials": {
        "contractValue": 6000000,
        "budget": 5000000,
        "actualCost": 1800000,
        "costVariance": 3200000,
        "isUnderBudget": true
      },
      "profitability": {
        "recognizedRevenue": 6000000,
        "netProfit": 4200000,
        "profitMarginPercentage": 70,
        "status": "profitable"
      },
      "costDistribution": {
        "labourCost": 450000,
        "materialCost": 1250000,
        "expenseCost": 85000,
        "otherCosts": 15000,
        "totalCost": 1800000
      }
    }
  }
  ```

##### 1.8 Daily Project Reports List
- **Endpoint**: `/reports/projects/:projectId/daily-reports`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `status`, `startDate`, `endDate`, `siteId`, `page`, `limit`
- **Success Response (200 OK)**: Paginated collection of daily reports across all project sites with cost and progress metrics.

---

#### 2. Site Reports

##### 2.1 Daily Site Reports
- **Endpoint**: `/sites/:siteId/daily-reports`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Access Restrictions**: Engineers must be assigned to `:siteId`; Contractors must own the project containing `:siteId`.
- **Query Parameters**: `status`, `startDate`, `endDate`, `page`, `limit`

##### 2.2 Site Labour Report
- **Endpoint**: `/reports/sites/:siteId/labour`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Query Parameters**: `startDate`, `endDate`, `trade`
- **Success Response (200 OK)**: Total workforce on site, overtime hours, wages paid, and breakdown by trade.

##### 2.3 Site Material Report
- **Endpoint**: `/reports/sites/:siteId/materials`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Query Parameters**: `startDate`, `endDate`, `type`
- **Success Response (200 OK)**: Real-time stock on hand per catalog material and transaction logs (purchases, consumption, issues).

##### 2.4 Site Expense Report
- **Endpoint**: `/reports/sites/:siteId/expenses`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Query Parameters**: `startDate`, `endDate`, `category`
- **Success Response (200 OK)**: Detailed expense logs with category groupings and total site expenditure.

##### 2.5 Site Progress Report
- **Endpoint**: `/reports/sites/:siteId/progress`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Query Parameters**: `startDate`, `endDate`
- **Success Response (200 OK)**: Chronological progress curve from daily report submissions, latest work description, and recorded site blockers.

---

#### 3. Operational Reports

##### 3.1 Platform / Contractor Attendance Report
- **Endpoint**: `/reports/operations/attendance`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `startDate`, `endDate`, `siteId`, `projectId`
- **Success Response (200 OK)**: Total worker check-ins, total hours worked, overtime minutes, and recent attendance timestamps.

##### 3.2 Contractor Portfolio Report
- **Endpoint**: `/reports/operations/contractors`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `status`, `page`, `limit`
- **Success Response (200 OK)**: Contractor verification status, active project count, completed projects, and cumulative portfolio budget.

##### 3.3 Platform User Demographics
- **Endpoint**: `/reports/operations/users`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Success Response (200 OK)**: Total user count, role distribution (`admin`, `contractor`, `site_engineer`, `company`, `job_seeker`), and active vs blocked metrics.

##### 3.4 Company Verification & Hiring Report
- **Endpoint**: `/reports/operations/companies`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`
- **Success Response (200 OK)**: Total companies registered, verification funnel (`pending`, `verified`, `rejected`), and total jobs posted.

##### 3.5 Jobs & Applications Funnel Report
- **Endpoint**: `/reports/operations/jobs-applications`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `company`
- **Success Response (200 OK)**: Total jobs posted, candidate application funnel (`pending`, `reviewed`, `shortlisted`, `accepted`, `rejected`), and candidate-per-job averages.

---

#### 4. Financial Reports

##### 4.1 Cross-Project Cost Analytics
- **Endpoint**: `/reports/financial/costs`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `projectId`, `startDate`, `endDate`
- **Success Response (200 OK)**: Portfolio-wide comparison of allocated budgets vs actual spent across projects.

##### 4.2 Cross-Project Profitability Rankings
- **Endpoint**: `/reports/financial/profitability`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`
- **Query Parameters**: `projectId`, `startDate`, `endDate`
- **Success Response (200 OK)**: Portfolio revenue, overall profit margin %, and project rankings sorted from most to least profitable.

---

#### 5. Export Functionality (CSV, Excel, PDF)

##### 5.1 Create Asynchronous Export Request
- **Endpoint**: `/reports/export`
- **Method**: `POST`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Validation Rules**:
  - `reportType`: string, required (e.g. `project-summary`, `project-cost`, `labour-cost`, `material-cost`, `expenses`, `profitability`, `daily-reports`, `site-labour`, `site-materials`, `site-expenses`, `attendance`, `financial-costs`).
  - `format`: enum (`csv`, `excel`, `pdf`), required.
  - `filters`: object containing query parameters (`projectId`, `siteId`, `startDate`, `endDate`, etc.).
- **Example Request**:
  ```bash
  curl -X POST http://localhost:3000/reports/export \
    -H "Authorization: Bearer <accessToken>" \
    -H "Content-Type: application/json" \
    -d '{
      "reportType": "project-cost",
      "format": "csv",
      "filters": { "projectId": "proj-1" }
    }'
  ```
- **Success Response (201 Created)**:
  ```json
  {
    "success": true,
    "message": "Export request created",
    "data": {
      "id": "exp-1234-5678-9abc",
      "userId": "user-uuid",
      "reportType": "project-cost",
      "format": "csv",
      "status": "completed",
      "fileName": "project-cost-2026-09-28.csv",
      "fileUrl": "/reports/export/exp-1234-5678-9abc/download",
      "fileSizeBytes": 1042,
      "createdAt": "2026-09-28T10:00:00.000Z",
      "completedAt": "2026-09-28T10:00:01.000Z"
    }
  }
  ```

##### 5.2 List User Export Requests
- **Endpoint**: `/reports/export`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Success Response (200 OK)**: Returns the user's export job history with generation status and file metadata.

##### 5.3 Get Export Job Status
- **Endpoint**: `/reports/export/:id`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Access Restrictions**: Users can only inspect export requests they created.

##### 5.4 Download Completed Export
- **Endpoint**: `/reports/export/:id/download`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Response**: Binary / text file payload with appropriate `Content-Type` (`text/csv`, `application/vnd.ms-excel`, `application/pdf`) and `Content-Disposition: attachment; filename="..."`.

##### 5.5 Direct Streaming Export Download
- **Endpoint**: `/reports/export/download`
- **Method**: `GET`
- **Authentication**: Bearer JWT
- **Roles**: `admin`, `contractor`, `site_engineer`
- **Query Parameters**: `reportType`, `format` (`csv`, `excel`, `pdf`), plus report-specific filters (e.g. `projectId`, `startDate`, `endDate`).
- **Response**: Immediate streaming file download with content-disposition attachment.

---

## 🧪 Testing with Bruno

The repository includes a ready-to-run [Bruno](https://www.usebruno.com/) collection inside the `bruno/` directory:

| Folder | Endpoints Covered |
| :--- | :--- |
| `bruno/Auth/` | `Register`, `Login`, `Request OTP`, `Verify OTP`, `Reset Password`, `Refresh Token`, `Logout`, `Get Me` |
| `bruno/Users/` | `List All Users`, `Create User`, `Admin Update User`, `Deactivate User`, `Get Profile`, `Update Profile` |
| `bruno/Companies/` | `Create Company`, `My Companies`, `Update Company`, `List Companies`, `Get Company`, `Verify Company` |
| `bruno/Jobs/` | `Create Job`, `List Jobs`, `Get Job`, `Update Job`, `Close Job`, `Toggle Save Job`, `List Saved Jobs`, `Report Job`, `Moderate Job` |
| `bruno/Applications/` | `Apply to Job`, `List Applications`, `Get Application`, `Update Application Status`, `Bulk Shortlist`, `Withdraw Application` |
| `bruno/Projects/` | `Create Project`, `List Projects Admin`, `My Projects`, `Get Project`, `Update Project`, `Get Stats` |
| `bruno/Site-Engineers/` | `Create Site Engineer`, `List Site Engineers`, `My Profile`, `Get Site Engineer`, `Get Stats` |
| `bruno/Attendance/` | `Site Check In`, `Site Check Out`, `Create Labour Record`, `Get Labour Records`, `List Attendance` |
| `bruno/Materials/` | `Create Material`, `List Materials`, `Record Transaction`, `List Site Transactions`, `Get Stock`, `Update Status` |
| `bruno/Expenses/` | `Record Expense`, `List Expenses`, `Get Expense`, `Update Expense` |
| `bruno/Reports/` | `Create Daily Report`, `Get Report`, `List Site Reports`, `Project Reports`, `Review Report`, `Submit Report`, `Project Summary`, `Project Progress`, `Project Cost`, `Project Labour Cost`, `Project Material Cost`, `Project Expenses`, `Project Profitability`, `Project Daily Reports`, `Site Labour Report`, `Site Material Report`, `Site Expense Report`, `Site Progress Report`, `Operational Attendance`, `Operational Contractors`, `Operational Users`, `Operational Companies`, `Operational Jobs Applications`, `Financial Costs`, `Financial Profitability`, `Create Export`, `List Exports`, `Get Export Status`, `Download Export`, `Direct Export Download` |

### Environment Setup in Bruno
Set the Bruno environment variables:
- `baseUrl`: `http://localhost:3000`
- `token`: dynamically populated via login / verify-otp post-response scripts.
- `accessToken`: alias used in bearer token authorization headers.

