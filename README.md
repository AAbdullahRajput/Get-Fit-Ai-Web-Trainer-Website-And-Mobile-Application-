# GetFit AI

**Train Smarter. Scale Faster.**

GetFit AI is a full-stack platform built for personal trainers to manage their clients, schedule training sessions, track progress, and run live virtual coaching calls — all in one place. It includes a **web app** (for trainers), a **Flutter mobile app** (for trainers), and a **Node.js backend** powered by Supabase, Agora RTC, and NodeMailer.

---

## 📦 Project Structure

```
getfitai/
├── frontend/          # React + Vite web app (trainer dashboard)
├── mobile/            # Flutter mobile app (trainer & client)
├── server/            # Node.js + Express backend API
└── README.md
```

---

## ✨ Features

### 🧑‍🏫 Trainer Management
- Sign up / log in with email & password, OTP verification, and password recovery
- Full profile management (name, email, phone, experience, specialties, bio, session price)
- Circular profile picture upload with crop, zoom, and drag tools
- Home dashboard with stats (active clients, completed sessions, experience, rating)

### 📅 Scheduling & Bookings
- Create and manage training slots (date, start/end time, price)
- View upcoming, ongoing, and completed appointments
- Booker / client details shown on each appointment
- Chronological sort and searchable client & booking lists

### 👥 Client Tracking
- See all clients who have booked sessions
- View client contact info, total sessions, and booking history
- Expandable client cards with session history and call records

### 📞 Live Video Calls (Agora)
- Start live 1:1 video coaching calls with clients
- Incoming & outgoing call pages with realtime signaling
- Incoming call modal/listener that runs in the background
- Call history with status (missed, declined, ended), direction, and duration

### 📱 Cross-Platform Mobile App
- Flutter app with a dark theme & native splash/launcher icons
- Supabase auth, realtime call listeners, and push/notification support
- Local notifications for incoming calls

### 🔔 Notifications & Automation
- Email notifications via NodeMailer (password reset, OTP, booking confirmations)
- Realtime call signaling via Supabase Realtime

---

## 🧱 Tech Stack

| Layer      | Technology |
|------------|------------|
| Web (Frontend) | React 19, Vite 8, React Router 7, React Compiler |
| Mobile      | Flutter 3.x, Supabase Flutter, Provider, Agora RTC |
| Backend     | Node.js, Express 5, Supabase (DB + Auth + Realtime) |
| Video Calls | Agora RTC SDK (Web `agora-rtc-sdk-ng`, Flutter `agora_rtc_engine`) |
| Database    | Supabase (PostgreSQL) |
| Email       | NodeMailer |
| Deployment  | Vercel (frontend), Render (backend) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Flutter SDK 3.x
- A Supabase project (URL, anon key, service role key)
- An Agora App ID & token service
- SMTP credentials for email sending

### 1️⃣ Backend (`server/`)

```bash
cd server
npm install
cp .env.example .env   # fill in your environment variables
npm run dev            # or: npm start
```

The server runs on `http://localhost:5000` with a `/health` check endpoint.

**Environment variables:**
```
PORT=5000
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
INTERNAL_API_SECRET=your_internal_secret
SMTP_HOST=...
SMTP_PORT=...
SMTP_USER=...
SMTP_PASS=...
```

**API routes:**
- `POST /api/auth/...` — registration, login, OTP, password reset, profile
- `GET/POST /api/slots/...` — slot creation, listing, clients, bookings
- `POST /api/agora/generate-token` — generate a live call token

### 2️⃣ Frontend Web (`frontend/`)

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server proxies `/api` to `http://localhost:5000`. Deploy to Vercel using the included `vercel.json` (rewrites `/api` to the Render backend).

**Environment variables (`frontend/.env`):**
```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 3️⃣ Mobile App (`mobile/`)

```bash
cd mobile
flutter pub get
flutter run
```

The app loads configuration from a `.env` file (already listed in `pubspec.yaml` assets):

```
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_anon_key
AGORA_APP_ID=your_agora_app_id
```

---

## 🧭 Application Screens

**Web (React):**
- `/` — Launch screen
- `/home` — Landing / marketing page
- `/login` · `/signup` — Authentication
- `/forgot-password` · `/verify` — Account recovery & OTP
- `/dashboard` — Trainer dashboard (Home, Bookings, History, Profile tabs)
- `/slots` — Slot management
- `/video-call/:callId` — Video call
- `/outgoing-call/:callId` — Outgoing call
- `/privacy-policy` · `/terms-conditions` — Legal pages

**Mobile (Flutter):**
- Launch, Landing, Auth, Forgot Password, Dashboard
- Call screens: Incoming, Outgoing, Video Call

---

## 🗄️ Key Data Models

- **Trainer** — id, email, name, phone, training type, experience, image, session price, bio
- **Client** — id, name, email, mobile, avatar, booked slots
- **TrainerSlot** — id, trainer id, date, start/end time, price, status, booked-by info, virtual
- **BookedSlot** — id, slot date, start/end time, price, status, user info

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'Add some feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a pull request

---

## 📄 License

© 2026 GetFit. All rights reserved. Designed for elite coaches.

---

*Built for trainers, by trainers.*
