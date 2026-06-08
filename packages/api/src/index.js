import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { apiRateLimit } from './middleware/rateLimit.js';
import { requireAuth } from './middleware/auth.js';
import appRoutes from './routes/app.js';
import keywordRoutes from './routes/keyword.js';
import competitorRoutes from './routes/competitor.js';
import asoRoutes from './routes/aso.js';
import { startRankTracker } from './jobs/cron-rank-tracker.js';

const app = express();
const PORT = process.env.API_PORT || 3001;

app.use(morgan('dev'));
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(apiRateLimit);

app.use('/api/app', requireAuth, appRoutes);
app.use('/api/keywords', requireAuth, keywordRoutes);
app.use('/api/keyword', requireAuth, keywordRoutes);
app.use('/api/competitor', requireAuth, competitorRoutes);
app.use('/api/aso', requireAuth, asoRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, error: err.message });
});

startRankTracker();

app.listen(PORT, () => {
  console.log(`ASO API running on http://localhost:${PORT}`);
});

export default app;
