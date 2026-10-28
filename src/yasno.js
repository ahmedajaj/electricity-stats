// Collects the planned outage schedule (ДТЕК Київ, via the Yasno API) for our group.
// Yasno keeps no history, so every run stores a new revision whenever the
// schedule for a day changes. Output: data/schedule.json
//
// {
//   "group": "37.1",
//   "days": {
//     "2026-10-23": [
//       { "fetchedAt": "…", "updatedOn": "…", "status": "ScheduleApplies",
//         "slots": [{ "start": 0, "end": 210, "type": "Definite" }, …] },
//       …newer revisions
//     ]
//   }
// }
//
// slots: minutes from Kyiv midnight; "Definite" = planned outage.
// status other than "ScheduleApplies" (e.g. "EmergencyShutdowns",
// "WaitingForSchedule") means the hourly schedule is not in force.

const fs = require('fs');
const path = require('path');

const API_URL = 'https://app.yasno.ua/api/blackout-service/public/shutdowns/regions/25/dsos/902/planned-outages';
const GROUP = '37.1';
const SCHEDULE_FILE = path.join(__dirname, '../data/schedule.json');

function load() {
    if (!fs.existsSync(SCHEDULE_FILE)) return { group: GROUP, days: {} };
    return JSON.parse(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
}

/** Comparable fingerprint of a day's plan */
function fingerprint(rev) {
    return JSON.stringify([rev.status, rev.slots.map(s => [s.start, s.end, s.type])]);
}

async function collectSchedule() {
    const res = await fetch(API_URL, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) throw new Error(`Yasno HTTP ${res.status}`);
    const data = await res.json();
    const group = data[GROUP];
    if (!group) throw new Error(`Yasno response has no group ${GROUP}`);

    const store = load();
    const fetchedAt = new Date().toISOString();
    let added = 0;

    for (const day of [group.today, group.tomorrow]) {
        if (!day || !day.date) continue;
        const key = day.date.slice(0, 10); // "2026-10-23T00:00:00+03:00" → Kyiv date
        const rev = {
            fetchedAt,
            updatedOn: group.updatedOn || null,
            status: day.status,
            slots: (day.slots || []).map(s => ({ start: s.start, end: s.end, type: s.type })),
        };
        const revisions = store.days[key] || (store.days[key] = []);
        const last = revisions[revisions.length - 1];
        if (!last || fingerprint(last) !== fingerprint(rev)) {
            revisions.push(rev);
            added++;
        }
    }

    if (added > 0) {
        // Stable key order keeps the file diff-friendly
        store.days = Object.fromEntries(Object.entries(store.days).sort(([a], [b]) => a.localeCompare(b)));
        fs.writeFileSync(SCHEDULE_FILE, JSON.stringify(store, null, 2));
    }

    const today = store.days[group.today?.date?.slice(0, 10)];
    return { added, todayStatus: group.today?.status, todayRevisions: today ? today.length : 0 };
}

module.exports = { collectSchedule, SCHEDULE_FILE, GROUP };

if (require.main === module) {
    collectSchedule()
        .then(r => console.log(`✓ Schedule ${GROUP}: ${r.added ? `${r.added} new revision(s)` : 'no changes'} | today ${r.todayStatus}, ${r.todayRevisions} revision(s)`))
        .catch(e => {
            console.error('❌ Schedule error:', e.message);
            process.exit(1);
        });
}
