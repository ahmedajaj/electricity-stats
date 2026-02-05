#!/bin/bash

# ===========================================
# Battery SOC Monitor - Deye Cloud to Telegram
# ===========================================

# Configuration - FILL THESE IN
DEYE_BEARER_TOKEN=""
TELEGRAM_BOT_TOKEN=""
TELEGRAM_CHAT_ID=""

# API Configuration
DEYE_API_URL="https://eu1-developer.deyecloud.com/v1.0/station/latest"
STATION_ID="61180551"

# Fetch battery data from Deye Cloud
response=$(curl -s -X POST "$DEYE_API_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $DEYE_BEARER_TOKEN" \
  -d "{\"stationId\": $STATION_ID}")

# Check if curl succeeded
if [ $? -ne 0 ]; then
  echo "Error: Failed to connect to Deye API"
  exit 1
fi

# Extract batterySOC from JSON response
battery_soc=$(echo "$response" | grep -o '"batterySOC":[0-9.]*' | grep -o '[0-9.]*')

# Check if we got a value
if [ -z "$battery_soc" ]; then
  echo "Error: Could not extract batterySOC from response"
  echo "Response: $response"
  exit 1
fi

# Truncate to integer (remove decimal part)
battery_level=${battery_soc%.*}

# Build progress bar (10 segments, each = 10%)
filled=$((battery_level / 10))
empty=$((10 - filled))

# Choose icon and color bar based on level
if [ "$battery_level" -lt 20 ]; then
  icon="🪫"
  color_bar=""
  for ((i=0; i<filled; i++)); do color_bar+="🟥"; done
  for ((i=0; i<empty; i++)); do color_bar+="⬜"; done
  message="${icon} <b>БАТАРЕЯ:</b> ⚡️ ${battery_level}%

${color_bar}"
elif [ "$battery_level" -lt 50 ]; then
  icon="🔋"
  color_bar=""
  for ((i=0; i<filled; i++)); do color_bar+="🟨"; done
  for ((i=0; i<empty; i++)); do color_bar+="⬜"; done
  message="${icon} <b>БАТАРЕЯ:</b> ⚡️ ${battery_level}%

${color_bar}"
else
  icon="🔋"
  color_bar=""
  for ((i=0; i<filled; i++)); do color_bar+="🟩"; done
  for ((i=0; i<empty; i++)); do color_bar+="⬜"; done
  message="${icon} <b>БАТАРЕЯ:</b> ⚡️ ${battery_level}%

${color_bar}"
fi

# Send to Telegram with HTML formatting
telegram_response=$(curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -H "Content-Type: application/json" \
  -d "{\"chat_id\": \"$TELEGRAM_CHAT_ID\", \"text\": \"$message\", \"parse_mode\": \"HTML\"}")

# Check Telegram response
if echo "$telegram_response" | grep -q '"ok":true'; then
  echo "Success: Message sent to Telegram"
  echo "Message: $message"
else
  echo "Error: Failed to send Telegram message"
  echo "Response: $telegram_response"
  exit 1
fi
