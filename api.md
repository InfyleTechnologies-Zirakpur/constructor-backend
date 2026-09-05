# BuildHire Worker API

Backend handoff for the Flutter worker app in this repository.

## 1. Base URL

The Flutter app currently uses:

```text
https://api.buildhire.example/v1
```

This is a placeholder. Replace it in `lib/core/api/api_config.dart` when the real API is available. All paths below are relative to the base URL.

Example:

```text
POST https://api.buildhire.example/v1/auth/request-otp
```

The app uses Dio and sends JSON by default:

```http
Content-Type: application/json
Accept: application/json
```

## 2. Authentication

### Login flow

1. `POST /auth/request-otp` sends an OTP to a phone number.
2. `POST /auth/verify-otp` verifies the OTP and returns an access token.
3. The app should send that token on every protected request.

Recommended header:

```http
Authorization: Bearer <accessToken>
```

The current dummy API accepts requests without authentication. The real backend should protect every route marked `Protected` below.

### Important current Flutter status

- The Flutter client currently does **not** attach the bearer token automatically. `ApiClient` contains the integration point for this.
- The Flutter client currently does **not** use cookies or a cookie jar.
- Prefer bearer authentication for this mobile app. Do not require a session cookie unless the Flutter client is changed to persist and send cookies.
- The access token should be returned as `accessToken` from login. Do not put the token inside the worker object.
- Recommended token expiry: return an `expiresIn` value in seconds. The current client does not require it, but it is useful for the eventual refresh-token implementation.

Login response data example:

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 3600,
  "worker": {
    "id": "worker_1",
    "name": "Ravi Kumar",
    "phone": "9876543210",
    "city": "Bathinda, Punjab",
    "skills": ["Electrician", "Safety Training"],
    "profilePhotoUrl": null,
    "documents": [],
    "salaryExpectation": "₹900/day"
  }
}
```

## 3. Response envelope

Every successful response must use this shape:

```json
{
  "success": true,
  "message": "Success",
  "data": {}
}
```

For errors, use HTTP status codes and this shape:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "phone": ["Phone must be a valid 10-digit number"]
  }
}
```

Recommended status codes:

| Status | Use |
|---|---|
| `200` | Successful read, update, or action |
| `201` | Resource created |
| `400` | Invalid request |
| `401` | Missing or expired bearer token |
| `403` | Authenticated but not allowed |
| `404` | Resource does not exist |
| `409` | Duplicate/conflicting action, such as applying twice |
| `422` | Field validation failure |
| `500` | Unexpected server error |

## 4. Endpoint summary

`Protected` means the request must include `Authorization: Bearer <accessToken>`.

| Method | Path | Auth | Flutter status |
|---|---|---|---|
| `POST` | `/auth/request-otp` | Public | Used now |
| `POST` | `/auth/verify-otp` | Public | Used now |
| `POST` | `/auth/reset-password` | Public | Used now |
| `GET` | `/jobs` | Protected | Used now |
| `POST` | `/jobs/{jobId}/save` | Protected | Used now; toggles saved state |
| `POST` | `/jobs/{jobId}/applications` | Protected | Used now |
| `GET` | `/profile` | Protected | Used now |
| `PUT` | `/profile` | Protected | Used now |
| `POST` | `/profile/photo` | Protected | Used now; multipart |
| `POST` | `/documents` | Protected | Used now; multipart |
| `POST` | `/attendance/check-in` | Protected | Used now |
| `POST` | `/attendance/check-out` | Protected | Used now |
| `GET` | `/attendance` | Protected | Used now |
| `GET` | `/dashboard` | Protected | Used now |
| `GET` | `/conversations` | Protected | Used now |
| `POST` | `/conversations/{conversationId}/messages` | Protected | Used now |
| `GET` | `/notifications` | Protected | Used now |
| `PATCH` | `/notifications/{notificationId}` | Protected | Used now |
| `GET` | `/jobs/{jobId}` | Protected | Optional; not called currently |
| `GET` | `/saved-jobs` | Protected | Optional; not called currently |
| `GET` | `/applications` | Protected | Optional; not called currently |
| `GET` | `/documents` | Protected | Optional; not called currently |
| `DELETE` | `/documents/{documentId}` | Protected | Optional; not called currently |

## 5. Public authentication endpoints

### Request OTP

```http
POST /auth/request-otp
Content-Type: application/json
```

Request:

```json
{
  "phone": "9876543210"
}
```

Success `data`:

```json
{
  "otpSent": true,
  "message": "OTP sent successfully"
}
```

The OTP should be six digits. In development, the dummy UI may use `123456`.

### Verify OTP / login

```http
POST /auth/verify-otp
Content-Type: application/json
```

Request:

```json
{
  "phone": "9876543210",
  "otp": "123456"
}
```

Success `data` must include `accessToken` and `worker` as shown in the authentication section.

### Reset password

```http
POST /auth/reset-password
Content-Type: application/json
```

Request:

```json
{
  "phone": "9876543210",
  "otp": "123456",
  "newPassword": "new-password"
}
```

Success `data`:

```json
{
  "changed": true
}
```

