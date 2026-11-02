const express = require('express');
const router = express.Router();
const orderService = require('../db/orders');

// POST: Customer places an order
router.post('/', (req, res) => {
  try {
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

// GET a single order by code
router.get('/:code', (req, res) => {
  try {
    const order = orderService.getOrder(req.params.code);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST a payment for an order
router.post('/:code/pay', (req, res) => {
  try {
    const paidOrder = orderService.payOrder(req.params.code, req.body);
    res.json(paidOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// POST: Update order status (Accept, Reject, Void)
router.post('/:code/status', (req, res) => {
  try {
    const { status, reason, staffId } = req.body;
    const updatedOrder = orderService.setStatus(req.params.code, status, { reason, staffId });
    res.json(updatedOrder);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;