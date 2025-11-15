const https = require('https');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const isDev = process.env.NODE_ENV !== 'production';
const channelUsername = 'lvivskiy7a';

// Try multiple RSS sources
const RSS_SOURCES = [
    `https://rsshub.app/telegram/channel/${channelUsername}`,
    `https://t.me/s/${channelUsername}` // Telegram web preview
];

function parseRSS(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;

    while ((match = itemRegex.exec(xml)) !== null) {
        const item = match[1];
        
        // Extract fields
        const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>/.exec(item);
        const descMatch = /<description><!\[CDATA\[(.*?)\]\]><\/description>/.exec(item);
        const pubDateMatch = /<pubDate>(.*?)<\/pubDate>/.exec(item);
        const linkMatch = /<link>(.*?)<\/link>/.exec(item);

        if (titleMatch && pubDateMatch) {
            const text = (titleMatch[1] + ' ' + (descMatch ? descMatch[1] : '')).toLowerCase();
            const date = new Date(pubDateMatch[1]);
            
            // Extract message ID from link
            const msgIdMatch = linkMatch ? /\/(\d+)$/.exec(linkMatch[1]) : null;
            const id = msgIdMatch ? parseInt(msgIdMatch[1]) : Date.now();

            let status = null;
            if (text.includes('є світло')) {
                status = 'on';
            } else if (text.includes('відключено електропостачання')) {
                status = 'off';
            }

            if (status) {
                items.push({
                    id,
                    date: date.toISOString(),
                    timestamp: date.getTime(),
                    status,
                    text: titleMatch[1]
                });
            }
        }
    }

    return items;
}

function parseWebPreview(html) {
    const items = [];
    
    // Parse Telegram web preview HTML
    const messageRegex = /<div class="tgme_widget_message_text[^"]*"[^>]*>([\s\S]*?)<\/div>[\s\S]*?<time[^>]*datetime="([^"]*)"[^>]*>/g;
    let match;
    let id = Date.now();

    while ((match = messageRegex.exec(html)) !== null) {
        const textHtml = match[1];
        const datetime = match[2];
        
        // Remove HTML tags
        const text = textHtml.replace(/<[^>]*>/g, '').toLowerCase();
        const date = new Date(datetime);

        let status = null;
        if (text.includes('є світло')) {
            status = 'on';
        } else if (text.includes('відключено електропостачання')) {
            status = 'off';
        }

        if (status) {
            items.push({
                id: id++,
                date: date.toISOString(),
                timestamp: date.getTime(),
                status,
                text: textHtml.replace(/<[^>]*>/g, '')
            });
        }
    }

    return items;
}

async function fetchURL(url) {
    return new Promise((resolve, reject) => {
        if (isDev) console.log(`Trying: ${url}`);
        
        https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
            }
            
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

async function scrapeChannelRSS() {
    if (isDev) console.log(`Fetching data from @${channelUsername}...`);

    let messages = [];
    
    // Try Telegram web preview first (most reliable)
    try {
        const html = await fetchURL(`https://t.me/s/${channelUsername}`);
        messages = parseWebPreview(html);
        if (isDev) console.log(`Parsed ${messages.length} messages from web preview`);
    } catch (error) {
        if (isDev) console.log(`Web preview failed: ${error.message}`);
        
        // Fallback to RSS
        for (const rssUrl of RSS_SOURCES) {
            try {
                const xml = await fetchURL(rssUrl);
                messages = parseRSS(xml);
                if (messages.length > 0) {
                    if (isDev) console.log(`Got ${messages.length} messages from RSS`);
                    break;
                }
            } catch (err) {
                if (isDev) console.log(`RSS source failed: ${err.message}`);
            }
        }
    }

    if (messages.length === 0) {
        console.log('⚠️  No new messages found. Channel may be private or sources unavailable.');
        return;
    }

    try {
        // Save to data file
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir, { recursive: true });
        }

        const dataFile = path.join(dataDir, 'events.json');
        
        // Load existing data
        let existingEvents = [];
        if (fs.existsSync(dataFile)) {
            existingEvents = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        }

        // Merge, avoiding duplicates by timestamp (since IDs might differ)
        const existingTimestamps = new Set(existingEvents.map(e => e.timestamp));
        const newEvents = messages.filter(m => !existingTimestamps.has(m.timestamp));
        
        const allEvents = [...existingEvents, ...newEvents]
            .sort((a, b) => a.timestamp - b.timestamp);

        fs.writeFileSync(dataFile, JSON.stringify(allEvents, null, 2));

        console.log(`✓ Fetched ${messages.length} messages | Added ${newEvents.length} new | Total: ${allEvents.length}`);

    } catch (error) {
        console.error('Save error:', error.message);
        throw error;
    }
}

scrapeChannelRSS().catch(console.error);

