// svitlobot keeps no history, so the server samples the area on/off shares itself every 5 minutes
// and keeps the last 30 days in data/area-history.json.

const fs = require('fs');
const path = require('path');
const { getAreaStats } = require('./areaStats');

const FILE = path.join(__dirname, '../data/area-history.json');
const SAMPLE_MS = 5 * 60 * 1000;
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** { ids: [areaId...], rows: [[timestamp, share | null, ...]] } — shares in the order of ids */
let history = load();

function load() {
    try {
        const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
        if (Array.isArray(data.ids) && Array.isArray(data.rows)) return data;
    } catch (error) {
        if (error.code !== 'ENOENT') console.error('Failed to read area history:', error.message);
    }
    return { ids: [], rows: [] };
}

function save() {
    const tmp = `${FILE}.tmp`;
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(tmp, JSON.stringify(history));
    fs.renameSync(tmp, FILE);
}

async function sample() {
    try {
        const stats = await getAreaStats();
        const ids = stats.areas.map(a => a.id);
        // Area list changed: re-map old rows so their columns line up with the new ids
        if (ids.join() !== history.ids.join()) {
            const old = history.ids;
            history = {
                ids,
                rows: history.rows.map(([t, ...shares]) => [t, ...ids.map(id => (old.includes(id) ? shares[old.indexOf(id)] : null))]),
            };
        }
        const round = s => (s == null ? null : Math.round(s * 1000) / 1000);
        history.rows.push([stats.updatedAt, ...stats.areas.map(a => round(a.onShare))]);
        const cutoff = Date.now() - KEEP_MS;
        history.rows = history.rows.filter(r => r[0] >= cutoff);
        save();
    } catch (error) {
        console.error('Failed to sample area stats:', error.message);
    }
}

function startSampling() {
    sample();
    setInterval(sample, SAMPLE_MS).unref();
}

/** Samples newer than `sinceMs` */
function getAreaHistory(sinceMs) {
    return { ids: history.ids, rows: history.rows.filter(r => r[0] >= sinceMs) };
}

module.exports = { startSampling, getAreaHistory };
