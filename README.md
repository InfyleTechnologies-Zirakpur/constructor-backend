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

## 🧪 Testing with Bruno

The repository includes a ready-to-run [Bruno](https://www.usebruno.com/) collection inside the `bruno/` directory:

| Folder | Endpoints Covered |
| :--- | :--- |
| `bruno/Auth/` | `Register`, `Login`, `Request OTP`, `Verify OTP`, `Reset Password`, `Refresh Token`, `Logout`, `Get Me` |
| `bruno/Users/` | `List All Users`, `Create User`, `Admin Update User`, `Deactivate User`, `Get Profile`, `Update Profile` |
| `bruno/Projects/` | `Create Project`, `List Projects Admin`, `My Projects`, `Get Project`, `Update Project`, `Get Stats` |
| `bruno/Site-Engineers/` | `Create Site Engineer`, `List Site Engineers`, `My Profile`, `Get Site Engineer`, `Get Stats` |
| `bruno/Attendance/` | `Site Check In`, `Site Check Out`, `Create Labour Record`, `Get Labour Records`, `List Attendance` |
| `bruno/Materials/` | `Create Material`, `List Materials`, `Record Transaction`, `List Site Transactions`, `Get Stock`, `Update Status` |
| `bruno/Expenses/` | `Record Expense`, `List Expenses`, `Get Expense`, `Update Expense` |

### Environment Setup in Bruno
Set the Bruno environment variables:
- `baseUrl`: `http://localhost:3000`
- `token`: dynamically populated via login / verify-otp post-response scripts.
- `accessToken`: alias used in bearer token authorization headers.
