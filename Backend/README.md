# InterviewReady Backend API

A production-ready Node.js backend for the InterviewReady platform with Express.js, MongoDB, Redis, JWT Authentication, OAuth (Google & GitHub), Socket.IO, Razorpay integration, and comprehensive features.

## 🚀 Features

- **Authentication & Authorization**
  - JWT-based authentication with access and refresh tokens
  - Google OAuth 2.0 integration
  - GitHub OAuth integration
  - Role-based access control (User, Interviewer, Admin)
  - Email verification
  - Password reset functionality
  - Account lockout after failed login attempts

- **User Management**
  - User registration and profile management
  - Interviewer profiles with expertise and availability
  - User preferences and settings

- **Booking System**
  - Schedule mock interviews
  - Real-time availability checking
  - Booking cancellation and rescheduling
  - Interview reminders
  - Feedback and ratings

- **Payment Integration**
  - Razorpay payment gateway
  - Secure payment processing
  - Refund management
  - Payment history and receipts
  - Webhook handling

- **Subscription Management**
  - Multiple subscription plans (Basic, Pro, Premium)
  - Auto-renewal support
  - Usage tracking
  - Expiry notifications

- **Review System**
  - User reviews for interviewers
  - Rating system (1-5 stars)
  - Verified reviews
  - Interviewer responses

- **Real-time Notifications**
  - Socket.IO integration
  - Real-time booking updates
  - Payment notifications
  - Interview reminders
  - System announcements

- **Admin Dashboard**
  - User management
  - Interviewer approval
  - Payment monitoring
  - Analytics and reports

- **Security Features**
  - Helmet.js for security headers
  - Rate limiting
  - MongoDB injection prevention
  - XSS protection
  - CORS configuration
  - Input validation and sanitization

- **Performance & Scalability**
  - Redis caching
  - Database indexing
  - Compression
  - Connection pooling
  - Horizontal scaling ready

## 📋 Prerequisites

- Node.js >= 18.0.0
- MongoDB >= 5.0
- Redis >= 6.0
- npm >= 9.0.0

## 🛠️ Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Backend
```

2. **Install dependencies**
```bash
npm install
```

3. **Environment Configuration**
```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/interviewready

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret

# Razorpay
RAZORPAY_KEY_ID=your-razorpay-key
RAZORPAY_KEY_SECRET=your-razorpay-secret
```

4. **Start the server**

Development mode:
```bash
npm run dev
```

Production mode:
```bash
npm start
```

## 🐳 Docker Setup

1. **Using Docker Compose**
```bash
docker-compose up -d
```

This will start:
- Node.js application
- MongoDB
- Redis
- Mongo Express (optional, for database management)
- Redis Commander (optional, for Redis management)

2. **Access services**
- API: http://localhost:5000
- Mongo Express: http://localhost:8081
- Redis Commander: http://localhost:8082

3. **Stop services**
```bash
docker-compose down
```

## 📁 Project Structure

```
Backend/
├── src/
│   ├── config/           # Configuration files
│   │   ├── index.js      # Main config
│   │   ├── database.js   # MongoDB connection
│   │   └── redis.js      # Redis connection
│   ├── controllers/      # Request handlers
│   │   └── authController.js
│   ├── middleware/       # Custom middleware
│   │   ├── auth.js       # Authentication
│   │   ├── errorHandler.js
│   │   └── rateLimiter.js
│   ├── models/           # Mongoose models
│   │   ├── User.js
│   │   ├── Interviewer.js
│   │   ├── Booking.js
│   │   ├── Payment.js
│   │   ├── Subscription.js
│   │   ├── Review.js
│   │   └── Notification.js
│   ├── routes/           # API routes
│   │   └── authRoutes.js
│   ├── services/         # Business logic
│   │   ├── paymentService.js
│   │   └── socketService.js
│   ├── utils/            # Utility functions
│   │   ├── errors.js
│   │   ├── jwt.js
│   │   ├── logger.js
│   │   ├── response.js
│   │   └── validation.js
│   ├── app.js            # Express app
│   └── server.js         # Server entry point
├── logs/                 # Application logs
├── .env.example          # Environment variables template
├── .gitignore
├── docker-compose.yml
├── Dockerfile
├── package.json
└── README.md
```

## 🔌 API Endpoints

### Authentication
```
POST   /api/v1/auth/register              - Register new user
POST   /api/v1/auth/login                 - Login user
POST   /api/v1/auth/logout                - Logout user
POST   /api/v1/auth/refresh-token         - Refresh access token
GET    /api/v1/auth/me                    - Get current user
GET    /api/v1/auth/verify-email/:token   - Verify email
POST   /api/v1/auth/resend-verification   - Resend verification email
POST   /api/v1/auth/forgot-password       - Request password reset
POST   /api/v1/auth/reset-password/:token - Reset password
PUT    /api/v1/auth/change-password       - Change password
PUT    /api/v1/auth/profile               - Update profile
DELETE /api/v1/auth/account               - Delete account
```

### Health Check
```
GET    /health                            - Server health status
```

## 🔐 Authentication

The API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header:

```
Authorization: Bearer <your-token>
```

### Token Types
- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

## 🎯 Role-Based Access Control

Three user roles are supported:
- **User**: Regular users who book interviews
- **Interviewer**: Conduct interviews and provide feedback
- **Admin**: Full system access and management

## 📊 Database Models

### User
- Authentication credentials
- Profile information
- Role and permissions
- OAuth integration
- Email verification
- Password reset tokens

### Interviewer
- Expertise and experience
- Hourly rates
- Availability schedule
- Ratings and reviews
- Earnings tracking
- Verification status

### Booking
- User and interviewer references
- Schedule details
- Interview type and expertise
- Status tracking
- Feedback and ratings
- Payment reference

### Payment
- Razorpay integration
- Transaction details
- Refund management
- Payment status
- Webhook handling

### Subscription
- Plan details
- Usage tracking
- Auto-renewal
- Expiry management

### Review
- Rating (1-5 stars)
- Comments and feedback
- Aspect ratings
- Verification status

### Notification
- Real-time notifications
- Multiple notification types
- Read/unread status
- Priority levels

## 🔄 Real-time Features (Socket.IO)

### Events
- `connection` - User connects
- `disconnect` - User disconnects
- `notification` - New notification
- `booking_update` - Booking status change
- `payment_update` - Payment status change
- `interview_reminder` - Interview reminder

### Usage
```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'your-jwt-token'
  }
});

