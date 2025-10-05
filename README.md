# 🎯 Interview Platform

A modern **remote interview and hiring platform** that enables **live coding interviews**, **video communication**, and **real-time collaboration** between candidates and interviewers.

---

## 🚀 Features

- 🔐 **Authentication System** — JWT-based login & registration with HttpOnly cookies  
- 🧑‍💻 **Live Coding Editor** — synchronized code editor powered by **WebSockets**  
- 🎥 **Video & Audio Calls** — real-time video interviews via **WebRTC**  
- 💬 **Chat System** — live chat integrated within interview rooms  
- ⚙️ **Code Execution** — integrated with **Judge0 API** for running code in multiple languages  
- 📝 **Notes & Feedback** — interviewers can take notes and give feedback  
- 📊 **Dashboard** — manage interview rooms and sessions easily  
- 🐳 **Dockerized Setup** — backend, frontend, and WebSocket server ready for deployment with **NGINX**

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-------------|
| **Frontend** | Angular 17+ |
| **Backend API** | Django + Django REST Framework |
| **WebSockets** | Node.js + Socket.IO |
| **Database** | PostgreSQL |
| **Code Execution** | Judge0 API |
| **Authentication** | JWT (stored in HttpOnly cookies) |
| **Deployment** | Docker + NGINX |

---

## 🧩 Architecture Overview

```
┌─────────────────────┐
│     Angular App     │
│ (Video, Chat, Code) │
└────────┬────────────┘
         │ REST / WS
┌────────▼────────────┐
│   Django Backend    │  ← Business logic, JWT auth, DB
│ (DRF + PostgreSQL)  │
└────────┬────────────┘
         │
┌────────▼────────────┐
│   Node.js Server    │  ← WebSocket signaling + sync
│    (Socket.IO)      │
└────────┬────────────┘
         │
┌────────▼────────────┐
│     Judge0 API      │  ← Code execution
└─────────────────────┘
```

---

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone https://github.com/yourusername/interview-platform.git
cd interview-platform
```

### 2. Backend Setup (Django)
```bash
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
```

### 3. Frontend Setup (Angular)
```bash
cd frontend
npm install
npm start
```

### 4. WebSocket Server
```bash
cd ws-server
npm install
npm run dev
```

---

## 🐳 Docker Deployment

A ready-to-use **Docker Compose** setup is included.

```bash
docker-compose up --build
```

This starts:
- Django API (port 8000)
- Angular frontend (port 4200)
- Node.js WebSocket server (port 8001)
- PostgreSQL database
- NGINX reverse proxy

---

## 🧠 Future Enhancements

- 📅 Scheduling interviews with calendar integration  
- 🤖 AI interviewer assistant (question generation + code feedback)  
- 📈 Analytics and reporting dashboard  
- 🧍 Candidate profiles and CV upload  

---

## 👨‍💻 Author

**Stoyan Kanev**  
Full-Stack Software Engineer  
🌐 [stoyan-kanev.com](https://stoyan-kanev.com)
