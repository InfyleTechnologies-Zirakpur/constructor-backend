---
trigger: always_on
description: Core architectural, coding, testing, and formatting guidelines for the Construction Platform backend. All agents MUST follow this before writing or editing code.
---

# Construction Platform Development Guidelines

These rules are derived from the `Construction_Platform_Developer_Technical_Brief.pdf` and represent the source of truth for backend development on this project. 

As an AI agent, you **MUST** adhere to these guidelines for all code generation, refactoring, and testing.

## 1. Architecture & Folder Structure
- **Framework**: NestJS (Modular Monolith architecture).
- **Module Structure**: All business logic goes inside `src/modules/<module-name>/`.
- **Internal Module Layout**:
  - `controller.ts`: HTTP route definitions only.
  - `service.ts`: Core business rules and database orchestration.
  - `dto/`: Data Transfer Objects for request validation.
  - `entities/`: TypeORM entities representing database tables.
  - `tests/`: Module-specific unit and integration tests.
- **Calculations & Logic**: Financial calculations (costing, profit), access rules, and status transitions MUST happen in backend services. Never trust client-submitted calculations.

## 2. Database (PostgreSQL & TypeORM)
- **IDs & Timestamps**: Use server-generated UUIDs (`@PrimaryGeneratedColumn('uuid')`) and standard timestamps (`createdAt`, `updatedAt`).
- **Monetary Values**: Store monetary values using a fixed-precision numeric/decimal strategy rather than floating point.
- **Files**: Store S3 uploaded file metadata in PostgreSQL. The binary file remains in AWS S3. Do not expose raw S3 credentials.

## 3. API Design & Security
- **Endpoints**: Follow RESTful API conventions.
- **Responses**: Use consistent HTTP status codes (200, 201, 400, 401, 403, 404, etc.) and a consistent error object format.
- **Validation**: Strict input validation using DTOs (`class-validator` and `class-transformer`).
- **Security**: 
  - Every protected API must validate the user's JWT.
  - Apply RBAC (Role-Based Access Control) using guards.
  - Site Engineers can only access their assigned project/site data. Contractors can only access their authorized projects.

## 4. Linting & Formatting
- **Formatter**: Prettier. Run `yarn format` to format files automatically.
- **Linter**: Oxlint. Run `yarn lint` to check for code quality issues.
- Do NOT ignore linting errors. If Oxlint complains, fix the code.

## 5. Testing Strategy
Whenever you create or modify a feature, ensure corresponding tests are written or updated.
- **API Client Testing (Bruno)**: Whenever you create or update an API endpoint, you MUST create or update a corresponding `.bru` file in the `bruno/` directory for API documentation and testing.
- **Unit Tests**: Focus on calculation logic, permissions, status transitions, and custom validators.
- **API Tests**: Focus on Auth, RBAC, CRUD operations, input validation, pagination, and error handling.
- **Integration Tests**: Ensure PostgreSQL, Redis (BullMQ), S3, and FCM (Firebase) integrations work as expected.
- Run tests using `yarn test` (Vitest).

## General Agent Workflow & Strict Rules
1. **Always Check Code First**: Do NOT write code blindly. Read existing implementations to understand context, architecture, and current status before taking action.
2. **No Unnecessary Code**: Write clean, concise code. Do not add boilerplate or generic features unless explicitly required by the Technical Brief.
3. **Bruno Files Mandate**: You MUST create and update `.bru` files for every single endpoint you touch. No exceptions.
4. **Testing Mandate**: You MUST write tests for every module/feature you build.
5. **Linting Mandate**: You MUST run `yarn lint` and fix all errors before presenting your work.
6. When creating a feature, strictly follow this sequence:
   - Check if module exists.
   - Generate DTOs and Entities.
   - Write Service business logic.
   - Write Controller routing.
   - Write Unit/Integration Tests.
   - Create Bruno `.bru` endpoints.
   - Run `yarn format`, `yarn lint`, and `yarn build`.