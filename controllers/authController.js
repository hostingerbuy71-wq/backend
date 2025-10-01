const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateToken } = require('../middleware/auth');

// Register new user
const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { fullName, email, password, username } = req.body;

    // Check if user already exists (email)
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    // Optional: ensure username unique if provided
    if (username) {
      const existingUsername = await User.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }
    }

    const user = new User({ fullName, email, password, username });
    await user.save();

    const token = generateToken(user._id);
    await user.updateLastLogin();

    const userData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({ success: true, message: 'User registered successfully', data: { user: userData, token } });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Registration failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

// Admin create user (only admin can create users)
const adminCreateUser = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    // Check if the requesting user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Access denied. Admin privileges required.' });
    }

    const { fullName, email, password, username, role = 'user' } = req.body;

    // Check if user already exists (email)
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'User with this email already exists' });
    }

    // Optional: ensure username unique if provided
    if (username) {
      const existingUsername = await User.findByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ success: false, message: 'Username is already taken' });
      }
    }

    const user = new User({ fullName, email, password, username, role });
    await user.save();

    const userData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt
    };

    res.status(201).json({ 
      success: true, 
      message: 'User created successfully by admin', 
      data: { user: userData } 
    });
  } catch (error) {
    console.error('Admin user creation error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'User creation failed', 
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
    });
  }
};

// Login user (email or username)
const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: 'Validation failed', errors: errors.array() });
    }

    const { email, username, password } = req.body;

    let userQuery = null;
    if (email) {
      userQuery = User.findByEmail(email).select('+password');
    } else if (username) {
      userQuery = User.findByUsername(username).select('+password');
    } else {
      return res.status(400).json({ success: false, message: 'Email or username is required' });
    }

    const user = await userQuery;
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (!user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is deactivated. Please contact support.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);
    await user.updateLastLogin();

    const userData = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      username: user.username,
      role: user.role,
      isActive: user.isActive,
      lastLogin: user.lastLogin,
      createdAt: user.createdAt
    };

    res.status(200).json({ success: true, message: 'Login successful', data: { user: userData, token } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: 'Login failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

// Get current user profile
const getProfile = async (req, res) => {
  try {
    const userData = {
      id: req.user._id,
      fullName: req.user.fullName,
      email: req.user.email,
      username: req.user.username,
      role: req.user.role,
      isActive: req.user.isActive,
      lastLogin: req.user.lastLogin,
      createdAt: req.user.createdAt
    };

    res.status(200).json({ success: true, message: 'Profile retrieved successfully', data: { user: userData } });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Failed to retrieve profile', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

// Logout user (client-side token removal)
const logout = async (req, res) => {
  try {
    res.status(200).json({ success: true, message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ success: false, message: 'Logout failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

module.exports = { register, login, getProfile, logout, adminCreateUser };