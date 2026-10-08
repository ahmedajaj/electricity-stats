const express = require('express');
const path = require('path');
const { getEvents } = require('./eventSource');

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

app.get('/api/health', (req, res) => res.json({ ok: true }));

// Built frontend (cd web && npm run build). Hashed assets can be cached forever.
app.use('/assets', express.static(path.join(WEB_DIST, 'assets'), { immutable: true, maxAge: '1y' }));
app.use(express.static(WEB_DIST, { index: 'index.html', maxAge: 0 }));

app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
});
