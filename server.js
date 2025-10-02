const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const sportsRoutes = require('./routes/sports');
const gamesRoutes = require('./routes/games');
const bettingRoutes = require('./routes/betting');
// Import models
const User = require('./models/User');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Seed default admin user from environment variables (if provided)
async function ensureAdminUser() {
  try {
    const adminEmail = (process.env.ADMIN_EMAIL || '').toLowerCase();
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminFullName = process.env.ADMIN_FULLNAME || 'Admin';
    const adminUsername = (process.env.ADMIN_USERNAME || '').trim();

    if (!adminEmail || !adminPassword) {
      // Skip if no credentials provided via env
      return;
    }

    let existing = await User.findOne({ email: adminEmail }).select('+password');
    if (!existing) {
      const adminUser = new User({
        fullName: adminFullName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
        ...(adminUsername && { username: adminUsername })
      });
      await adminUser.save();
      console.log(`👑 Admin user created: ${adminEmail}${adminUsername ? ` (username: ${adminUsername})` : ''}`);
    } else {
      // Ensure role is admin (do not overwrite password here unless you explicitly want to)
      let changed = false;
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        changed = true;
      }
      if (adminUsername && existing.username !== adminUsername) {
        existing.username = adminUsername;
        changed = true;
      }
      if (changed) {
        try {
          await existing.save({ validateBeforeSave: false });
          console.log(`👑 Existing user updated/promoted to admin: ${adminEmail}${adminUsername ? ` (username: ${adminUsername})` : ''}`);
        } catch (e) {
          if (e.code === 11000) {
            console.warn('⚠️  Could not set admin username due to duplicate username.');
          } else {
            throw e;
          }
        }
      }
    }
  } catch (e) {
    console.error('Admin seeding error:', e.message);
  }
}

ensureAdminUser();

// Middleware

// CORS configuration
const allowedOrigins = [
  process.env.CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://localhost:5173',
  'https://localhost:5174',
  'https://localhost:5175',
].filter(Boolean);

// const corsOptions = {
//   origin: (origin, callback) => {
//     // Allow non-browser or same-origin requests (no origin)
//     if (!origin) return callback(null, true);

//     if (allowedOrigins.includes(origin)) {
//       return callback(null, true);
//     }

//     // Additionally allow preview URLs from common hosts if configured via env
//     const extra = (process.env.CORS_EXTRA_ORIGINS || '')
//       .split(',')
//       .map(s => s.trim())
//       .filter(Boolean);
//     if (extra.includes(origin)) {
//       return callback(null, true);
//     }

//     // Reject others in production, but allow in development to ease local testing
//     if ((process.env.NODE_ENV || 'development') !== 'production') {
//       return callback(null, true);
//     }

//     return callback(new Error(`CORS not allowed from origin: ${origin}`));
//   },
//   credentials: true,
//   optionsSuccessStatus: 200,
//   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
//   allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
// };
// app.use(cors(corsOptions));

app.use(cors());
// Explicitly handle preflight for all routes
app.options('*', cors());

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Request logging middleware (development only)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
console.log('Loading routes...');
app.use('/api/auth', authRoutes);
console.log('Auth routes loaded');
app.use('/api/users', usersRoutes);
console.log('Users routes loaded');
app.use('/api/sports', sportsRoutes);
console.log('Sports routes loaded');
app.use('/api/games', gamesRoutes);
console.log('Games routes loaded');
app.use('/api/betting', bettingRoutes);
console.log('Betting routes loaded');

// Root endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Welcome to Bibet888 API',
    version: '1.0.0',
    documentation: '/api/docs'
  });
});

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: {
      auth: '/api/auth',
      users: '/api/users',
      sports: '/api/sports',
      games: '/api/games',
      health: '/health'
    }
  });
});

// Global error handling middleware
app.use((error, req, res, next) => {
  console.error('Global error handler:', error);
  
  // Mongoose validation error
  if (error.name === 'ValidationError') {
    const errors = Object.values(error.errors).map(err => ({
      field: err.path,
      message: err.message
    }));
    
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors
    });
  }
  
  // Mongoose duplicate key error
  if (error.code === 11000) {
    const field = Object.keys(error.keyValue)[0];
    return res.status(409).json({
      success: false,
      message: `${field} already exists`
    });
  }
  
  // JWT errors
  if (error.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
  
  if (error.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired'
    });
  }
  
  // Default error
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  });
});

// Start server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running in ${process.env.NODE_ENV || 'development'} mode`);
  console.log(`📡 Server listening on port ${PORT}`);
  console.log(`🌐 API available at: http://localhost:${PORT}`);
  console.log(`❤️  Health check: http://localhost:${PORT}/health`);
  console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
  console.log('\n📋 Available endpoints:');
  console.log('   POST /api/auth/register - Register new user');
  console.log('   POST /api/auth/login - Login user');
  console.log('   GET  /api/auth/profile - Get user profile (protected)');
  console.log('   GET  /api/auth/verify - Verify token (protected)');
  console.log('   POST /api/auth/logout - Logout user (protected)');
  console.log('\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Process terminated');
  });
});

module.exports = app;