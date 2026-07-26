# InterviewReady API Documentation

## Base URL
```
Development: http://localhost:5000/api/v1
Production: https://api.interviewready.com/api/v1
```

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Response Format

### Success Response
```json
{
  "status": "success",
  "message": "Operation successful",
  "data": { ... }
}
```

### Error Response
```json
{
  "status": "fail",
  "message": "Error message",
  "errors": [ ... ]
}
```

### Paginated Response
```json
{
  "status": "success",
  "message": "Data retrieved",
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 100,
    "totalPages": 10,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

## Status Codes

- `200` - OK
- `201` - Created
- `204` - No Content
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `422` - Unprocessable Entity
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Authentication Endpoints

### Register User
Create a new user account.

**Endpoint:** `POST /auth/register`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePass123!",
  "phone": "+1234567890"
}
```

**Response:** `201 Created`
```json
{
  "status": "success",
  "message": "Registration successful. Please verify your email.",
  "data": {
    "user": {
      "_id": "user-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isEmailVerified": false
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

**Validation Rules:**
- `firstName`: Required, 2-50 characters
- `lastName`: Required, 2-50 characters
- `email`: Required, valid email format
- `password`: Required, min 8 characters, must contain uppercase, lowercase, number, and special character
- `phone`: Optional, valid phone format

**Rate Limit:** 3 requests per hour

---

### Login
Authenticate user and receive tokens.

**Endpoint:** `POST /auth/login`

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Login successful",
  "data": {
    "user": {
      "_id": "user-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user"
    },
    "tokens": {
      "accessToken": "jwt-access-token",
      "refreshToken": "jwt-refresh-token"
    }
  }
}
```

**Rate Limit:** 5 requests per 15 minutes

---

### Logout
Invalidate current session.

**Endpoint:** `POST /auth/logout`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Logout successful",
  "data": null
}
```

---

### Refresh Token
Get new access token using refresh token.

**Endpoint:** `POST /auth/refresh-token`

**Request Body:**
```json
{
  "refreshToken": "jwt-refresh-token"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Token refreshed successfully",
  "data": {
    "tokens": {
      "accessToken": "new-jwt-access-token",
      "refreshToken": "new-jwt-refresh-token"
    }
  }
}
```

---

### Get Current User
Retrieve authenticated user's profile.

**Endpoint:** `GET /auth/me`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "User retrieved successfully",
  "data": {
    "user": {
      "_id": "user-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "role": "user",
      "isEmailVerified": true,
      "avatar": "avatar-url",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

---

### Verify Email
Verify user's email address.

**Endpoint:** `GET /auth/verify-email/:token`

**Parameters:**
- `token`: Email verification token (from email link)

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Email verified successfully",
  "data": null
}
```

---

### Resend Verification Email
Request new verification email.

**Endpoint:** `POST /auth/resend-verification`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Verification email sent successfully",
  "data": null
}
```

**Rate Limit:** 5 requests per hour

---

### Forgot Password
Request password reset link.

**Endpoint:** `POST /auth/forgot-password`

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "If the email exists, a password reset link has been sent",
  "data": null
}
```

**Rate Limit:** 3 requests per hour

---

### Reset Password
Reset password using token.

**Endpoint:** `POST /auth/reset-password/:token`

**Parameters:**
- `token`: Password reset token (from email link)

**Request Body:**
```json
{
  "password": "NewSecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Password reset successful",
  "data": null
}
```

---

### Change Password
Change password for authenticated user.

**Endpoint:** `PUT /auth/change-password`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewSecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Password changed successfully",
  "data": null
}
```

---

### Update Profile
Update user profile information.

**Endpoint:** `PUT /auth/profile`

**Headers:** `Authorization: Bearer <token>`

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "bio": "Software Engineer",
  "location": "New York, USA",
  "timezone": "America/New_York",
  "avatar": "https://example.com/avatar.jpg"
}
```

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Profile updated successfully",
  "data": {
    "user": { ... }
  }
}
```

---

### Delete Account
Soft delete user account.

**Endpoint:** `DELETE /auth/account`

**Headers:** `Authorization: Bearer <token>`

**Response:** `200 OK`
```json
{
  "status": "success",
  "message": "Account deleted successfully",
  "data": null
}
```

---

## Error Codes

### Authentication Errors
- `AUTH_001` - Invalid credentials
- `AUTH_002` - Token expired
- `AUTH_003` - Invalid token
- `AUTH_004` - Account locked
- `AUTH_005` - Email not verified
- `AUTH_006` - Account deactivated

### Validation Errors
- `VAL_001` - Missing required field
- `VAL_002` - Invalid format
- `VAL_003` - Value out of range
- `VAL_004` - Duplicate entry

### Payment Errors
- `PAY_001` - Payment failed
- `PAY_002` - Invalid payment method
- `PAY_003` - Insufficient funds
- `PAY_004` - Refund not allowed

### Booking Errors
- `BOOK_001` - Slot not available
- `BOOK_002` - Cannot cancel booking
- `BOOK_003` - Booking not found
- `BOOK_004` - Invalid booking status

---

## Rate Limiting

Rate limits are applied per IP address and per user (when authenticated).

### Limits by Endpoint Type
- **Authentication:** 5 requests per 15 minutes
- **Registration:** 3 requests per hour
- **Password Reset:** 3 requests per hour
- **Email Verification:** 5 requests per hour
- **General API:** 100 requests per 15 minutes
- **Payment:** 10 requests per 15 minutes
- **File Upload:** 20 requests per 15 minutes

### Rate Limit Headers
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640000000
```

---

## Webhooks

### Razorpay Webhook
Receive payment notifications from Razorpay.

**Endpoint:** `POST /webhooks/razorpay`

**Headers:**
- `X-Razorpay-Signature`: Webhook signature

**Events:**
- `payment.captured` - Payment successful
- `payment.failed` - Payment failed
- `refund.processed` - Refund completed

---

## Socket.IO Events

### Client to Server
- `join_booking` - Join booking room
- `leave_booking` - Leave booking room
- `typing` - User is typing
- `stop_typing` - User stopped typing
- `notification_read` - Mark notification as read

### Server to Client
- `notification` - New notification
- `booking_update` - Booking status changed
- `payment_update` - Payment status changed
- `interview_reminder` - Interview reminder
- `user_typing` - Another user is typing
- `user_stop_typing` - Another user stopped typing

---

## Best Practices

1. **Always use HTTPS** in production
2. **Store tokens securely** (httpOnly cookies or secure storage)
3. **Implement token refresh** before expiration
4. **Handle rate limits** gracefully
5. **Validate input** on client side
6. **Handle errors** appropriately
7. **Use pagination** for large datasets
8. **Implement retry logic** for failed requests
9. **Log errors** for debugging
10. **Monitor API usage** and performance

---

## Support

For API support:
- Email: api-support@interviewready.com
- Documentation: https://docs.interviewready.com
- Status Page: https://status.interviewready.com

---

**Last Updated:** 2024-01-01
**API Version:** v1.0.0