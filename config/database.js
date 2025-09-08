const mongoose = require('mongoose');
require('dotenv').config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);

    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.log('\n📝 MongoDB Setup Instructions:');
    console.log('1. Install MongoDB Community Server from: https://www.mongodb.com/try/download/community');
    console.log('2. Start MongoDB service:');
    console.log('   - Windows: net start MongoDB (run as administrator)');
    console.log('   - macOS: brew services start mongodb/brew/mongodb-community');
    console.log('   - Linux: sudo systemctl start mongod');
    console.log('3. Or use MongoDB Atlas (cloud): https://www.mongodb.com/atlas');
    console.log('4. Update MONGODB_URI in .env file with your connection string\n');
    
    // Don't exit in development, allow server to run without DB
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    } else {
      console.log('⚠️  Running in development mode without database connection');
    }
  }
};

// Handle connection events
mongoose.connection.on('connected', () => {
  console.log('Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  console.error('Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('Mongoose disconnected');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('MongoDB connection closed through app termination');
  process.exit(0);
});

module.exports = connectDB;