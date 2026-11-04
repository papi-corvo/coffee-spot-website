// server.js
const express = require('express');
const path = require('path');

// Import the auth routes
const cookieParser = require('cookie-parser');
const authRoutes = require('./src/routes/auth');

// 1. Initialize Express
const app = express();

// 2. Middleware to read JSON from the frontend
app.use(express.json());

app.use(cookieParser());
app.use('/api/auth', authRoutes);

// 3. Serve your frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// 4. Connect your API Routes
const orderRoutes = require('./src/routes/orders');
app.use('/api/orders', orderRoutes);

// 5. Start the server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});