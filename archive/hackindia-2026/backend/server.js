const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(cors());
app.use(express.json());

// Basic routes
app.get('/', (req, res) => {
  res.send({ status: 'AROHHAN Backend is running' });
});

app.post('/api/sensors/data', (req, res) => {
  const data = req.body;
  // Trigger AI analysis logic here (placeholder)
  const severity = (data.gasLevel > 300) ? 'CRITICAL' : 'SAFE';
  
  // Broadcast to frontend
  io.emit('sensor_update', data);
  if (severity === 'CRITICAL') {
    io.emit('hazard_alert', { type: 'GAS_LEAK', node: data.nodeId, severity });
  }

  res.status(200).json({ success: true, severity });
});

// Socket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Mock live data stream for demo purposes
  const interval = setInterval(() => {
    socket.emit('sensor_update', {
      nodeId: 'ESP-ZoneA',
      temperature: 25 + Math.random() * 5,
      gasLevel: 40 + Math.random() * 10,
      timestamp: new Date().toISOString()
    });
  }, 3000);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    clearInterval(interval);
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 AROHHAN Backend listening on port ${PORT}`);
});
