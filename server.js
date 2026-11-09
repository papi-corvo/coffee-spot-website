// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');

// Import the auth routes
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/auth');
const adminRoutes = require('./src/routes/admin');
const menuRoutes = require('./src/routes/menu');
const { verifyAdmin } = require('./src/middleware/adminMiddleware');
const { verifyToken } = require('./src/middleware/authMiddleware');

// 1. Initialize Express
const app = express();

// 2. Middleware to read JSON from the frontend
app.use(express.json());

app.use(cookieParser());
app.use('/api/auth', authRoutes);

// Protect all admin routes with the verifyAdmin bouncer
app.use('/api/admin', verifyAdmin, adminRoutes); 

// Connect your Menu Routes
app.use('/api/menu', menuRoutes);

// 3. Serve your frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// Protect the Cashier HTML
app.get('/cashier', verifyToken, (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'views', 'employeeView.html'));
});

// Protect the Admin Dashboard HTML
app.get('/admin', verifyAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'src', 'views', 'admin.html'));
});

// 4. Connect your API Routes
const orderRoutes = require('./src/routes/orders');
app.use('/api/orders', orderRoutes);

// 5. Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});