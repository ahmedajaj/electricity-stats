const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const input = require('input');
const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../data/.env'), silent: true });

const apiId = parseInt(process.env.TELEGRAM_API_ID);
const apiHash = process.env.TELEGRAM_API_HASH;
const phoneNumber = process.env.TELEGRAM_PHONE;
const isDev = process.env.NODE_ENV !== 'production';

// Load or create session
let sessionString = '';
const sessionFile = path.join(__dirname, '../data/session.json');
if (fs.existsSync(sessionFile)) {
    const sessionData = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));
    sessionString = sessionData.session || '';
}

const stringSession = new StringSession(sessionString);

async function scrapeChannel() {
    if (isDev) console.log('Starting Telegram scraper...');
    
    const client = new TelegramClient(stringSession, apiId, apiHash, {
        connectionRetries: 5,
    });

    await client.start({
        phoneNumber: async () => phoneNumber,
        password: async () => await input.text('Please enter your password: '),
        phoneCode: async () => await input.text('Please enter the code you received: '),
        onError: (err) => { if (isDev) console.log(err); },
    });

    if (isDev) console.log('Connected to Telegram');

    // Save session for future use
    const session = client.session.save();
    fs.writeFileSync(sessionFile, JSON.stringify({ session }));

    const channelUsername = 'lvivskiy7a';
    const startDate = new Date('2025-10-01T00:00:00');

    if (isDev) console.log(`Fetching messages from @${channelUsername} since ${startDate.toISOString()}...`);

    try {
        const channel = await client.getEntity(channelUsername);
        const messages = [];
        let offsetId = 0;
        let totalMessages = 0;
        
        // Fetch messages in batches
        while (true) {
            const result = await client.getMessages(channel, {
                limit: 100,
                offsetId: offsetId,
            });

            if (result.length === 0) {
                break;
            }

            for (const message of result) {
                // Stop if we've gone past our start date
                if (message.date < startDate.getTime() / 1000) {
                    if (isDev) console.log('Reached messages before October 1, 2025');
                    break;
                }

                if (message.message) {
                    const text = message.message.toLowerCase();
                    let status = null;

                    // Check for electricity ON
                    if (text.includes('є світло')) {
                        status = 'on';
                    }
                    // Check for electricity OFF
                    else if (text.includes('відключено електропостачання')) {
                        status = 'off';
                    }

                    if (status) {
                        messages.push({
                            date: new Date(message.date * 1000).toISOString(),
                            status: status
                        });
                        totalMessages++;
                    }
                }
            }

            // Check if we've gone past start date
            if (result[result.length - 1].date < startDate.getTime() / 1000) {
                break;
            }

            offsetId = result[result.length - 1].id;
            if (isDev && totalMessages % 50 === 0) {
                console.log(`Fetched ${totalMessages} relevant messages so far...`);
            }
        }

        // Sort messages by date (oldest first)
        messages.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Save to data file
        const dataDir = path.join(__dirname, '../data');
        if (!fs.existsSync(dataDir)) {
            fs.mkdirSync(dataDir);
        }

        const dataFile = path.join(dataDir, 'events.json');
        
        // Load existing data if available
        let existingEvents = [];
        if (fs.existsSync(dataFile)) {
            existingEvents = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
        }

        // Merge new messages with existing, avoiding duplicates by date
        const existingDates = new Set(existingEvents.map(e => e.date));
        const newEvents = messages.filter(m => !existingDates.has(m.date));
        
        const allEvents = [...existingEvents, ...newEvents].sort((a, b) => new Date(a.date) - new Date(b.date));

        fs.writeFileSync(dataFile, JSON.stringify(allEvents, null, 2));

        console.log(`✓ Scraped ${totalMessages} messages | Added ${newEvents.length} new | Total: ${allEvents.length}`);

    } catch (error) {
        console.error('Scraper error:', error.message);
        throw error;
    }

    await client.disconnect();
}

scrapeChannel().catch(console.error);
