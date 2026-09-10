# INFYLE Construction Platform (Backend)

Welcome to the backend repository for the INFYLE Construction Platform! This project is a Modular Monolith built with **NestJS**, **TypeScript**, **PostgreSQL** (via TypeORM), and **Redis**.

It serves as the core backend infrastructure powering:
- The Job Seeker / Worker Mobile App
- The Contractor ERP App
- The Admin Web Panel

## 🚀 Quick Start & Setup

### 1. Installation
Install the project dependencies using `yarn` or `npm`.
```bash
yarn install
```

### 2. Environment Variables
Ensure you have a `.env` file in the root directory configured with your PostgreSQL connection, Redis, and JWT secrets.
```env
DATABASE_URL=postgresql://user:password@localhost:5432/construtor
JWT_SECRET=your_super_secret_key_here
```

### 3. Database Migration & Seeding
The project uses TypeORM `synchronize: true` in development for rapid prototyping. To apply the schema and seed the database with initial dummy users, run the server once, then run the seed script:
```bash
# Terminal 1: Run the dev server to auto-sync the database schema
yarn start:dev

# Terminal 2: Run the seeder to populate dummy users (admin, contractor, etc.)
yarn seed
```

---

## 🛠️ Available Scripts / Commands

Here is a breakdown of all the commands you can run in this project and what they do:

### Development & Execution
- **`yarn start:dev`**: Starts the application in watch mode. It will automatically recompile and restart the server whenever you save a file. (Use this for daily development).
- **`yarn start:debug`**: Starts the app in watch mode with debugging enabled.
- **`yarn start:prod`**: Runs the compiled application from the `dist/` directory. Use this only in production.
- **`yarn build`**: Compiles the TypeScript source code into standard JavaScript in the `dist/` folder.

### Database Operations
- **`yarn seed`**: Executes `src/database/seed.ts` to populate the database with initial testing data (e.g., creating the 5 default user roles).

### Code Quality & Formatting
- **`yarn lint`**: Runs **Oxlint** across the `src/` and `test/` directories to instantly catch unused variables, syntax issues, and bad practices. **Always run this before pushing code.**
- **`yarn format`**: Runs **Prettier** to automatically format all your code to ensure consistent styling, spacing, and quotes.

### Testing
- **`yarn test`**: Runs the **Vitest** testing suite once. (Runs all unit and E2E tests).
- **`yarn test:watch`**: Runs Vitest in watch mode, automatically re-running tests when you modify a file.
- **`yarn test:cov`**: Runs tests and generates a test coverage report to show how much of your code is actually tested.
- **`yarn test:e2e`**: Specifically runs end-to-end tests located in the `test/` directory.

---

## 🏗️ Architecture & Modules

The platform is divided into the following core modules inside `src/modules/`:
- **Auth**: JWT token issuance, session management, and OTP verification.
- **Users**: Central user management and profile updates for all 5 roles.
- **Companies**: Company registration, profiles, and verification workflows.
- **Contractors**: Contractor profiles, verification workflows, and secure document handling.
- **Projects**: Core tracking of contractor projects, with strict contractor ownership isolation.
- **Project-Sites**: Site creation and engineer assignment logic to tightly control access.
- **Site-Engineers**: Profile management and assignment-based access rules for engineers.
- **Jobs & Applications**: Job creation, publishing, applying, shortlisting, and admin moderation features.
- **Calculators**: Specialized civil engineering tools for construction calculations.
- **Attendance**: Daily worker and labor check-ins, attendance history, and cost generation.
- **Materials**: Material master definitions, purchase requests, issues, consumption, and stock tracking.
- **Expenses**: Tracking ad-hoc project and site-level expenses with file attachments.
- **Reports**: Daily operational reports aggregating labor, material, and expense costs against daily revenue to compute server-side profitability.
- **Notifications**: Device token management and event-driven FCM push notifications for all roles.
- **Documents**: Presigned AWS S3 uploads and secure file references.
- **Audit-Logs**: Security and important business activity trailing.

## 🔐 Security (RBAC)
All endpoints are secured using a global `TransformInterceptor` and `AllExceptionsFilter`.
To protect an endpoint, simply use the custom decorators:
```typescript
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('admin', 'contractor')
@Post()
async createProject() { ... }
```
