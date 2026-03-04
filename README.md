# 🤖 AI Data Manager — Ollama Cloud CRUD Chatbot

A full-stack web app with an AI chatbot that performs CRUD operations on contact data using Ollama cloud models.

## 📁 Folder Structure

```
ollama-crud-chatbot/
├── frontend/
│   ├── index.html
│   ├── css/styles.css
│   └── js/app.js
├── backend/
│   ├── server.js
│   ├── package.json
│   ├── .env          ← YOU CREATE THIS
│   ├── routes/
│   │   ├── data.js   ← CRUD REST API
│   │   └── chat.js   ← AI chat endpoint
│   ├── services/
│   │   └── ollamaService.js
│   └── utils/
│       └── dataStore.js
└── data/
    └── contacts.json ← auto-created
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
OLLAMA_API_URL=https://api.ollama.ai
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

## 🤖 Best Ollama Cloud Models for This Chatbot

| Model | Speed | Intelligence | Recommended For |
|-------|-------|-------------|-----------------|
| **deepseek-v3.1:671b-cloud** ⭐ | Fast | Excellent | **Best overall — great at JSON & instructions** |
| **qwen3-coder:480b-cloud** | Medium | Excellent | Best if you want code-heavy tasks too |
| **glm-4.6:cloud** | Very Fast | Good | Fast responses, lightweight |
| **gpt-oss:20b-cloud** | Fast | Good | Balanced option |

### 🏆 Recommendation: `deepseek-v3.1:671b-cloud`
This model is excellent at following structured JSON instructions, which is exactly what the chatbot needs to parse CRUD commands reliably.

---

## 💬 Chat Commands Examples

| Command | Action |
|---------|--------|
| `Add new person named Ahmed with phone 0321-1234567 address Karachi` | CREATE |
| `Show all records` | READ all |
| `Find records with name Ali` | SEARCH |
| `Update phone for Sara to 0300-9876543` | UPDATE |
| `Delete the record for Ali Khan` | DELETE |
| `Update record ID abc123 set email to new@gmail.com` | UPDATE by ID |

---

## 🔧 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET | `/api/data` | Get all records |
| GET | `/api/data?search=ali` | Search records |
| GET | `/api/data?name=ali` | Filter by field |
| POST | `/api/data` | Create record |
| PUT | `/api/data/:id` | Update by ID |
| DELETE | `/api/data/:id` | Delete by ID |
| POST | `/api/chat` | AI chat endpoint |
