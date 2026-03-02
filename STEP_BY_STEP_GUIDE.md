# 📋 Complete Step-by-Step Guide
## From Files → Tested Locally → Live on kryptoinsides.com

---

## PHASE 1: Replace Your Files

Download all the files from this session and replace them in your project folder.

**Files to replace** (download each one):
| File | What changed |
|------|-------------|
| `index.js` | New `/api/user/data`, `/api/user/tracking`, `/api/user/telegram` endpoints |
| `auth.js` | Stores tracking + telegram per user account in users_db.json |
| `dashboard.html` | Per-user data from server, Stripe checkout works, session validation |
| `index.html` | Session token now persists in localStorage for cross-tab support |
| `telegrambot.js` | Users saved to `telegram_users.json` — survive server restarts |
| `mailer.js` | Uses SMTP_USER/SMTP_PASS (Hostinger) consistently |
| `test-bots.js` | Fixed variable names (TELEGRAM_BOT_TOKEN, TELEGRAM_CHANNEL_BOT_TOKEN) |
| `env_template.txt` | NO real credentials — safe to keep in project |

**Files that did NOT change** (keep your existing ones):
- `channel.js`, `news.js`, `payments.js`, `prices.js`, `sheets.js`, `twitter.js`
- `accounts.js`, `coins.json`, `package.json`, `robots.txt`, `sitemap.xml`

---

## PHASE 2: Set Up Your .env File

**Copy the template:**
```bash
cp env_template.txt .env
```

**Edit `.env` and fill in these values:**

```
# Twitter — get from developer.twitter.com
TWITTER_BEARER_TOKEN=your_actual_bearer_token

# Telegram user bot (for chat IDs + personal alerts)
TELEGRAM_BOT_TOKEN=paste_token_from_botfather_here

# Telegram channel bot (for @kryptoinsidesalerts)
TELEGRAM_CHANNEL_BOT_TOKEN=paste_channel_bot_token_here

# Your Telegram channel
TELEGRAM_CHANNEL_ID=@kryptoinsidesalerts

# Stripe — get from dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_your_actual_key

# Get Price IDs from: Stripe Dashboard → Products → your product
STRIPE_MONTHLY_PRICE_ID=price_xxx
STRIPE_ANNUAL_PRICE_ID=price_xxx

# Get from: Stripe → Developers → Webhooks → your endpoint → Signing secret
STRIPE_WEBHOOK_SECRET=whsec_xxx

# Hostinger email
SMTP_USER=info@kryptoinsides.com
SMTP_PASS=your_hostinger_email_password

NODE_ENV=development
PORT=3000
ADMIN_EMAIL=adeezzafar@gmail.com
```

---

## PHASE 3: Test Locally

Open terminal in your project folder:

### Test 1: Install packages
```bash
npm install
```
Expected: no errors

### Test 2: Test Telegram bots
```bash
node test-bots.js
```
Expected:
```
✅ Token valid  (for @kryptoinsidesbot)
✅ No webhook set
✅ Token valid  (for @kryptoinsidesAlertsbot)
✅ Channel found: KryptoInsides Alerts
```

**If you see ❌ for channel:**
→ Go to Telegram → @kryptoinsidesalerts → Settings → Administrators
→ Add @kryptoinsidesAlertsbot as Admin with "Post Messages" permission

### Test 3: Start server
```bash
npm start
```
Expected output:
```
==================================
  KryptoInsides  ·  port 3000
==================================
[TG] Loaded 0 persisted Telegram user(s)
[TG] ✅ Bot connected: @kryptoinsidesbot
[TG] Polling for messages every 2s...
```

### Test 4: Test sign-up and login

1. Open http://localhost:3000
2. Enter your email → click "Send Code"
3. Check email for 6-digit code
4. Enter code → you should land on dashboard

**If email fails:** Check SMTP_USER and SMTP_PASS in .env

### Test 5: Test per-user data isolation (MOST IMPORTANT)

**Window 1** (normal browser):
1. Log in as: `userA@test.com`
2. Go to "My Tracking" tab → Add account: `vitalikbuterin`
3. Go to "Keywords" tab → Add keyword: `bitcoin`

**Window 2** (incognito / different browser):
1. Log in as: `userB@test.com`
2. Go to "My Tracking" tab

✅ PASS: Window 2 shows empty lists
❌ FAIL: If it shows userA's data — contact me immediately

### Test 6: Test data persistence after logout

1. Log out from userA's account
2. Log back in as userA@test.com
3. Go to My Tracking tab

✅ PASS: `vitalikbuterin` and `bitcoin` are still there

### Test 7: Test Telegram personal alerts