socket.on('notification', (data) => {
  console.log('New notification:', data);
});
```

## 💳 Payment Integration (Razorpay)

### Create Order
```javascript
POST /api/v1/payments/create-order
{
  "bookingId": "booking-id",
  "amount": 1000
}
```

### Verify Payment
```javascript
POST /api/v1/payments/verify
{
  "paymentId": "payment-id",
  "razorpayPaymentId": "razorpay-payment-id",
  "razorpaySignature": "signature"
}
```

## 📝 Logging

Logs are stored in the `logs/` directory:
- `application-YYYY-MM-DD.log` - All logs
- `error-YYYY-MM-DD.log` - Error logs only

Log levels: error, warn, info, debug

## 🧪 Testing

```bash
# Run tests
npm test

# Run tests with coverage
npm test -- --coverage

# Run tests in watch mode
npm run test:watch
```

## 🚀 Deployment

### Environment Variables
Ensure all required environment variables are set in production:
- `NODE_ENV=production`
- `JWT_SECRET` (strong secret key)
- `MONGODB_URI` (production database)
- `REDIS_HOST` (production Redis)
- All OAuth credentials
- Razorpay credentials

### Production Checklist
- [ ] Set strong JWT secrets
- [ ] Configure production database
- [ ] Set up Redis cluster
- [ ] Configure CORS for production domain
- [ ] Enable HTTPS
- [ ] Set up monitoring and logging
- [ ] Configure backup strategy
- [ ] Set up CI/CD pipeline
- [ ] Enable rate limiting
- [ ] Configure email service

## 🔧 Scripts

```bash
npm start          # Start production server
npm run dev        # Start development server with nodemon
npm test           # Run tests
npm run lint       # Run ESLint
npm run lint:fix   # Fix ESLint errors
npm run format     # Format code with Prettier
```

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB Documentation](https://docs.mongodb.com/)
- [Redis Documentation](https://redis.io/documentation)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Razorpay Documentation](https://razorpay.com/docs/)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Support

For support, email support@interviewready.com or join our Slack channel.

## 🔄 Version History

- **v1.0.0** - Initial release with core features
  - Authentication & Authorization
  - Booking System
  - Payment Integration
  - Real-time Notifications
  - Admin Dashboard

---

Built with ❤️ by the InterviewReady Team