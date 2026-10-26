// src/routes/orders.js
const express = require('express');
const router = express.Router();
const orderService = require('../db/orders'); // Points to src/db/orders.js

// POST: Customer places an order
router.post('/', (req, res) => {
  try {
    // req.body contains the JSON sent by the frontend
    const newOrder = orderService.createOrder(req.body);
    res.status(201).json(newOrder);
  } catch (error) {
    console.error("Order creation failed:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// GET: Cashier fetches orders
router.get('/', (req, res) => {
  try {
    const orders = orderService.listOrders({ status: req.query.status });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;