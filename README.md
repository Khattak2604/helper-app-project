# 🏪 Dukan Ledger — Shop Record Manager

A full-stack Pakistani shop ledger chatbot that manages customer accounts and daily purchase records using AI (Google Gemini). Supports English, Roman Urdu, and Roman Punjabi commands, including voice input.

## 📁 Folder Structure

```
helper-app-project/
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env.example      ← copy to .env and add your key
│   ├── routes/
│   │   ├── customers.js  ← Customer CRUD + daily records + reports
│   │   ├── chat.js       ← AI chat endpoint (intent-based)
│   │   ├── config.js     ← API key setup endpoint
│   │   └── languages.js  ← Language pack management
│   ├── services/
│   │   └── geminiService.js  ← Google Gemini AI integration
│   ├── data/
│   │   ├── available-packs.json  ← Registry of available language packs
│   │   └── packs/               ← Bundled language pack files
│   └── utils/
│       └── dataStore.js  ← Local JSON file storage
└── data/
    ├── customers.json       ← auto-created on startup
    ├── config.json          ← API key + active languages (auto-created)
    └── language-packs/      ← Installed language packs (auto-created)
```

## 🚀 Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Get your FREE Gemini API key
1. Go to **https://aistudio.google.com/app/apikey**
2. Sign in with your **Gmail account**
3. Click **"Create API key"**
4. Copy the key (starts with `AIza...`)

No credit card required — the free tier (Gemini 1.5 Flash) is sufficient.

### 3. Configure the API key (choose one method)

**Option A — Via the app UI (recommended):**
- Start the server, open http://localhost:5000
- Click the **⚙️ Setup** button in the top bar
- Paste your API key and click **Save & Test**

**Option B — Via .env file:**
```bash
# In backend/ folder, create a file called .env
GEMINI_API_KEY=your_gemini_api_key_here
PORT=5000
```

### 4. Start the server
```bash
npm run dev
```

### 5. Open the app
Visit: http://localhost:5000

---

## 🌐 Language Packs

Click **🌐 Languages** in the header to open the Language Manager.

- **English** — built-in, always active
- **Roman Urdu** — write Urdu in English letters (e.g. *Ahmed ka aaj ka hisab add karo*)
- **Punjabi (Roman)** — Roman Punjabi for Punjab region shops

To install a language pack: click **⬇ Download** in the Language Manager. The pack's vocabulary is instantly injected into the AI system prompt.

---

## 💬 Chat Commands (English & Roman Urdu)

| Command | Intent |
|---------|--------|
| `Add customer Ali, phone 0321-1234567, Lahore` | ADD_CUSTOMER |
| `Ahmed ka aaj ka hisab add karo — atta 2 bag 1200 each` | ADD_DAILY_RECORD |
| `Ali ka record dikhao` | GET_CUSTOMER |
| `Sab customers dikhao` | GET_ALL_CUSTOMERS |
| `Ahmed ka kul hisab kya hai` | GET_OVERALL_TOTAL |
| `Sara ka is mahine ka report banao` | GENERATE_MONTHLY_REPORT |
| `Update Sara's phone to 0300-1234567` | UPDATE_CUSTOMER |
| `Delete record for Ali` | DELETE_CUSTOMER |
| `Find customer named Khan` | SEARCH_CUSTOMER |

---

## 🎙️ Voice Input

Click the 🎙️ microphone button to speak commands. The transcript appears in the input box for confirmation before sending.

- Toggle between **EN** (English) and **اردو** (Urdu/Roman Urdu) using the language button
- Installing a language pack and activating it automatically updates the voice recognition language
- Uses browser's built-in Web Speech API — no external library needed

---

## 📊 Monthly Report

- Click **📊 Monthly Report** in a customer's detail view to generate a full monthly report
- Shows day-by-day breakdown of items, quantities, prices, and totals
- Download as `.txt` file with the ⬇ button

---

## 🔧 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/customers` | Get all customers (summary) |
| GET | `/api/customers/:id` | Get full customer record |
| POST | `/api/customers` | Create customer |
| PUT | `/api/customers/:id` | Update customer info |
| DELETE | `/api/customers/:id` | Delete customer |
| POST | `/api/customers/:id/daily` | Add/update daily record |
| GET | `/api/customers/:id/report?month=2026-03` | Get monthly report |
| POST | `/api/chat` | AI chat → intent + data |
| GET | `/api/config/status` | Check if API key is configured |
| POST | `/api/config/apikey` | Save and test Gemini API key |
| GET | `/api/languages/available` | List all available language packs |
| GET | `/api/languages/installed` | List installed language packs |
| POST | `/api/languages/download/:code` | Install a language pack |
| DELETE | `/api/languages/:code` | Remove a language pack |
| GET | `/api/languages/active` | Get active language codes |
| POST | `/api/languages/active` | Set active language codes |

---

## 📦 Data Model

Each customer record:
```json
{
  "id": "uuid",
  "name": "Ahmed Khan",
  "phone": "0321-1234567",
  "extraInfo": "Nowshera, KPK",
  "createdAt": "2026-03-04T...",
  "dailyRecords": [
    {
      "date": "2026-03-04",
      "items": [
        { "description": "Atta 10kg", "qty": 2, "price": 1200 }
      ],
      "dayTotal": 2400,
      "note": ""
    }
  ]
}
```

Data is stored locally in `data/customers.json` via Node.js `fs` module. No cloud database required.

---

## 🤖 Powered by Google Gemini 1.5 Flash

The free Gemini 1.5 Flash model is fast, accurate, and free via Google AI Studio. Get your key at https://aistudio.google.com/app/apikey using your Gmail account.

