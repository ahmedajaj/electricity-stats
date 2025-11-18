# ⚡ Electricity Statistics Tracker

> Monitor and analyze electricity on/off statistics from Telegram channel @lvivskiy7a

Track electricity status for **Київ, Софії Русової 7А** with real-time updates, beautiful visualizations, and comprehensive statistics. All times displayed in **Kyiv timezone (UTC+2)**.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Telegram Bot
**Option A: Bot Token (Recommended - No Auth Required!)**
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a bot with `/newbot`
3. Copy the token and add to `.env`:

```bash
cp .env.example .env
# Edit .env and add:
TELEGRAM_API_ID=your_api_id
TELEGRAM_API_HASH=your_api_hash
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
```

**Option B: User Client (Requires Phone Auth)**
```bash
# If you prefer user client instead of bot
TELEGRAM_PHONE=+380123456789
```

### 3. Collect Data
```bash
# With bot (no auth needed!)
npm run bot:start

# OR with user client (requires verification code)
npm run scrape
```

### 4. Start Server
```bash
# Development
npm start

# Production
npm run prod
```

### 5. Open Browser
Visit **http://localhost:3000**

---

## 🌟 Features

### 📊 Interactive Dashboard
- **Summary cards**: Power on/off percentages, total outages
- **Daily statistics**: Stacked bar chart showing hourly breakdown
- **Timeline view**: Visual representation of power status throughout each day
- **Distribution chart**: Overall power on/off ratio
- **Recent events**: Latest status changes

### 🕐 Timezone Support
- All times displayed in **Kyiv timezone (Europe/Kiev, UTC+2)**
- Day boundaries calculated correctly for local time
- Tooltips show exact start/end times with duration

### 📈 Advanced Features
- Multiple time ranges: Last 7/14/30 days, custom dates, all time
- Hover tooltips on timeline showing exact times and duration
- Event filtering by date range
- Manual data updates via UI
- Responsive design for all screen sizes

---

## 🛠 Technology Stack

- **Backend**: Node.js, Express
- **Telegram**: telegram library for API access
- **Frontend**: Vanilla JavaScript, Chart.js
- **Storage**: JSON file-based (no database needed)
- **Scheduling**: node-cron for automatic updates

---

## 📁 Project Structure

```
electricity-stats/
├── config/
│   └── ecosystem.config.js   # PM2 process manager configuration
│
├── src/
│   ├── server.js            # Express API server
│   ├── scraper.js           # Telegram data collector
│   ├── scheduler.js         # Auto-update scheduler (every 6h)
│   ├── dataStore.js         # Statistics calculation engine
│   └── check-config.js      # Configuration validator
│
├── public/
│   ├── index.html           # Web interface
│   ├── app.js              # Frontend logic
│   ├── styles.css          # Styling
│   └── favicon.svg         # Icon
│
├── data/                    # Generated data (gitignored)
│   ├── events.json         # Event database
│   └── update-log.txt      # Update history
│
├── .env                     # Your configuration (gitignored)
├── .env.example             # Environment variables template
├── .gitignore              # Git ignore rules
├── package.json            # Dependencies & scripts
└── README.md               # This file
```

---

## 🔌 Available Commands

```bash
# Server
npm start              # Start server (development)
npm run prod          # Start server (production mode)
npm run dev           # Start with nodemon (auto-restart)

# Data Collection
npm run bot:start     # Start bot collector (no auth needed!)
npm run bot:collect   # Bot in production mode
npm run scrape        # Update with user client (requires auth)

# Automation
npm run scheduler     # Start bot collector with auto-restart
npm run check         # Validate configuration
```

---

## � API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/events` | GET | All electricity events |
| `/api/events/range?startDate=...&endDate=...` | GET | Events in date range |
| `/api/statistics?startDate=...&endDate=...` | GET | Statistics summary |
| `/api/statistics/daily?startDate=...&endDate=...` | GET | Daily breakdown |
| `/api/summary` | GET | Overall summary stats |
| `/api/update` | POST | Trigger manual data update |

**Example:**
```bash
curl "http://localhost:3000/api/statistics?startDate=2025-11-08&endDate=2025-11-15"
```

---

## 🚀 Production Deployment

### Deploy to Render (Free & Recommended)

Render provides free hosting with persistent storage and automatic updates - perfect for this app!

#### Step 1: Push to GitHub
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/electricity-stats.git
git push -u origin main
```

#### Step 2: Deploy on Render
1. Sign up at [render.com](https://render.com) (free account)
2. Click **"New +"** → **"Blueprint"**
3. Connect your GitHub repository
4. Render will detect `render.yaml` and create:
   - **Web Service** (your dashboard at `your-app.onrender.com`)
   - **Cron Job** (updates data every 6 hours)

#### Step 3: Add Environment Variables
In Render Dashboard, add these for **both services**:
- `TELEGRAM_API_ID` - Your API ID from https://my.telegram.org/apps
- `TELEGRAM_API_HASH` - Your API hash
- `TELEGRAM_PHONE` - Your phone number (e.g., +380123456789)

#### Step 4: Initial Data Collection
After first deployment:
1. Go to Render Dashboard → **Cron Job** → **Manual Trigger**
2. Run it once to collect initial data
3. Your web app will now show statistics!

#### Features on Render:
- ✅ **Free HTTPS** with custom domain support
- ✅ **Persistent storage** (1GB) - your data won't disappear
- ✅ **Auto-deploy** on git push
- ✅ **Automatic scraping** every 6 hours
- ✅ **Health checks** and auto-restart

**Your app URL:** `https://electricity-stats.onrender.com` (or your custom name)