## 6. Jobs

### List jobs

```http
GET /jobs
Authorization: Bearer <accessToken>
```

Supported query parameters:

| Parameter | Type | Example |
|---|---|---|
| `search` | string | `electrician` |
| `location` | string | `Bathinda` |
| `minDailyPay` | integer | `800` |
| `skill` | string | `Wiring` |
| `projectType` | string | `Full-time` |
| `experienceLevel` | string | `Experienced` |

The current Flutter repository sends only `search` when a search query is entered, but the other filters should be supported by the backend.

Success `data`:

```json
{
  "items": [
    {
      "id": "job_1",
      "title": "Site Electrician",
      "company": "Vertex Builders",
      "location": "Bathinda, Punjab",
      "dailyPay": 850,
      "skills": ["Electrical", "Wiring"],
      "description": "Install, maintain, and repair electrical systems on an active construction site while following site safety procedures.",
      "requirements": [
        "2+ years of electrical work",
        "Ability to read basic wiring diagrams",
        "Valid safety training certificate"
      ],
      "saved": false,
      "applied": false,
      "projectType": "Full-time",
      "experienceLevel": "Experienced"
    }
  ],
  "total": 1
}
```

`dailyPay` must be a JSON number, preferably an integer in the local currency unit per day. `saved` and `applied` must always be booleans.

`description` is the full job-detail paragraph shown in the Flutter detail sheet. `requirements` is the list rendered below it. Both fields should be returned on every job, including list responses, because the current app opens details directly from a list item without a separate detail request. Return an empty string or empty array only when the employer has not supplied that content.

### Save or unsave a job

```http
POST /jobs/{jobId}/save
Authorization: Bearer <accessToken>
```

No request body. The current Flutter UI uses this as a toggle. Return the updated job in `data`:

```json
{
  "id": "job_1",
  "title": "Site Electrician",
  "company": "Vertex Builders",
  "location": "Bathinda, Punjab",
  "dailyPay": 850,
  "skills": ["Electrical", "Wiring"],
  "saved": true,
  "applied": false,
  "projectType": "Full-time",
  "experienceLevel": "Experienced"
}
```

### Apply for a job

```http
POST /jobs/{jobId}/applications
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Current request:

```json
{
  "coverNote": "I am interested in this job."
}
```

The backend may accept additional optional application fields such as `experience`, `summary`, or `availability` without rejecting the current request.

Success `data`:

```json
{
  "id": "app_1",
  "jobId": "job_1",
  "status": "pending",
  "coverNote": "I am interested in this job."
}
```

Use a conflict response if the worker has already applied to the same job.

## 7. Worker profile and files

### Get profile

```http
GET /profile
Authorization: Bearer <accessToken>
```

Success `data`:

```json
{
  "id": "worker_1",
  "name": "Ravi Kumar",
  "phone": "9876543210",
  "city": "Bathinda, Punjab",
  "skills": ["Electrician", "Safety Training"],
  "profilePhotoUrl": null,
  "documents": [],
  "salaryExpectation": "₹900/day"
}
```

### Update profile

```http
PUT /profile
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The app sends only changed fields. Accept partial updates and return the complete updated profile.

Example request:

```json
{
  "name": "Ravi Kumar",
  "city": "Bathinda, Punjab",
  "skills": ["Electrician", "Safety Training"],
  "salaryExpectation": "₹900/day"
}
```

Supported profile fields currently used by the app are `name`, `phone`, `city`, `skills`, `salaryExpectation`, `profilePhotoUrl`, and `documents`. Keep `phone` read-only unless the backend has a separate phone-verification flow.

### Upload profile photo

```http
POST /profile/photo
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

Multipart field:

| Field | Type | Required |
|---|---|---|
| `photo` | file | Yes |

Success `data`:

```json
{
  "profilePhotoUrl": "https://cdn.example.com/workers/worker_1/profile.jpg"
}
```

### Upload document

```http
POST /documents
Authorization: Bearer <accessToken>
Content-Type: multipart/form-data
```

Multipart fields:

| Field | Type | Required | Allowed values |
|---|---|---|---|
| `file` | file | Yes | PDF or image |
| `type` | string | Yes | `aadhaar`, `experience`, `skill` |

Success `data`:

```json
{
  "id": "doc_1",
  "type": "aadhaar",
  "name": "aadhaar.pdf",
  "url": "https://cdn.example.com/documents/doc_1.pdf",
  "verificationStatus": "pending",
  "uploadedAt": "2026-08-03T09:00:00Z"
}
```

## 8. Attendance

### Check in

```http
POST /attendance/check-in
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request sent by the current app:

```json
{
  "latitude": 30.210,
  "longitude": 74.945
}
```

The backend may also accept the optional `projectId`:

```json
{
  "latitude": 30.210,
  "longitude": 74.945,
  "projectId": "project_1"
}
```

Success `data`:

```json
{
  "id": "att_1",
  "date": "2026-08-03",
  "checkIn": "09:05 AM",
  "checkOut": null,
  "hours": "0h 00m",
  "overtime": "0h",
  "status": "present"
}
```

### Check out

