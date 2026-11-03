const express = require('express');
const path = require('path');
const { getEvents, getSchedule } = require('./eventSource');
const { getAreaStats } = require('./areaStats');
const { startSampling, getAreaHistory } = require('./areaHistory');

require('dotenv').config({ path: path.join(__dirname, '../data/.env'), quiet: true });

const app = express();
const PORT = process.env.PORT || 3000;
const WEB_DIST = path.join(__dirname, '../web/dist');

app.disable('x-powered-by');

// All statistics are computed in the browser from the raw event list
app.get('/api/events', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-cache');
        res.json(await getEvents());
    } catch (error) {
        console.error('Failed to load events:', error.message);
        res.status(503).json({ error: 'Events are unavailable' });
    }
});

app.get('/api/schedule', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-cache');
        res.json(await getSchedule());
    } catch (error) {
        console.error('Failed to load schedule:', error.message);
        res.status(503).json({ error: 'Schedule is unavailable' });
    }
});

app.get('/api/areas', async (req, res) => {
    try {
        res.set('Cache-Control', 'no-cache');
        res.json(await getAreaStats());
    } catch (error) {
        console.error('Failed to load area stats:', error.message);
        res.status(503).json({ error: 'Area stats are unavailable' });
    }
});

// Sampled every 5 minutes by the server itself; ?days=1..30 (default 7)
app.get('/api/areas/history', (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 30);
    res.set('Cache-Control', 'no-cache');
    res.json(getAreaHistory(Date.now() - days * 24 * 60 * 60 * 1000));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Built frontend (cd web && npm run build). Hashed assets can be cached forever.
app.use('/assets', express.static(path.join(WEB_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(WEB_DIST, { index: 'index.html', maxAge: 0 }));

app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    startSampling();
});
