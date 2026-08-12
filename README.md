# 🤖 JobBot — Automated Job Application Dashboard

A full-stack system that **scrapes Greenhouse job listings**, **auto-fills application forms** using Playwright, **captures proof screenshots**, and shows everything in a live **React dashboard**.

> ⚠️ This is a demonstration tool. The automation stops **before** clicking Submit — it only fills forms and takes screenshots as proof.

---

## Features

- 🕷️ **Scraper** — fetches 10–15 jobs from Greenhouse's public API
- 🤖 **Automation Engine** — fills forms field-by-field with Playwright (never clicks Submit)
- 📸 **Screenshot Capture** — saves full-page PNG proof at the review stage
- 🖥️ **Live Dashboard** — React frontend with 3s polling, status badges, and progress bars
- 🔒 **Safety Guard** — hard code-level block on any "Submit" button clicks

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + Vite 5 |
| Backend | Node.js + Express 4 |
| Database | SQLite (better-sqlite3) |
| Automation | Playwright (Chromium) |
| Scraping | Native `fetch` (Node 18+) |

---

## Quick Start

### Prerequisites
- Node.js 18+
- npm 8+

### 1. Clone and configure

```bash
git clone <your-repo>
cd job-automation-dashboard
cp .env.example .env
```

Edit `.env` to choose your Greenhouse board (default: Notion):

```env
GREENHOUSE_BOARD_TOKEN=notion   # try: stripe, airbnb, github, shopify
MAX_JOBS=15
HEADLESS=false                  # false = visible browser (good for debugging)
```

### 2. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install

# Playwright browser
cd ../backend && npx playwright install chromium
```

### 3. Start the backend

```bash
cd backend
npm run dev
# → http://localhost:3001
```

### 4. Scrape some jobs

```bash
# Via API (once backend is running):
curl -X POST http://localhost:3001/api/jobs/scrape

# Or directly from the command line:
node backend/scripts/runScraper.js
```

### 5. Start the frontend

```bash
cd frontend
npm run dev
# → http://localhost:5173
```

Open `http://localhost:5173` — you should see the dashboard with job cards.

---

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/jobs` | All jobs + stats |
| GET | `/api/jobs/:id` | Single job |
| POST | `/api/jobs/scrape` | Trigger scraper |
| POST | `/api/applications/:jobId/apply` | Apply to one job (async) |
| POST | `/api/applications/apply-all` | Apply to all pending (async) |
| GET | `/api/applications/progress` | Apply-all progress |
| GET | `/api/applications/:jobId/status` | Poll one job's status |
| GET | `/api/applications/:jobId/screenshot` | Get proof screenshot |
| GET | `/api/candidate` | Get candidate profile |

---

## Project Structure

```
job-automation-dashboard/
├── backend/
│   ├── db/              # SQLite schema + connection
│   ├── routes/          # Express routes
│   ├── controllers/     # Request handling
│   ├── services/        # Business logic
│   ├── scripts/         # CLI runners
│   └── server.js
├── scraper/
│   └── greenhouseScraper.js
├── automation/
│   ├── browserManager.js    # Launch/close Playwright browser
│   ├── fieldMapper.js       # Label → candidate key mapping
│   ├── formFiller.js        # Field detection & filling
│   ├── screenshotCapture.js # Save PNG proof
│   └── applyToJob.js        # Per-job orchestrator
├── frontend/
│   └── src/
│       ├── api/          # Fetch wrappers
│       └── components/   # React components
├── data/
│   ├── candidate.json   # Edit this with real details
│   └── resume.pdf       # Put your resume here
├── screenshots/         # Auto-saved PNG proofs
└── .env                 # Your configuration
```

---

## Customizing the Candidate

Edit `data/candidate.json` with real details before running automation:

```json
{
  "firstName": "Your",
  "lastName": "Name",
  "email": "you@example.com",
  ...
}
```

Replace `data/resume.pdf` with your actual resume PDF.

---

## Safety

The automation engine has a hard code-level guard in `automation/formFiller.js`:

```js
function isSafeToClick(buttonText) {
  const FORBIDDEN = ['submit application', 'submit', 'send application'];
  return !FORBIDDEN.some(phrase => buttonText.toLowerCase().includes(phrase));
}
```

This function is checked before **every** button click — the bot physically cannot submit a real application.
