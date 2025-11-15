const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../data');
const DATA_FILE = path.join(DATA_DIR, 'events.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, '[]', 'utf8');
}

class DataStore {
    constructor() {
        this.ensureDataDir();
    }

    ensureDataDir() {
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }
        if (!fs.existsSync(DATA_FILE)) {
            fs.writeFileSync(DATA_FILE, JSON.stringify([]));
        }
    }

    getEvents() {
        try {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        } catch (error) {
            return [];
        }
    }

    calculateStatistics(startDate, endDate) {
        const allEvents = this.getEvents();
        const startTimestamp = new Date(startDate + 'T00:00:00+02:00').getTime();
        // Set end date to end of day (23:59:59.999) in Kyiv time
        const endTimestamp = new Date(endDate + 'T23:59:59.999+02:00').getTime();
        
        const events = allEvents.filter(event => {
            return event.timestamp >= startTimestamp && event.timestamp <= endTimestamp;
        });

        // Find the last event BEFORE the start date to know the initial status
        const previousEvent = allEvents
            .filter(e => e.timestamp < startTimestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        // If no events in range and no previous event, nothing to calculate
        if (events.length === 0 && !previousEvent) {
            return {
                totalEvents: 0,
                totalOnTime: 0,
                totalOffTime: 0,
                percentageOn: 0,
                percentageOff: 0,
                events: [],
                periods: []
            };
        }

        let totalOnTime = 0;
        let totalOffTime = 0;
        const periods = [];

        // If there are NO events in range but there IS a previous event,
        // the entire period is in the previous event's status
        if (events.length === 0 && previousEvent) {
            const now = new Date().getTime();
            const actualEnd = Math.min(now, endTimestamp);
            const duration = actualEnd - startTimestamp;
            
            periods.push({
                start: new Date(startTimestamp).toISOString(),
                end: new Date(actualEnd).toISOString(),
                status: previousEvent.status,
                duration: duration
            });
            
            if (previousEvent.status === 'on') {
                totalOnTime += duration;
            } else {
                totalOffTime += duration;
            }
            
            const totalTime = totalOnTime + totalOffTime;
            return {
                totalEvents: 0,
                totalOnTime: totalOnTime,
                totalOffTime: totalOffTime,
                percentageOn: totalTime > 0 ? (totalOnTime / totalTime) * 100 : 0,
                percentageOff: totalTime > 0 ? (totalOffTime / totalTime) * 100 : 0,
                periods: periods,
                events: []
            };
        }

        // If there's a gap before the first event in range, fill it with previous status
        if (previousEvent && events[0].timestamp > startTimestamp) {
            const gapDuration = events[0].timestamp - startTimestamp;
            periods.push({
                start: new Date(startTimestamp).toISOString(),
                end: events[0].date,
                status: previousEvent.status,
                duration: gapDuration
            });
            
            if (previousEvent.status === 'on') {
                totalOnTime += gapDuration;
            } else {
                totalOffTime += gapDuration;
            }
        }

        // Process events in range
        for (let i = 0; i < events.length - 1; i++) {
            const currentEvent = events[i];
            const nextEvent = events[i + 1];
            const duration = nextEvent.timestamp - currentEvent.timestamp;

            periods.push({
                start: currentEvent.date,
                end: nextEvent.date,
                status: currentEvent.status,
                duration: duration
            });

            if (currentEvent.status === 'on') {
                totalOnTime += duration;
            } else {
                totalOffTime += duration;
            }
        }

        // Handle the last event to current time or end date
        const lastEvent = events[events.length - 1];
        const now = new Date().getTime();
        const actualEnd = Math.min(now, endTimestamp);
        const lastDuration = actualEnd - lastEvent.timestamp;
        
        if (lastDuration > 0) {
            periods.push({
                start: lastEvent.date,
                end: new Date(actualEnd).toISOString(),
                status: lastEvent.status,
                duration: lastDuration
            });

            if (lastEvent.status === 'on') {
                totalOnTime += lastDuration;
            } else {
                totalOffTime += lastDuration;
            }
        }

        const totalTime = totalOnTime + totalOffTime;

        return {
            totalEvents: events.length,
            totalOnTime: totalOnTime,
            totalOffTime: totalOffTime,
            percentageOn: totalTime > 0 ? (totalOnTime / totalTime) * 100 : 0,
            percentageOff: totalTime > 0 ? (totalOffTime / totalTime) * 100 : 0,
            periods: periods,
            events: events
        };
    }

    getDailyStatistics(startDate, endDate) {
        const allEvents = this.getEvents();
        const startTimestamp = new Date(startDate + 'T00:00:00+02:00').getTime();
        // Set end date to end of day (23:59:59.999) in Kyiv time
        const endTimestamp = new Date(endDate + 'T23:59:59.999+02:00').getTime();
        
        const events = allEvents.filter(event => {
            return event.timestamp >= startTimestamp && event.timestamp <= endTimestamp;
        });
        
        const dailyStats = {};

        // Initialize all days in range
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dateKey = d.toISOString().split('T')[0];
            dailyStats[dateKey] = {
                date: dateKey,
                onTime: 0,
                offTime: 0,
                events: []
            };
        }
        
        // Find the last event BEFORE the start date to know the initial status
        const previousEvent = allEvents
            .filter(e => e.timestamp < startTimestamp)
            .sort((a, b) => b.timestamp - a.timestamp)[0];

        // If no events in range and no previous event, return empty stats
        if (events.length === 0 && !previousEvent) {
            return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
        }

        // If no events in range but there IS a previous event,
        // fill the entire period with previous status
        if (events.length === 0 && previousEvent) {
            const now = new Date().getTime();
            const actualEnd = Math.min(now, endTimestamp);
            this.distributeDuration(dailyStats, startTimestamp, actualEnd, previousEvent.status);
            
            // Calculate percentages
            Object.keys(dailyStats).forEach(dateKey => {
                const day = dailyStats[dateKey];
                const totalTime = day.onTime + day.offTime;
                day.percentageOn = totalTime > 0 ? (day.onTime / totalTime) * 100 : 0;
                day.percentageOff = totalTime > 0 ? (day.offTime / totalTime) * 100 : 0;
                day.onHours = day.onTime / (1000 * 60 * 60);
                day.offHours = day.offTime / (1000 * 60 * 60);
            });
            
            return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
        }

        // If there's a gap before the first event, fill it with previous status
        if (previousEvent && events[0].timestamp > startTimestamp) {
            this.distributeDuration(
                dailyStats,
                startTimestamp,
                events[0].timestamp,
                previousEvent.status
            );
        }

        // Process events
        for (let i = 0; i < events.length; i++) {
            const currentEvent = events[i];
            const nextEvent = events[i + 1];
            
            const eventDate = new Date(currentEvent.timestamp);
            const dateKey = eventDate.toISOString().split('T')[0];
            
            if (dailyStats[dateKey]) {
                dailyStats[dateKey].events.push(currentEvent);
            }

            if (nextEvent) {
                // Distribute duration from current event to next event
                this.distributeDuration(dailyStats, currentEvent.timestamp, nextEvent.timestamp, currentEvent.status);
            } else {
                // Last event to now (but not beyond current time)
                const now = new Date().getTime();
                const actualEnd = Math.min(now, endTimestamp);
                this.distributeDuration(dailyStats, currentEvent.timestamp, actualEnd, currentEvent.status);
            }
        }

        // Calculate percentages
        Object.keys(dailyStats).forEach(dateKey => {
            const day = dailyStats[dateKey];
            const totalTime = day.onTime + day.offTime;
            day.percentageOn = totalTime > 0 ? (day.onTime / totalTime) * 100 : 0;
            day.percentageOff = totalTime > 0 ? (day.offTime / totalTime) * 100 : 0;
            day.onHours = day.onTime / (1000 * 60 * 60);
            day.offHours = day.offTime / (1000 * 60 * 60);
        });

        return Object.values(dailyStats).sort((a, b) => a.date.localeCompare(b.date));
    }

    distributeDuration(dailyStats, startTime, endTime, status) {
        if (startTime >= endTime) return;

        const startDate = new Date(startTime);
        const endDate = new Date(endTime);

        // Get the start of the day for the startTime in Kyiv time (UTC+2)
        // Kyiv midnight is 22:00 UTC of previous day
        const startDateKyiv = new Date(startTime + 2 * 60 * 60 * 1000);
        let currentDate = new Date(Date.UTC(
            startDateKyiv.getUTCFullYear(), 
            startDateKyiv.getUTCMonth(), 
            startDateKyiv.getUTCDate()
        ));
        // Subtract 2 hours to get back to UTC representation of Kyiv midnight
        currentDate = new Date(currentDate.getTime() - 2 * 60 * 60 * 1000);

        while (currentDate.getTime() < endDate.getTime()) {
            const nextDate = new Date(currentDate.getTime() + 24 * 60 * 60 * 1000);

            const periodStart = Math.max(startTime, currentDate.getTime());
            const periodEnd = Math.min(endTime, nextDate.getTime());
            
            if (periodStart < periodEnd) {
                const duration = periodEnd - periodStart;

                // Get date key in Kyiv timezone
                const dateKeyTime = new Date(currentDate.getTime() + 2 * 60 * 60 * 1000);
                const dateKey = dateKeyTime.toISOString().split('T')[0];
                
                if (dailyStats[dateKey]) {
                    if (status === 'on') {
                        dailyStats[dateKey].onTime += duration;
                    } else {
                        dailyStats[dateKey].offTime += duration;
                    }
                }
            }

            currentDate = nextDate;
        }
    }
}

module.exports = new DataStore();
