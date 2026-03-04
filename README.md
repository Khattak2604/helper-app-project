# 🏪 Dukan Ledger — Shop Record Manager

A full-stack Pakistani shop ledger chatbot that manages customer accounts and daily purchase records using AI (Ollama). Supports both English and Roman Urdu commands, including voice input.

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
│   ├── .env          ← YOU CREATE THIS
│   ├── routes/
│   │   ├── customers.js  ← Customer CRUD + daily records + reports
│   │   └── chat.js       ← AI chat endpoint (intent-based)
│   ├── services/
│   │   └── ollamaService.js  ← Ollama cloud integration
│   └── utils/
│       └── dataStore.js  ← Local JSON file storage
└── data/
    └── customers.json ← auto-created on startup
```

## 🚀 Setup

### 1. Install dependencies
```bash
cd backend
npm install
```

### 2. Create your .env file
```bash
# In backend/ folder, create a file called .env
OLLAMA_API_KEY=your_api_key_here
OLLAMA_MODEL=deepseek-v3.1:671b-cloud
PORT=5000
```

Replace `your_api_key_here` with your actual Ollama API key.

### 3. Start the server
```bash
npm run dev
```

### 4. Open the app
Visit: http://localhost:5000

---

## 💬 Chat Commands (English & Roman Urdu)

| Command | Intent |
|---------|--------|
| `Add customer Ali, phone 0321-1234567, Lahore` | ADD_CUSTOMER |
| `Naya customer Sara banao, phone 0300-9876543` | ADD_CUSTOMER |
| `Ahmed ka aaj ka hisab add karo — atta 2 bag 1200 each` | ADD_DAILY_RECORD |
| `Ali ka record dikhao` | GET_CUSTOMER |
| `Show Ali's record` | GET_CUSTOMER |
| `Sab customers dikhao` | GET_ALL_CUSTOMERS |
| `Show all customers` | GET_ALL_CUSTOMERS |
| `Ahmed ka kul hisab kya hai` | GET_OVERALL_TOTAL |
| `Sara ka is mahine ka report banao` | GENERATE_MONTHLY_REPORT |
| `Generate March 2026 report for Ahmed` | GENERATE_MONTHLY_REPORT |
| `Update Sara's phone to 0300-1234567` | UPDATE_CUSTOMER |
| `Delete record for Ali` | DELETE_CUSTOMER |
| `Find customer named Khan` | SEARCH_CUSTOMER |

---

## 🎙️ Voice Input

Click the 🎙️ microphone button to speak commands. The transcript appears in the input box for confirmation before sending.

- Toggle between **EN** (English) and **اردو** (Urdu/Roman Urdu) using the language button
- Uses browser's built-in Web Speech API — no external library needed
- Graceful fallback message if browser doesn't support it

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

## 🤖 Recommended Ollama Model

**`deepseek-v3.1:671b-cloud`** — excellent at following structured JSON instructions, bilingual (English + Roman Urdu).
