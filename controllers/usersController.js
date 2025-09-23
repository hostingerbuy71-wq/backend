const User = require('../models/User');

// Search users by username or fullName
const searchUsers = async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ 
        success: false, 
        message: 'Search term is required' 
      });
    }

    // Create a regex pattern for case-insensitive search
    const searchPattern = new RegExp(username, 'i');
    
    // Search in both username and fullName fields
    const users = await User.find({
      $or: [
        { username: searchPattern },
        { fullName: searchPattern }
      ]
    }).select('-password').limit(20);

    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: { users }
    });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to search users', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
    });
  }
};

// Create new user (Admin only)
const createUser = async (req, res) => {
  try {
    const { username, password, type, isActive, phone, reference, notes, fullName } = req.body;
    
    // Validate required fields
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [
        { username: username },
        { email: username } // in case username is actually an email
      ]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this username already exists'
      });
    }

    // Create new user
    const newUser = new User({
      username: username,
      fullName: fullName || username,
      email: `${username}@temp.com`, // temporary email, can be updated later
      password: password,
      role: type === 'Admin' ? 'admin' : 'user',
      isActive: isActive || true,
      // Additional fields can be stored in a separate profile collection if needed
      // For now, we'll store them as custom fields
    });

    await newUser.save();

    // Remove password from response
    const userResponse = newUser.toObject();
    delete userResponse.password;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: { user: userResponse }
    });

  } catch (error) {
    console.error('Create user error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: errors
      });
    }

    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'User with this username or email already exists'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get all users (with pagination)
const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    
    const users = await User.find()
      .select('-password')
      .skip(skip)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments();
    
    res.status(200).json({
      success: true,
      message: 'Users retrieved successfully',
      data: {
        users,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalUsers: total,
          hasNext: page < Math.ceil(total / limit),
          hasPrev: page > 1
        }
      }
    });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to retrieve users', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
    });
  }
};

module.exports = {
  searchUsers,
  getAllUsers,
  createUser
};