# Bibet888 Backend API

A Node.js Express backend with MongoDB for the Bibet888 betting platform.

## Features

- 🔐 JWT Authentication (Login/Register)
- 🛡️ Password hashing with bcrypt
- 📝 Input validation with express-validator
- 🗄️ MongoDB with Mongoose ODM
- 🌐 CORS enabled for frontend integration
- 🔒 Security headers and middleware
- 📊 Health check endpoint
- 🚀 Development server with nodemon

## Prerequisites

- Node.js (v14 or higher)
- MongoDB (local installation or MongoDB Atlas)
- npm or yarn

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment variables:**
   Copy the `.env` file and update the values:
   ```bash
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   
   # Database Configuration
   MONGODB_URI=mongodb://localhost:27017/bibet888
   
   # JWT Configuration
   JWT_SECRET=your_super_secret_jwt_key_here_change_in_production
   JWT_EXPIRE=7d
   
   # CORS Configuration
   CLIENT_URL=http://localhost:5173
   
   # Security
   BCRYPT_SALT_ROUNDS=12
   ```

3. **Set up MongoDB:**

   **Option A: Local MongoDB**
   - Download and install [MongoDB Community Server](https://www.mongodb.com/try/download/community)
   - Start MongoDB service:
     - Windows: `net start MongoDB` (run as administrator)
     - macOS: `brew services start mongodb/brew/mongodb-community`
     - Linux: `sudo systemctl start mongod`

   **Option B: MongoDB Atlas (Cloud)**
   - Create account at [MongoDB Atlas](https://www.mongodb.com/atlas)
   - Create a cluster and get connection string
   - Update `MONGODB_URI` in `.env` file

## Running the Server

**Development mode (with auto-restart):**
```bash
npm run dev
```

**Production mode:**
```bash
npm start
```

The server will start on `http://localhost:5000`

## API Endpoints

### Authentication Routes (`/api/auth`)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/register` | Register new user | No |
| POST | `/login` | Login user | No |
| GET | `/profile` | Get user profile | Yes |
| GET | `/verify` | Verify JWT token | Yes |
| POST | `/logout` | Logout user | Yes |

### Health Check

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Server health status |
| GET | `/` | API information |

## API Usage Examples

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Login User
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "Password123"
  }'
```

### Get Profile (Protected)
```bash
curl -X GET http://localhost:5000/api/auth/profile \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Project Structure

```
backend/
├── config/
│   └── database.js          # MongoDB connection
├── controllers/
│   └── authController.js    # Authentication logic
├── middleware/
│   └── auth.js              # JWT middleware
├── models/
│   └── User.js              # User schema
├── routes/
│   └── auth.js              # Authentication routes
├── .env                     # Environment variables
├── package.json             # Dependencies
├── server.js                # Main server file
└── README.md                # This file
```

## Security Features

- 🔐 JWT token authentication
- 🛡️ Password hashing with bcrypt (12 rounds)
- 📝 Input validation and sanitization
- 🌐 CORS configuration
- 🔒 Security headers (XSS, CSRF protection)
- 🚫 Rate limiting ready
- 📊 Request logging in development

## Error Handling

- Global error handler for consistent responses
- Mongoose validation errors
- JWT token errors
- Database connection errors
- 404 handler for undefined routes

## Development

**File watching:** The server uses nodemon for automatic restarts during development.

**Logging:** Request logging is enabled in development mode.

**Environment:** Set `NODE_ENV=production` for production deployment.

## Frontend Integration

This backend is designed to work with the React frontend located in the `../src` directory. Make sure to:

1. Update `CLIENT_URL` in `.env` to match your frontend URL
2. Use the JWT token in frontend requests
3. Handle authentication state in your React app

## Troubleshooting

**MongoDB Connection Issues:**
- Ensure MongoDB is running
- Check connection string in `.env`
- Verify network connectivity

**CORS Issues:**
- Update `CLIENT_URL` in `.env`
- Check frontend URL matches CORS configuration

**JWT Issues:**
- Ensure `JWT_SECRET` is set
- Check token format in Authorization header
- Verify token hasn't expired

## License

ISC License - Bibet888 Team