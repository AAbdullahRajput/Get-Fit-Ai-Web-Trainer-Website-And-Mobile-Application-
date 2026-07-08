const express = require('express');
const router = express.Router();
const { signup, login, forgotPassword, verifyRecoveryCode, updatePassword, checkTrainerEmail, getProfile, updateProfile, googleOAuth } = require('../controllers/authController');

// POST /api/auth/signup
router.post('/signup', signup);

// POST /api/auth/login
router.post('/login', login);

// POST /api/auth/google-oauth
router.post('/google-oauth', googleOAuth);


// POST /api/auth/forgot-password
router.post('/forgot-password', forgotPassword);

// POST /api/auth/verify-recovery-code
router.post('/verify-recovery-code', verifyRecoveryCode);

// POST /api/auth/update-password
router.post('/update-password', updatePassword);

// POST /api/auth/check-email
router.post('/check-email', checkTrainerEmail);

// GET /api/auth/profile
router.get('/profile', getProfile);

// PUT /api/auth/profile
router.put('/profile', updateProfile);

module.exports = router;
