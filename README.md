# 🤖 AI Chatbot with 2FA Authentication

A full-stack AI chatbot application with email-based two-factor authentication, real-time streaming responses, conversation history, and weather integration.

## ✨ Features

- 🔐 **Email + Password Registration** with OTP verification
- 🔒 **2FA Login** - OTP sent to email on every login
- 💬 **Real-time Streaming Chat** using Groq AI API
- 🧠 **Multiple AI Models** (Llama 3.1, Gemma 2)
- 💾 **Conversation History** - Save, load, and delete conversations
- 🌤️ **Weather Integration** - Real-time weather data
- 📱 **Responsive Design** - Works on all devices
- ⚡ **Production Ready** - Deployed on Railway + Vercel

## 🚀 Tech Stack

**Frontend:**
- React 18
- React Router
- Marked (Markdown rendering)
- Highlight.js (Code syntax highlighting)

**Backend:**
- Node.js + Express
- SQLite (better-sqlite3)
- JWT Authentication
- Bcrypt (Password hashing)
- Nodemailer (Email OTP)
- Groq AI API
- OpenWeatherMap API

## 📦 Local Development

### Prerequisites
- Node.js 20+ 
- Gmail account with App Password enabled
- Groq API key
- OpenWeatherMap API key

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/YOUR-USERNAME/ai-chatbot-app.git
cd ai-chatbot-app
```

2. **Install Backend Dependencies**
```bash
cd backend
npm install
```

3. **Configure Backend Environment**
Create `backend/.env`:
```env
PORT=5000
JWT_SECRET=your-random-secret-string
GROQ_API_KEY=your-groq-api-key
WEATHER_API_KEY=your-openweathermap-key
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-16-char-gmail-app-password
FRONTEND_URL=http://localhost:3000
DATABASE_PATH=./database.sqlite
```

4. **Install Frontend Dependencies**
```bash
cd ../frontend
npm install
```

5. **Configure Frontend Environment**
Create `frontend/.env`:
```env
REACT_APP_API_URL=http://localhost:5000/api
```

6. **Run the Application**

Terminal 1 (Backend):
```bash
cd backend
npm start
```

Terminal 2 (Frontend):
```bash
cd frontend
npm start
```

7. **Open Browser**
Navigate to: http://localhost:3000

## 🌐 Deployment

See [DEPLOYMENT-GUIDE.md](DEPLOYMENT-GUIDE.md) for detailed deployment instructions.

**Quick Deploy:**
- Backend: Railway (Free)
- Frontend: Vercel (Free)

## 📚 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/verify-otp` - Verify registration OTP
- `POST /api/auth/resend-otp` - Resend OTP
- `POST /api/auth/login` - Login (sends 2FA OTP)
- `POST /api/auth/verify-login-otp` - Verify login OTP
- `GET /api/auth/me` - Get current user

### Chat Endpoints

- `POST /api/chat/stream` - Stream AI responses

### Conversation Endpoints

- `POST /api/conversations` - Create new conversation
- `GET /api/conversations` - Get all conversations
- `GET /api/conversations/:id` - Get conversation history
- `DELETE /api/conversations/:id` - Delete conversation

### Weather Endpoint

- `GET /api/weather?city=CityName` - Get weather data

## 🔒 Security Features

- ✅ JWT authentication with 30-day expiry
- ✅ Bcrypt password hashing (10 rounds)
- ✅ Email OTP verification (10-minute expiry)
- ✅ 2FA on every login
- ✅ CORS protection
- ✅ Environment variable management
- ✅ Server-side API key protection

## 📝 License

MIT License - feel free to use this project however you want!

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first.

## 📧 Support

For issues or questions, please open an issue on GitHub.

---

**Built with ❤️ by [Your Name]**
