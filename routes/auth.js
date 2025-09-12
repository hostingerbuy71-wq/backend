const express = require('express');
const { body, oneOf } = require('express-validator');
const { register, login, getProfile, logout } = require('../controllers/authController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const registerValidation = [
  body('fullName').trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2 and 50 characters').matches(/^[a-zA-Z\s]+$/).withMessage('Full name can only contain letters and spaces'),
  body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
  body('password').isLength({ min: 3 }).withMessage('Password must be at least 3 characters long'),
  body('username').optional().isLength({ min: 3, max: 30 }).withMessage('Username must be 3-30 characters')
];

const loginValidation = [
  oneOf([
    body('email').isEmail().normalizeEmail(),
    body('username').isLength({ min: 3 })
  ], 'Please provide a valid email or username'),
  body('password').notEmpty().withMessage('Password is required')
];

// Routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.get('/profile', authenticateToken, getProfile);
router.post('/logout', authenticateToken, logout);

// @route   GET /api/auth/verify
router.get('/verify', authenticateToken, (req, res) => {
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

    res.status(200).json({ success: true, message: 'Token is valid', data: { user: userData } });
  } catch (error) {
    console.error('Token verification error:', error);
    res.status(500).json({ success: false, message: 'Token verification failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
});

module.exports = router;