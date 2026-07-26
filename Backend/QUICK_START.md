# Quick Start Guide

Get the InterviewReady backend up and running in minutes!

## 🚀 Quick Setup (5 minutes)

### Option 1: Using Docker (Recommended)

1. **Clone and navigate to the project**
```bash
cd Backend
```

2. **Create environment file**
```bash
cp .env.example .env
```

3. **Start all services with Docker**
```bash
docker-compose up -d
```

4. **Verify services are running**
```bash
docker-compose ps
```

5. **Check API health**
```bash
curl http://localhost:5000/health
```

✅ **Done!** Your API is running at `http://localhost:5000`

---

### Option 2: Local Development

1. **Prerequisites**
   - Node.js 18+ installed
   - MongoDB running locally
   - Redis running locally

2. **Install dependencies**
```bash
npm install
```

3. **Create environment file**
```bash
cp .env.example .env
```

4. **Update .env with your local settings**
```env
MONGODB_URI=mongodb://localhost:27017/interviewready
REDIS_HOST=localhost
REDIS_PORT=6379
```

5. **Start the server**
```bash
npm run dev
```

✅ **Done!** Your API is running at `http://localhost:5000`

---

## 🧪 Test the API

### 1. Health Check
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "success",
  "message": "Server is running",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 123.45,
  "environment": "development"
}
```

### 2. Register a User
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

### 3. Login
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }'
```

Save the `accessToken` from the response!

### 4. Get Current User
```bash
curl http://localhost:5000/api/v1/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

---

## 🔧 Configuration

### Essential Environment Variables

```env
# Server
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/interviewready

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT (Generate strong secrets!)
JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-this

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Generate Strong Secrets

```bash
# Generate JWT secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

---

## 📊 Access Management Tools

### MongoDB (Mongo Express)
- URL: http://localhost:8081
- Username: admin
- Password: admin123

### Redis (Redis Commander)
- URL: http://localhost:8082

**Note:** These tools are only available when using Docker with the `tools` profile:
```bash
docker-compose --profile tools up -d
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port 5000
lsof -i :5000  # macOS/Linux
netstat -ano | findstr :5000  # Windows

# Kill the process or change PORT in .env
```

### MongoDB Connection Error
```bash
# Check if MongoDB is running
docker-compose ps mongo

# View MongoDB logs
docker-compose logs mongo

# Restart MongoDB
docker-compose restart mongo
```

### Redis Connection Error
```bash
# Check if Redis is running
docker-compose ps redis

# View Redis logs
docker-compose logs redis

# Restart Redis
docker-compose restart redis
```

### Module Not Found
```bash
# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

---

## 📝 Common Commands

### Docker Commands
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# Restart a service
docker-compose restart app

# Rebuild containers
docker-compose up -d --build

# Remove all containers and volumes
docker-compose down -v
```

### Development Commands
```bash
# Start development server
npm run dev

# Run tests
npm test

# Check code style
npm run lint

# Fix code style
npm run lint:fix

# Format code
npm run format
```

---

## 🎯 Next Steps

1. **Configure OAuth**
   - Set up Google OAuth credentials
   - Set up GitHub OAuth credentials
   - Update `.env` with OAuth credentials

2. **Configure Razorpay**
   - Create Razorpay account
   - Get API keys
   - Update `.env` with Razorpay credentials

3. **Set up Email Service**
   - Configure SMTP settings
   - Test email verification
   - Test password reset emails

4. **Explore the API**
   - Read [`API_DOCUMENTATION.md`](./API_DOCUMENTATION.md)
   - Test endpoints with Postman or curl
   - Check out Socket.IO events

5. **Customize**
   - Modify models as needed
   - Add custom routes
   - Implement additional features

---

## 📚 Documentation

- [README.md](./README.md) - Complete documentation
- [API_DOCUMENTATION.md](./API_DOCUMENTATION.md) - API reference
- [QUICK_START.md](./QUICK_START.md) - This guide

---

## 🆘 Need Help?

- Check the [README](./README.md) for detailed information
- Review [API Documentation](./API_DOCUMENTATION.md)
- Check logs in `logs/` directory
- Open an issue on GitHub

---

## ✅ Verification Checklist

- [ ] Server starts without errors
- [ ] Health check endpoint responds
- [ ] Can register a new user
- [ ] Can login with credentials
- [ ] Can access protected endpoints with token
- [ ] MongoDB is connected
- [ ] Redis is connected
- [ ] Logs are being written

---

**Happy Coding! 🚀**