# GetFit AI

> **Train Smarter. Scale Faster.**
> 
> The all-in-one platform for personal trainers to manage clients, schedule sessions, track progress, and run live 1:1 virtual coaching calls.

<div align="center">

![GetFit AI](https://img.shields.io/badge/version-1.0.0-blue)
![React](https://img.shields.io/badge/frontend-React%2019%20%2B%20Vite-61DAFB?logo=react)
![Flutter](https://img.shields.io/badge/mobile-Flutter%203.x-02569B?logo=flutter)
![Node.js](https://img.shields.io/badge/backend-Node.js%20%2B%20Express-339933?logo=node.js)
![Supabase](https://img.shields.io/badge/database-Supabase-3ECF8E?logo=supabase)
![License](https://img.shields.io/badge/license-MIT-green)

[🚀 Get Started](#-getting-started) • [📖 Features](#-features) • [🏗️ Architecture](#-architecture) • [📱 Live Demo](#-live-demo)

</div>

---

## 🎯 What is GetFit AI?

GetFit AI is a **full-stack fitness coaching platform** built for modern personal trainers. Manage everything your coaching business needs—from client profiles and scheduling to live video calls and payment tracking—all in one beautifully designed interface.

**Three platforms. One ecosystem.**
- 🖥️ **Web Dashboard** (React + Vite) — For trainers
- 📱 **Mobile App** (Flutter) — For trainers and clients  
- ⚙️ **Powerful Backend** (Node.js + Express) — Real-time sync, video calls, email automation

<div align="center">
  <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(5000).png" alt="GetFit Dashboard" width="700" style="border-radius: 12px; margin: 20px 0;">
</div>

---

## 💡 Features at a Glance

<div align="center">
  <img src="./Project%20Images/Trainer%20Mobile%20Application%20Images/WhatsApp%20Image%202026-08-06%20at%2017.30.01.jpeg" alt="GetFit Mobile Features" width="500" style="border-radius: 12px; margin: 20px 0;">
</div>

<table>
<tr>
<td width="50%">

### 🧑‍🏫 Trainer Management
- Email/password signup with OTP verification
- Professional profile with photo upload & editing
- Experience badges and session pricing
- Dashboard with key stats (active clients, sessions completed, ratings)

</td>
<td width="50%">

### 📅 Smart Scheduling
- Create flexible training slots (date, time, price)
- Automatic availability management
- Chronological booking history
- Real-time appointment tracking (upcoming → ongoing → completed)

</td>
</tr>
<tr>
<td width="50%">

### 👥 Client Management
- Complete client directory with contact info
- Session history and booking records
- Expandable client cards with call logs
- Quick client search and filtering

</td>
<td width="50%">

### 📞 Live Video Coaching
- 1:1 video calls with crystal-clear Agora RTC
- Incoming call notifications (background-safe)
- Call history with status tracking (missed, declined, ended)
- Automatic call duration logging

</td>
</tr>
<tr>
<td width="50%">

### 🔔 Smart Notifications
- Instant email alerts (password reset, OTP, confirmations)
- Real-time call signaling via Supabase
- Push notifications to mobile app
- Automated booking reminders

</td>
<td width="50%">

### 📱 Cross-Platform Mobile
- Native Flutter app with dark theme
- Offline-first architecture
- Local incoming call notifications
- Responsive UI for all screen sizes

</td>
</tr>
</table>

---

## 🎬 Screenshots Gallery

<div align="center">

**Web App**

| Dashboard | Bookings | Video Call |
|-----------|----------|-----------|
| <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(4997).png" alt="Dashboard" width="220"> | <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(4996).png" alt="Bookings" width="220"> | <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(4995).png" alt="Video Call" width="220"> |

**Mobile App**

 | Dashboard | Calls |
|-----------|-------|
| <img src="./Project%20Images/Trainer%20Mobile%20Application%20Images/WhatsApp%20Image%202026-08-06%20at%2017.30.02.jpeg" alt="Dashboard" width="180"> | <img src="./Project%20Images/Trainer%20Mobile%20Application%20Images/WhatsApp%20Image%202026-08-06%20at%2017.30.02%20(1).jpeg" alt="Calls" width="180"> |

</div>

---

## 🛠️ Tech Stack

**Frontend (Web)**
```
React 19 | Vite 8 | React Router 7 | React Compiler
```

**Mobile**
```
Flutter 3.x | Supabase Flutter SDK | Provider | Agora RTC Engine
```

**Backend**
```
Node.js | Express 5 | Supabase (PostgreSQL + Auth + Realtime)
```

**Infrastructure**
```
Agora RTC (Video) | NodeMailer (Email) | Vercel (Frontend) | Render (Backend)
```

---

## 📦 Project Architecture

```
getfitai/
├── 📂 frontend/              React dashboard for trainers
│   ├── src/pages/           Dashboard, auth, video call screens
│   ├── src/components/      Reusable UI components
│   └── vite.config.js       Proxy to backend /api
│
├── 📂 mobile/               Flutter app (trainer + client)
│   ├── lib/screens/        Authentication, calls, bookings
│   ├── lib/services/       Supabase + Agora integration
│   └── pubspec.yaml        Dependencies & asset config
│
├── 📂 server/               Node.js/Express API
│   ├── routes/auth/         Registration, login, OTP, password reset
│   ├── routes/slots/        Slot CRUD, booking management
│   ├── routes/agora/        RTC token generation
│   └── middleware/          Auth validation, error handling
│
└── 📂 supabase/             Database schema & migrations
    ├── migrations/          SQL table definitions
    └── seed.sql            Sample data for testing

```

---

## 🚀 Getting Started in 5 Minutes

<div align="center">
  <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(4999).png" alt="GetFit Video Call Interface" width="700" style="border-radius: 12px; margin: 20px 0;">
</div>

### Prerequisites
- **Node.js** 18+ and npm
- **Flutter SDK** 3.x (for mobile)
- **Supabase** account with project credentials
- **Agora** App ID and token service
- **SMTP** credentials (Gmail, SendGrid, etc.)

### 1️⃣ Clone & Navigate
```bash
git clone https://github.com/AAbdullahRajput/Get-Fit-Ai-Web-Trainer-Website-And-Mobile-Application-.git
cd Get-Fit-Ai-Web-Trainer-Website-And-Mobile-Application-
```

### 2️⃣ Backend Setup
```bash
cd server
npm install
cp .env.example .env
```

**Fill in `.env`:**
```env
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...your_key...
INTERNAL_API_SECRET=your_secret_key_here
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
```

```bash
npm run dev
# Server ready at http://localhost:5000
```

### 3️⃣ Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
# Open http://localhost:5173
```

**Environment (`.env`):**
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...your_anon_key...
```

### 4️⃣ Mobile Setup
```bash
cd ../mobile
flutter pub get

# Create `.env` file in project root:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=eyJ...your_anon_key...
AGORA_APP_ID=your_agora_app_id

flutter run
```

---

## 🖥️ Web Dashboard Preview

<div align="center">
  <img src="./Project%20Images/Trainer%20Website%20Images/Screenshot%20(4998).png" alt="GetFit Web Dashboard" width="700" style="border-radius: 12px; margin: 20px 0;">
</div>

---

## 🧭 Web App Routes

| Route | Purpose |
|-------|---------|
| `/` | Launch screen |
| `/home` | Marketing landing page |
| `/login`, `/signup` | Authentication forms |
| `/forgot-password`, `/verify` | Account recovery & OTP |
| **`/dashboard`** | **Main trainer hub** (Home, Bookings, History, Profile) |
| `/slots` | Manage training slots |
| `/video-call/:id` | Active video call |
| `/outgoing-call/:id` | Outgoing call screen |
| `/privacy-policy`, `/terms` | Legal pages |

---

## 📱 Mobile App Screens

<div align="center">
  <img src="./Project%20Images/Trainer%20Mobile%20Application%20Images/WhatsApp%20Image%202026-08-06%20at%2017.30.01%20(1).jpeg" alt="GetFit Mobile App" width="500" style="border-radius: 12px; margin: 20px 0;">
</div>

1. **Launch** — Splash screen with app branding
2. **Auth Flow** — Login → Signup → Forgot Password → OTP Verification
3. **Dashboard** — Home (stats), Bookings, History, Profile
4. **Calls** — Incoming modal, Outgoing screen, Active video call
5. **Client List** — Browse & search booked clients
6. **Settings** — Profile, logout, notifications

---

## 🗄️ Database Schema

### Core Tables

**trainers**
```sql
id, email, name, phone, experience, specialties, bio, 
profile_image_url, session_price, rating, created_at
```

**clients**
```sql
id, name, email, mobile, profile_image_url, created_at
```

**trainer_slots**
```sql
id, trainer_id, date, start_time, end_time, price, 
is_booked, booked_by_client_id, status, virtual
```

**booked_slots**
```sql
id, slot_id, trainer_id, client_id, date, start_time, 
end_time, price, status, created_at
```

**call_history**
```sql
id, trainer_id, client_id, call_type (outgoing/incoming), 
status (connected/missed/declined), duration, timestamp
```

---

## 🔑 Key API Endpoints

### Authentication
```
POST   /api/auth/register          Register new trainer
POST   /api/auth/login             Login with email & password
POST   /api/auth/send-otp          Send OTP to email
POST   /api/auth/verify-otp        Verify OTP code
POST   /api/auth/forgot-password   Request password reset
POST   /api/auth/reset-password    Complete password reset
```

### Slots & Bookings
```
POST   /api/slots/create           Create new training slot
GET    /api/slots/:trainerId       Get trainer's slots
GET    /api/slots/:slotId/clients  Get bookings for slot
POST   /api/bookings               Book a slot
GET    /api/bookings/:trainerId    Get trainer's bookings
```

### Video Calls
```
POST   /api/agora/generate-token   Get RTC token for call
POST   /api/calls/log              Log call metadata
GET    /api/calls/history          Fetch call history
```

---

## 🎨 UI/UX Highlights

✨ **Dark theme** optimized for trainer workflows  
✨ **Real-time updates** via Supabase Realtime  
✨ **Responsive design** (mobile, tablet, desktop)  
✨ **Smooth animations** and micro-interactions  
✨ **Accessible** color contrast and navigation  
✨ **Fast** — Vite builds in <1s, Flutter JIT refresh  

---

## 📊 Performance & Scalability

- **Database** — Supabase with indexed queries for fast slot lookups
- **Real-time Sync** — Supabase Realtime for instant booking updates
- **CDN** — Vercel for static asset delivery
- **Backend** — Render auto-scaling for API requests
- **Video** — Agora's global server network for low-latency calls

---

## 🔒 Security

- ✅ Row-level security (RLS) on Supabase tables
- ✅ JWT authentication on all API endpoints
- ✅ Environment variables for sensitive keys (never hardcoded)
- ✅ HTTPS-only for all external communications
- ✅ Password hashing via Supabase Auth
- ✅ SMTP credentials validated server-side
- ✅ See [SECURITY.md](./SECURITY.md) for detailed policies

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork** the repository
2. **Create a branch**: `git checkout -b feature/your-feature`
3. **Commit changes**: `git commit -m 'Add your feature'`
4. **Push**: `git push origin feature/your-feature`
5. **Open a Pull Request**

---

## 📋 Roadmap

- [ ] Trainer reviews & ratings system
- [ ] Group training sessions (1-to-many)
- [ ] Payment subscriptions (monthly plans)
- [ ] AI workout recommendations
- [ ] Wearable device integration (Apple Watch, Fitbit)
- [ ] Analytics dashboard (trainee progress tracking)
- [ ] Multi-language support

---

## 📝 License

© 2026 GetFit AI. All rights reserved.

*Built for trainers, by trainers. Designed to scale your coaching business.*

---

## 💬 Support & Feedback

Have questions or found a bug?
- 📧 Email: support@getfitai.com
- 🐛 [Open an issue](https://github.com/AAbdullahRajput/Get-Fit-Ai-Web-Trainer-Website-And-Mobile-Application-/issues)
- 💡 [Start a discussion](https://github.com/AAbdullahRajput/Get-Fit-Ai-Web-Trainer-Website-And-Mobile-Application-/discussions)

---

<div align="center">

**Made with ❤️ by [Ahmad Abdullah](https://github.com/AAbdullahRajput)**

[⭐ Star us on GitHub](https://github.com/AAbdullahRajput/Get-Fit-Ai-Web-Trainer-Website-And-Mobile-Application-) — it helps!

</div>
