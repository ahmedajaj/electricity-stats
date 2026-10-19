// Live on/off share for whole Kyiv and for the Osokorky area, from the public
// svitlobot.in.ua map feed (the one https://svitlobot.in.ua/map uses).
// Undocumented API: keep polling gentle (cached here for 2 minutes).

const FEED_URL = 'https://api.svitlobot.in.ua/website/getChannelsForMap';
const CACHE_MS = 2 * 60 * 1000;

// Hand-drawn outline of south Pozniaky / Osokorky (lat, lng)
const OSOKORKY = [
    [50.40029, 30.61470], [50.40015, 30.62656], [50.40217, 30.63095], [50.40289, 30.63447],
    [50.40246, 30.64194], [50.40130, 30.64853], [50.39986, 30.65292], [50.39639, 30.65688],
    [50.39176, 30.65885], [50.38801, 30.65600], [50.38483, 30.64853], [50.38165, 30.63974],
    [50.38107, 30.63227], [50.38194, 30.62217], [50.38541, 30.61118], [50.38859, 30.60459],
    [50.39205, 30.60174], [50.39610, 30.60459], [50.39870, 30.60899],
];

const AREAS = [
    { id: 'osokorky', name: 'Осокорки', match: p => insidePolygon(p.lat, p.lng, OSOKORKY) },
    // Points named "Київ -> …" are the city itself (suburbs like Бровари have their own prefix)
    { id: 'kyiv', name: 'Київ', match: p => p.name.startsWith('Київ ->') },
];

function insidePolygon(lat, lng, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [y1, x1] = poly[i];
        const [y2, x2] = poly[j];
        if ((y1 > lat) !== (y2 > lat) && lng < x1 + ((lat - y1) * (x2 - x1)) / (y2 - y1)) inside = !inside;
    }
    return inside;
}

/** Feed lines: fields separated by ";&&&;" — [1] status (1 on, 2 off, 3/4 no data), [3] name, [6] lat, [7] lng */
function parseFeed(text) {
    const points = [];
    for (const line of text.split('\n')) {
        const f = line.split(';&&&;');
        if (f.length !== 12) continue;
        const point = {
            status: Number(f[1]),
            name: f[3].trim(),
            lat: Number(f[6]),
            lng: Number(f[7]),
        };
        if (Number.isFinite(point.lat) && Number.isFinite(point.lng)) points.push(point);
    }
    return points;
}

function summarize(area, points) {
    const inArea = points.filter(area.match);
    const on = inArea.filter(p => p.status === 1);
    const off = inArea.filter(p => p.status === 2);
    const known = on.length + off.length;
    return {
        id: area.id,
        name: area.name,
        on: on.length,
        off: off.length,
        noData: inArea.length - known,
        onShare: known ? on.length / known : null,
    };
}

let cache = null;
let cacheTime = 0;

async function getAreaStats() {
    if (cache && Date.now() - cacheTime < CACHE_MS) return cache;

    const res = await fetch(FEED_URL, {
        headers: { 'User-Agent': 'electricity-stats (rusovoi 7a)', Referer: 'https://svitlobot.in.ua/map' },
        signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`svitlobot HTTP ${res.status}`);
    const points = parseFeed(await res.text());
    if (points.length === 0) throw new Error('svitlobot feed is empty or changed format');

    const now = Date.now();
    cache = { updatedAt: now, areas: AREAS.map(a => summarize(a, points)) };
    cacheTime = now;
    return cache;
}

module.exports = { getAreaStats };
