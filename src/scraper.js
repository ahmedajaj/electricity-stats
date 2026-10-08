// Scrapes the public web preview of the channel (https://t.me/s/<channel>).
// No Telegram login, API keys or session file needed.
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

require('dotenv').config({ path: path.join(__dirname, '../data/.env'), quiet: true });

const isDev = process.env.NODE_ENV !== 'production';

const channelUsername = 'lvivskiy7a';
const startDate = new Date('2025-10-01T00:00:00');
// Re-scan this far behind the newest stored event, to catch anything missed
const OVERLAP_MS = 2 * 24 * 60 * 60 * 1000;
const MAX_PAGES = 500;

const dataDir = path.join(__dirname, '../data');
const dataFile = path.join(dataDir, 'events.json');

function decodeHtml(str) {
    return str
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
        .replace(/&amp;/g, '&');
}

function detectStatus(text) {
    const lower = text.toLowerCase();
    if (lower.includes('є світло') || lower.includes('відновлено електропостачання')) return 'on';
    if (lower.includes('відключено електропостачання')) return 'off';
    return null;
}

// Returns [{ id, date, text }] for one page of the web preview
async function fetchPage(before) {
    const url = `https://t.me/s/${channelUsername}` + (before ? `?before=${before}` : '');
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const html = await res.text();

    const posts = [];
    const blocks = html.split('class="tgme_widget_message_wrap').slice(1);
    for (const block of blocks) {
        const idMatch = block.match(new RegExp(`data-post="${channelUsername}/(\\d+)"`));
        const timeMatch = block.match(/<time datetime="([^"]+)"/);
        if (!idMatch || !timeMatch) continue;
        // Main message text only (reply previews don't carry js-message_text)
        const textMatch = block.match(/<div class="tgme_widget_message_text js-message_text"[^>]*>([\s\S]*?)<\/div>/);
        posts.push({
            id: parseInt(idMatch[1], 10),
            date: new Date(timeMatch[1]),
            text: textMatch ? decodeHtml(textMatch[1]) : '',
        });
    }
    return posts;
}

async function scrapeChannel() {
    let existingEvents = [];
    if (fs.existsSync(dataFile)) {
        existingEvents = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    }

    const newest = existingEvents.length
        ? Math.max(...existingEvents.map(e => new Date(e.date).getTime()))
        : null;
    const cutoff = newest ? new Date(Math.max(newest - OVERLAP_MS, startDate.getTime())) : startDate;

    if (isDev) console.log(`Fetching t.me/s/${channelUsername} back to ${cutoff.toISOString()}...`);

    const messages = [];
    let before = null;
    let totalMessages = 0;

    for (let page = 0; page < MAX_PAGES; page++) {
        const posts = await fetchPage(before);
        if (posts.length === 0) break;

        for (const post of posts) {
            if (post.date < cutoff) continue;
            const status = detectStatus(post.text);
            if (status) {
                messages.push({ date: post.date.toISOString(), status });
                totalMessages++;
            }
        }

        const oldest = posts.reduce((a, b) => (a.id < b.id ? a : b));
        if (oldest.date < cutoff || oldest.id <= 1) break;
        before = oldest.id;

        if (isDev) console.log(`  page ${page + 1}: back to ${oldest.date.toISOString()} (${totalMessages} status messages)`);
        await new Promise(r => setTimeout(r, 300));
    }

    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir);
    }

    // Merge new messages with existing, avoiding duplicates by date
    const existingDates = new Set(existingEvents.map(e => e.date));
    const newEvents = messages.filter(m => !existingDates.has(m.date));

    const allEvents = [...existingEvents, ...newEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

    fs.writeFileSync(dataFile, JSON.stringify(allEvents, null, 2));

    console.log(`✓ Scraped ${totalMessages} messages | Added ${newEvents.length} new | Total: ${allEvents.length}`);

    // Trigger battery level script if new events were added
    if (newEvents.length > 0 && process.env.SKIP_BATTERY !== '1') {
        if (isDev) console.log(`Triggering battery level script for ${newEvents.length} new event(s)...`);
        const batteryScriptPath = path.join(__dirname, 'battery_level.sh');

        try {
            const { stdout, stderr } = await execPromise(`bash "${batteryScriptPath}"`);
            if (isDev && stdout) console.log('Battery script output:', stdout);
            if (stderr) console.error('Battery script stderr:', stderr);
            console.log('✓ Battery level sent to Telegram');
        } catch (error) {
            console.error('❌ Battery script failed:', error.message);
        }
    }
}

scrapeChannel().catch((error) => {
    console.error('❌ Scraper error:', error.message);
    process.exit(1);
});
