// Read-only access to the events list and the planned-schedule archive for the web server.
// Primary source is the public Gist; the local data/events.json (written by the
// scraper) is the fallback. Never writes to disk.
const fs = require('fs');
const path = require('path');

const GIST_RAW = 'https://gist.githubusercontent.com/ahmedajaj/f73208e345aee68d11c31c4d1f8c32f7/raw';
const GIST_RAW_URL = `${GIST_RAW}/events.json`;
const LOCAL_FILE = path.join(__dirname, '../data/events.json');
const SCHEDULE_FILE = path.join(__dirname, '../data/schedule.json');
const CACHE_MS = 60 * 1000;

let cache = null;
let cacheTime = 0;

function isValid(events) {
    return Array.isArray(events) && events.every(e => typeof e.date === 'string' && (e.status === 'on' || e.status === 'off'));
}

async function fromGist() {
    // Cache-busting query: the raw Gist CDN otherwise serves stale copies for minutes
    const res = await fetch(`${GIST_RAW_URL}?t=${Date.now()}`, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Gist HTTP ${res.status}`);
    const events = await res.json();
    if (!isValid(events)) throw new Error('Gist returned unexpected data');
    return events;
}

function fromLocal() {
    const events = JSON.parse(fs.readFileSync(LOCAL_FILE, 'utf8'));
    if (!isValid(events)) throw new Error('Local events.json has unexpected data');
    return events;
}

async function getEvents() {
    if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

    try {
        cache = await fromGist();
    } catch (error) {
        console.error(`Gist unavailable (${error.message}), using local file`);
        cache = fromLocal();
    }
    cacheTime = Date.now();
    return cache;
}

let scheduleCache = null;
let scheduleCacheTime = 0;

/** Planned-schedule archive (see yasno.js). Local file first: the collector runs on the same machine */
async function getSchedule() {
    if (scheduleCache && Date.now() - scheduleCacheTime < CACHE_MS) return scheduleCache;

    let schedule;
    if (fs.existsSync(SCHEDULE_FILE)) {
        schedule = JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
    } else {
        const res = await fetch(`${GIST_RAW}/schedule.json?t=${Date.now()}`, { signal: AbortSignal.timeout(10_000) });
        if (!res.ok) throw new Error(`Gist HTTP ${res.status}`);
        schedule = await res.json();
    }
    if (!schedule || typeof schedule.days !== 'object') throw new Error('Schedule has unexpected format');

    scheduleCache = schedule;
    scheduleCacheTime = Date.now();
    return schedule;
}

module.exports = { getEvents, getSchedule };
