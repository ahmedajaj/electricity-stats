const express = require('express');
const path = require('path');
const dataStore = require('./dataStore');
const { exec } = require('child_process');

require('dotenv').config({ path: path.join(__dirname, '../data/.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes

// Get all events
app.get('/api/events', async (req, res) => {
    try {
        const events = await dataStore.getEvents();
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get events by date range
app.get('/api/events/range', (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const events = dataStore.getEventsByDateRange(startDate, endDate);
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get statistics for date range
app.get('/api/statistics', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const stats = await dataStore.calculateStatistics(startDate, endDate);
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Get daily statistics
app.get('/api/statistics/daily', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'startDate and endDate are required' });
        }

        const dailyStats = await dataStore.getDailyStatistics(startDate, endDate);
        res.json(dailyStats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Trigger data update
app.post('/api/update', (req, res) => {
    exec('node src/scraper.js', (error, stdout, stderr) => {
        if (error) {
            return res.status(500).json({ error: 'Failed to update data', details: error.message });
        }
        res.json({ message: 'Data update completed' });
    });
});

// Get summary statistics
app.get('/api/summary', async (req, res) => {
    try {
        const events = await dataStore.getEvents();
        
        if (events.length === 0) {
            return res.json({
                totalEvents: 0,
                firstEvent: null,
                lastEvent: null,
                dateRange: null
            });
        }

        const firstEvent = events[0];
        const lastEvent = events[events.length - 1];

        // Get statistics for last 7 days
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);

        const weekStats = await dataStore.calculateStatistics(startDate.toISOString(), endDate.toISOString());

        // Get statistics for last 30 days
        const monthStart = new Date();
        monthStart.setDate(monthStart.getDate() - 30);
        const monthStats = await dataStore.calculateStatistics(monthStart.toISOString(), endDate.toISOString());

        res.json({
            totalEvents: events.length,
            firstEvent: firstEvent,
            lastEvent: lastEvent,
            dateRange: {
                start: firstEvent.date,
                end: lastEvent.date
            },
            last7Days: {
                onHours: weekStats.totalOnTime / (1000 * 60 * 60),
                offHours: weekStats.totalOffTime / (1000 * 60 * 60),
                percentageOn: weekStats.percentageOn,
                percentageOff: weekStats.percentageOff
            },
            last30Days: {
                onHours: monthStats.totalOnTime / (1000 * 60 * 60),
                offHours: monthStats.totalOffTime / (1000 * 60 * 60),
                percentageOn: monthStats.percentageOn,
                percentageOff: monthStats.percentageOff
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
    console.log(`✓ Server running on http://localhost:${PORT}`);
    console.log(`✓ Environment: ${process.env.NODE_ENV || 'development'}`);
});