```http
POST /attendance/check-out
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request has the same latitude and longitude fields. Return the updated attendance record. Return `409` or `400` with the standard error envelope if there is no open check-in.

### Attendance list

```http
GET /attendance?month=2026-08
Authorization: Bearer <accessToken>
```

`month` is optional and uses `YYYY-MM`.

Success `data`:

```json
{
  "items": [
    {
      "id": "att_1",
      "date": "2026-08-03",
      "checkIn": "09:05 AM",
      "checkOut": "06:12 PM",
      "hours": "9h 07m",
      "overtime": "1h 07m",
      "status": "present"
    }
  ],
  "summary": {
    "days": 24,
    "overtime": "5h"
  }
}
```

The current Flutter parser requires at least `date`, `checkIn`, `checkOut`, and `hours` on each item. `checkOut` may be `null` while the worker is checked in.

## 9. Dashboard

```http
GET /dashboard
Authorization: Bearer <accessToken>
```

Success `data`:

```json
{
  "activeProjects": 1,
  "appliedJobs": 4,
  "workingHours": "42h 30m",
  "attendance": "24 days",
  "notifications": [
    "Your profile is 80% complete",
    "New electrician job near you"
  ]
}
```

## 10. Conversations and messages

### List conversations

```http
GET /conversations
Authorization: Bearer <accessToken>
```

Success `data`:

```json
{
  "items": [
    {
      "id": "conv_1",
      "company": "Vertex Builders",
      "jobTitle": "Site Electrician",
      "lastMessage": "Can you join the site visit tomorrow?",
      "lastMessageAt": "10:32 AM",
      "unreadCount": 2,
      "messages": [
        {
          "id": "m1",
          "text": "Hello Ravi, we reviewed your application.",
          "isMine": false,
          "time": "10:20 AM"
        }
      ]
    }
  ]
}
```

Each message must contain `id`, `text`, `isMine`, and `time`. `unreadCount` must be an integer.

### Send message

```http
POST /conversations/{conversationId}/messages
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Request:

```json
{
  "text": "Thank you. I am available tomorrow."
}
```

Success `data`:

```json
{
  "sent": true
}
```

## 11. Notifications

### List notifications

```http
GET /notifications
Authorization: Bearer <accessToken>
```

Success `data`:

```json
{
  "items": [
    {
      "id": "note_1",
      "title": "New electrician job near you",
      "body": "Vertex Builders posted a Site Electrician role in Bathinda.",
      "type": "job",
      "time": "10 min ago",
      "isRead": false
    }
  ]
}
```

### Mark notification as read

```http
PATCH /notifications/{notificationId}
Authorization: Bearer <accessToken>
Content-Type: application/json
```

The current Flutter app sends:

```json
{
  "isRead": true
}
```

Success `data` is the updated notification object. Use the exact field name `isRead`; the older contract used `read`, but the current Flutter client sends `isRead`.

## 12. Optional routes for the next Flutter integration

These routes are listed in the original contract but are not currently called by `WorkerRepository`:

### Job details

```http
GET /jobs/{jobId}
Authorization: Bearer <accessToken>
```

Return one complete `Job` object.

### Saved jobs

```http
GET /saved-jobs
Authorization: Bearer <accessToken>
```

Return:

```json
{
  "items": [/* Job objects */]
}
```

### Applications

```http
GET /applications?status=pending
Authorization: Bearer <accessToken>
```

Return:

```json
{
  "items": [
    {
      "id": "app_1",
      "jobId": "job_1",
      "status": "pending",
      "job": {/* Job object */}
    }
  ]
}
```

### Documents

```http
GET /documents
DELETE /documents/{documentId}
Authorization: Bearer <accessToken>
```

For delete, return:

```json
{
  "deleted": true
}
```

## 13. Backend checklist

- Keep the `{success,message,data}` response envelope on every response.
- Return JSON field names exactly as documented, especially `profilePhotoUrl`, `salaryExpectation`, `isRead`, `dailyPay`, `projectType`, and `experienceLevel`.
- Implement bearer-token authentication; the current app does not use cookies.
- Allow multipart uploads using the exact fields `photo`, `file`, and `type`.
- Return the complete updated profile after `PUT /profile`.
- Treat save as a toggle because the current app calls the same `POST` endpoint for save and unsave.
- Prevent duplicate applications and return a useful `409` error.
- Validate coordinates and reject check-out when there is no open check-in.
- Enable HTTPS in every non-local environment.
- Configure CORS only if the API will also be called by a browser; native Android/iOS requests do not require browser CORS configuration.

## 14. Dummy API reference

The in-memory implementation is in `lib/core/api/dummy_api_interceptor.dart`. It is enabled by:

```dart
static const bool useDummyApi = true;
```

To connect the real backend:

1. Set `useDummyApi` to `false`.
2. Replace `ApiConfig.baseUrl` with the deployed API URL.
3. Persist the `accessToken` returned by `/auth/verify-otp`.
4. Attach `Authorization: Bearer <accessToken>` in `ApiClient` before protected requests.
5. Keep the response envelope and field names unchanged so the repositories and BLoCs continue to work.
