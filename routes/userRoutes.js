const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { validateUser } = require('../middleware/userValidator');

// Route for adding a new user
router.post('/add', validateUser, userController.addUser);
// Route to get all users (Password excluded)
router.get('/all', userController.getAllUsers);
// Route to toggle status
router.patch('/:userId/status', userController.toggleUserStatus);

// Route for updating a user
router.put('/:userId', userController.updateUser);

module.exports = router;