1. Open Telegram → search @kryptoinsidesbot → send `/start`
2. Copy your Chat ID (a number like `1234567890`)
3. In dashboard → Telegram tab → paste Chat ID → click Connect
4. Check Telegram for confirmation message

✅ PASS: You get "KryptoInsides Telegram Connected!" message

### Test 8: Test @kryptoinsidesalerts channel

The channel posts automatically when:
- Breaking crypto news is detected
- BTC/ETH hits a major price milestone or ±8% rapid move

You can monitor it by watching the channel in Telegram after npm start runs.

### Test 9: Test Stripe upgrade (optional, needs Stripe test mode)

1. In .env, use `sk_test_...` key for local testing
2. Click "Upgrade to Pro" in dashboard
3. You should be redirected to Stripe checkout
4. Use test card: `4242 4242 4242 4242`, any future date, any CVC
5. After payment → redirected back to dashboard with "🎉 You are now Pro!" message

---

## PHASE 4: Deploy to Hostinger

### Step 1: Upload files to Hostinger

**Via hPanel File Manager:**
1. Log in to hPanel → Files → File Manager
2. Navigate to `public_html` folder
3. Upload all your project files (ZIP them first, then extract)

**Or via SSH (VPS):**
```bash
# From your local terminal:
scp -r ./* root@YOUR_VPS_IP:/var/www/kryptoinsides/
```

### Step 2: Set up Node.js app in Hostinger

**Shared Hosting:**
1. hPanel → Website → Node.js
2. Create app → Entry point: `index.js`
3. Set environment variables (copy from your .env file)
4. Click Start

**VPS:**
```bash
ssh root@YOUR_VPS_IP
cd /var/www/kryptoinsides
npm install --production
npm install -g pm2
pm2 start index.js --name kryptoinsides
pm2 save
pm2 startup
```

### Step 3: Set NODE_ENV=production

In your hosting environment variables, set:
```
NODE_ENV=production
PORT=3000
SITE_URL=https://kryptoinsides.com
```

### Step 4: Point domain to your app

In Hostinger's hPanel → Domains → kryptoinsides.com:
- Should already be pointing to your hosting
- Make sure SSL certificate is active (Hostinger provides free SSL)

### Step 5: Set up Stripe webhook for production

1. Go to https://dashboard.stripe.com/webhooks
2. Click "Add endpoint"
3. URL: `https://kryptoinsides.com/api/stripe/webhook`
4. Select event: `checkout.session.completed`
5. Copy "Signing secret" → add to hosting environment as `STRIPE_WEBHOOK_SECRET`
6. Restart app

### Step 6: Final production checks

```bash
# Check app is running (on VPS):
pm2 status
pm2 logs kryptoinsides

# Test health endpoint from server:
curl http://localhost:3000/health
```

Open https://kryptoinsides.com in your browser — you should see the live site!

---

## What Runs Automatically (24/7) Once Deployed

| Feature | How it works |
|---------|-------------|
| **Live tweets** | `twitter.js` polls Twitter API every 2 min, broadcasts via WebSocket to all users |
| **Breaking news** | `news.js` polls 20+ RSS feeds every 5 min |
| **Price alerts** | `prices.js` checks CoinGecko every 2 min for BTC/ETH milestones |
| **Telegram bot** | `telegrambot.js` polls Telegram every 2s for /start commands |
| **Channel alerts** | `channel.js` posts to @kryptoinsidesalerts when breaking news/price alerts fire |
| **Personal Telegram alerts** | Sent automatically based on each user's tracked accounts/keywords |
| **Stripe payments** | Webhooks auto-upgrade users after successful payment |

**Everything runs in one `npm start` process — no external services needed.**

---

## Troubleshooting

**Site not loading:**
```bash
pm2 logs kryptoinsides  # check for errors
```

**Emails not working:**
- Check SMTP_USER and SMTP_PASS in hosting environment variables
- Test: send yourself an OTP on the site

**Telegram bot not responding:**
- Make sure only ONE instance of the app is running: `pm2 status`
- If "conflict": `pm2 restart kryptoinsides`

**Channel not posting:**
- Check @kryptoinsidesAlertsbot is admin of @kryptoinsidesalerts channel
- Check TELEGRAM_CHANNEL_BOT_TOKEN is set in hosting environment

**Users can't log in after deploy:**
- Check SMTP settings — OTP emails must work
- Check that `users_db.json` exists (will be created on first signup)

---

## You're Live! 🚀

Once deployed, your platform:
- Serves any number of users simultaneously
- Each user has their own private account with their own tracking
- Live feed updates every user in real-time via WebSocket
- Telegram channel posts automatically to thousands of subscribers
- Personal Telegram alerts go to each user's phone instantly
- Stripe handles payments and auto-upgrades users to Pro
- Everything persists — tracking, preferences, connections survive restarts