---

### Using PM2 (Local/VPS Deployment)

```bash
# Install PM2 globally
npm install -g pm2

# Start using ecosystem config
pm2 start config/ecosystem.config.js

# Save configuration
pm2 save

# Enable auto-start on reboot
pm2 startup
```

### PM2 Commands
```bash
pm2 status                    # View status
pm2 logs                      # View logs
pm2 restart all              # Restart apps
pm2 stop all                 # Stop apps
pm2 monit                    # Monitor resources
```

### Manual Production Start
```bash
NODE_ENV=production node server.js
```

---

## 🔧 Configuration

### Environment Variables (.env)

```bash
# Server
PORT=3000
NODE_ENV=production

# Telegram API (get from https://my.telegram.org/apps)
TELEGRAM_API_ID=12345678
TELEGRAM_API_HASH=your_api_hash_here
TELEGRAM_PHONE=+380123456789
```

### First Run Setup
1. Run `npm run scrape` for first time
2. Enter phone number (if not in .env)
3. Enter verification code from Telegram
4. Session saved to `session.json` (no need to login again)

---

## 🔄 Automatic Updates

The scheduler runs every 6 hours (00:00, 06:00, 12:00, 18:00) to fetch new data.

**Start scheduler:**
```bash
# Development
npm run scheduler

# Production with PM2
pm2 start ecosystem.config.js
```

**Update logs stored in:** `data/update-log.txt`

---

## 📱 Usage

### Web Interface
1. Open http://localhost:3000
2. Select date range (quick filters or custom dates)
3. Click "Оновити" to refresh view
4. Click "Оновити дані з Telegram" to fetch new messages
5. Hover over timeline segments to see exact times

### Manual Data Update
```bash
npm run scrape
```

### Check Configuration
```bash
npm run check
```

---

## � Security & Privacy

- ✅ Reads **public** Telegram channel only
- ✅ All data stored **locally** in JSON files
- ✅ No external data transmission
- ✅ Credentials stored in `.env` (gitignored)
- ✅ Session token in `session.json` (gitignored)

**File Permissions:**
```bash
chmod 600 .env
chmod 600 session.json
```

---

## 🔍 Troubleshooting

### Server Won't Start
```bash
# Check if port is in use
lsof -ti:3000

# Kill process if needed
lsof -ti:3000 | xargs kill -9

# Check configuration
npm run check
```

### Scraper Issues
```bash
# Re-authenticate
rm session.json
npm run scrape

# Check Telegram credentials
cat .env
```

### No Data Displayed
```bash
# Verify data file exists
ls -la data/events.json

# Check data content
head data/events.json

# Collect initial data
npm run scrape
```

---

## 📦 Backup

### Manual Backup
```bash
# Backup data
cp data/events.json data/events-backup-$(date +%Y%m%d).json

# Backup configuration
cp .env .env.backup
cp session.json session.backup.json
```

### Automated Backup (crontab)
```bash
# Daily backup at 2 AM
0 2 * * * cp /path/to/electricity-stats/data/events.json /path/to/backups/events-$(date +\%Y\%m\%d).json
```

---

## 🚦 Deployment Checklist

- [ ] Install dependencies: `npm ci --production`
- [ ] Configure `.env` file with Telegram credentials
- [ ] Set file permissions: `chmod 600 .env session.json`
- [ ] Run initial scrape: `npm run scrape`
- [ ] Test locally: `npm run prod`
- [ ] Set up PM2: `pm2 start ecosystem.config.js`
- [ ] Save PM2 config: `pm2 save`
- [ ] Enable auto-start: `pm2 startup`
- [ ] Configure firewall (if applicable)
- [ ] Set up backups
- [ ] Monitor logs: `pm2 logs`

---

## � Performance

The application is optimized for production:
- **Minimal logging** in production mode
- **Error handling** middleware prevents crashes
- **Memory limits** configured in PM2
- **Auto-restart** on failures
- **Log rotation** via PM2

---

## 🛡️ Nginx Reverse Proxy (Optional)

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable SSL with Let's Encrypt
```bash
sudo certbot --nginx -d your-domain.com
```

---

## 📝 License

ISC

---

## 🙏 Acknowledgments

- Data source: Telegram channel [@lvivskiy7a](https://t.me/lvivskiy7a)
- Location: Київ, Софії Русової 7А
- Timezone: Europe/Kiev (UTC+2)

---

**Made with ⚡ for tracking electricity statistics**

Visit **http://localhost:3000** to get started! 🚀
