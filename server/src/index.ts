import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import type { User, CalendarEvent } from '@shared/types';

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

import authRoutes from './routes/auth';
import apiRoutes from './routes/api';

// Middleware
app.use(cors({
  origin: CLIENT_URL,
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', apiRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Shared Calendar API',
    status: 'running'
  });
});

import { initDatabase } from './db';

app.listen(PORT, () => {
  initDatabase();
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
