import { Router } from 'express';
import { loginUser, registerUser, refreshAccessToken, logoutUser, updateProfile, viewProfile, GetCurrentUser } from '../controllers/user.controller.js';
import { verifyJWT } from '../middleware/auth.middleware.js'; // Middleware to protect routes
import { upload } from '../middleware/multer.middleware.js'; // Middleware for file uploads (e.g., avatars)

const router = Router();

// User registration
router.post('/register', upload.single('avatar'), registerUser);

// User login
router.post('/login', loginUser);

// Refresh access token
router.post('/refresh-token', refreshAccessToken);

// User logout
router.post('/logout', verifyJWT, logoutUser);

// Profile Update

router.patch('update-profile', updateProfile);

// View Profile
router.get('/profile/:id', viewProfile)

router.get('/dashboard/:id', GetCurrentUser)

export default router;
