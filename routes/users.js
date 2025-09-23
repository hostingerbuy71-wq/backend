const express = require('express');
const { body } = require('express-validator');
const { searchUsers, getAllUsers, createUser } = require('../controllers/usersController');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Validation rules for creating a user
const createUserValidation = [
  body('username').trim().isLength({ min: 3, max: 30 }).withMessage('Username must be between 3 and 30 characters'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters long'),
  body('type').optional().isIn(['Admin', 'Master', 'User']).withMessage('Type must be Admin, Master, or User'),
  body('fullName').optional().trim().isLength({ min: 2, max: 50 }).withMessage('Full name must be between 2 and 50 characters'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean'),
  body('phone').optional().trim(),
  body('reference').optional().trim(),
  body('notes').optional().trim()
];

// Routes
// GET /api/users/search - Search users by username or fullName
router.get('/search', authenticateToken, requireAdmin, searchUsers);

// GET /api/users - Get all users with pagination
router.get('/', authenticateToken, requireAdmin, getAllUsers);

// POST /api/users - Create new user (Admin only)
router.post('/', authenticateToken, requireAdmin, createUserValidation, createUser);

module.exports = router;