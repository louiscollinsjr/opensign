/*
 * Simple Express server for Opensign backend
 */
require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const envelopesRoutes = require('./routes/envelopes');
const signRoutes = require('./routes/sign');

const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error('Missing MONGODB_URI');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/status', (req, res) => {
  res.json({ service: 'opensign-backend', db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' });
});

app.use('/api/auth', authRoutes);
app.use('/api/envelopes', envelopesRoutes);
app.use('/api/sign', signRoutes);

async function start() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    const server = app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });

    const shutdown = async () => {
      console.log('Shutting down...');
      server.close();
      // Mongoose v8: close() no longer accepts a callback — use the promise form
      await mongoose.connection.close();
      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();
