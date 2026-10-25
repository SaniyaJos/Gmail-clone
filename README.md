# InboxFlow — Fullstack Gmail Clone

**InboxFlow** is a modern, responsive, fullstack email application inspired by Google Gmail. Built with a high-performance **React (Vite)** frontend, an **Express.js & MongoDB Atlas** backend, an embedded **Scikit-Learn Machine Learning** spam detection engine, and an **AI-powered Action Extraction Engine** powered by Google Gemini.

---

## 🚀 Key Features

### 📩 Email & Conversation Management
- **Folder Navigation**: Dedicated views for **Inbox**, **Starred**, **Sent**, **Drafts**, **Spam**, **Bin**, and **All Mail**.
- **Real-Time Badge Counts**: Live unread indicators for Inbox and Spam, total drafts, total action items, and combined mail counts.
- **Conversation Threading**: Groups related replies and forwards into collapsible, Gmail-style conversation cards.
- **Rich Compose & Drafts**: Auto-save drafts, multi-recipient addressing (`to`), subject, rich text formatting, and attachments.
- **Fast Search & Advanced Filters**: Instant client-side and server-side search across subject, sender, and content, plus an advanced search modal (sender, recipient, subject, keywords).
- **Bulk Actions**: Select all/individual emails to mark read/unread, star, move to Bin, report as spam, or apply labels.

### 🤖 Machine Learning Spam Classification
- **Trained Local ML Model**: Classifies incoming emails in real-time using a custom-trained Scikit-Learn pipeline (`CalibratedClassifierCV` with `LinearSVC` + `TfidfVectorizer`).
- **High-Speed Python Daemon**: Interfaced via a lightweight, persistent Python subprocess (`predict.py --daemon`) for sub-10ms inference.
- **User Preference Memory**: Respects explicit user decisions—reporting an email as spam or marking it "Not spam" updates personal sender preferences that override ML rules.
- **Clean Warning Banners**: Contextual, non-technical spam explanations inside spam emails explaining why a message was flagged.

### ✨ AI Action Engine (Email-to-Action)
- **One-Click Task Extraction**: Extract actionable to-dos directly from email conversations using Google Gemini AI.
- **Smart Metadata**: Automatically identifies task titles, detailed descriptions, deadlines, and urgency ratings (**High**, **Medium**, **Low**).
- **"My Actions" Dashboard**: Centralized productivity view in the sidebar to manage, filter, mark completed, or delete extracted tasks.
- **Email Reference Linking**: Direct navigation from any task back to the source email message.

### 🏷️ Custom Labels
- Create, rename, and delete personalized labels from the sidebar.
- Apply or remove labels individually or in bulk across conversations.
- Filter emails by clicking any label in the sidebar.

### 📎 Secure Attachments & GridFS Storage
- Support for attachments (images, PDFs, documents, text files) with client-side drag-and-drop.
- Secure, token-authorized streaming and downloads (`/api/emails/:id/attachments/:attachmentId/download`).
- Automatic synchronization between local disk uploads and MongoDB GridFS.

### 🌓 Dark Mode & Design System
- Built with a curated Vanilla CSS token design system featuring sleek Gmail-authentic typography, gradients, and subtle micro-animations.
- Fully integrated **Dark Mode** and **Light Mode** across all pages, email conversation modals, compose views, and sidebars.
- Smooth transition between themes with user preference persisted in local storage.

### ⚙️ Quick Settings & Account Management
- Quick Settings dropdown accessible beside the profile avatar in the header.
- Theme switcher accessible directly from Settings.
- **Permanent Account Deletion**: Self-service account deletion with confirmation modal. Permanently purges user account, personal emails, tasks, custom labels, and spam preferences from MongoDB without affecting other users' sent history.

### 🧭 Guided Tour & Onboarding
- **First-Time Auto Popup**: Automatically welcomes newly registered users with an interactive, multi-step onboarding guide.
- **On-Demand Help**: Access the searchable InboxFlow Guide anytime by clicking the question mark (`?`) icon in the top header.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, Vite, React Router v7, Context API, Vanilla CSS (Design Tokens) |
| **Backend** | Node.js, Express.js, Mongoose, JSON Web Tokens (JWT), Multer |
| **Database** | MongoDB Atlas (Cloud Database) & MongoDB GridFS (File Storage) |
| **Machine Learning** | Python 3.11, Scikit-Learn (`CalibratedClassifierCV`, `TfidfVectorizer`), Joblib |
| **AI Integration** | Google Gemini Generative AI SDK (`@google/genai`) |

---

## 📁 Project Structure

```text
Gmail/
├── frontend/                     # React Single Page Application (Vite)
│   ├── public/                   # Static assets & SVG icons
│   │   └── images/               # UI icons, logos, and illustrations
│   ├── src/
│   │   ├── components/
│   │   │   ├── common/           # ConfirmDialog, ThemeToggle, ToastSnackbar
│   │   │   ├── compose/          # ComposeModal (drafting & attachments)
│   │   │   ├── guide/            # InboxGuide & spotlight tour
│   │   │   ├── layout/           # Header, Sidebar, Account & Settings Dropdowns
│   │   │   ├── mail/             # EmailList, EmailDetailsModal, ThreadMessageCard
│   │   │   └── tasks/            # ActionsPanel, InlineTaskSection
│   │   ├── context/              # AuthContext, ThemeContext
│   │   ├── pages/                # LandingPage, SignInPage, SignUpPage, InboxPage
│   │   ├── services/             # Axios/fetch API wrappers (api.js)
│   │   ├── styles/               # Component & theme stylesheets (theme.css, inbox.css)
│   │   ├── utils/                # Date/time formatters, thread grouping
│   │   ├── App.jsx               # Router & global providers
│   │   └── main.jsx              # React entry point
│   ├── package.json
│   └── vite.config.js
│
├── backend/                      # Express.js REST API Server
│   ├── controllers/              # Route handlers (emailController, attachmentController)
│   ├── middleware/               # Authentication & token verification (authMiddleware)
│   ├── ml/                       # Scikit-Learn spam classification models
│   │   ├── model.pkl             # Trained CalibratedClassifierCV model
│   │   ├── vectorizer.pkl        # Fitted TF-IDF Vectorizer
│   │   └── predict.py            # High-speed Python inference worker
│   ├── models/                   # Mongoose schemas (User, Email, Task, Label, SpamPreference)
│   ├── routes/                   # Modular API routers (emailRoutes, taskRoutes, labelRoutes)
│   ├── services/                 # AI service, ML classifier, spam & cleanup schedulers
│   ├── server.js                 # Express server bootstrap & auth endpoints
│   ├── package.json
│   └── .env.example              # Sample environment configuration
│
└── README.md
```

---

## ⚙️ Local Development Setup

### 1. Prerequisites
- **Node.js** (v18 or higher) & **npm**
- **Python 3.11+** with `scikit-learn`, `numpy`, and `joblib` installed:
  ```bash
  pip install scikit-learn numpy joblib
  ```
- A **MongoDB Atlas** cluster connection URI (or local MongoDB instance).

---

### 2. Backend Setup

1. Open a terminal and navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/gmail-clone?retryWrites=true&w=majority
   JWT_SECRET=your_super_secret_key_at_least_32_characters_long
   GEMINI_API_KEY=your_google_gemini_api_key
   ```
4. Start the backend development server:
   ```bash
   npm run dev
   ```
   The backend will start on **`http://localhost:5000`** and pre-warm the Python ML classifier.

---

### 3. Frontend Setup

1. Open a new terminal and navigate to the `frontend/` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open **`http://localhost:5173`** in your browser.

---

## 📡 REST API Reference

### Authentication & Account
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/signup` | Register a new user account (`@flow.com`) |
| `POST` | `/api/signin` | Authenticate user and receive an 8-hour JWT |
| `POST` | `/api/check-username` | Validate username availability in real-time |
| `DELETE` | `/api/account` | Permanently delete authenticated account and all user data |

### Emails & Conversations
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/emails` | List emails filtered by folder, label, search, or unread |
| `GET` | `/api/emails/counts` | Get real-time badge counts for folders and unread mail |
| `GET` | `/api/emails/:id` | Retrieve an email message and its thread conversation |
| `POST` | `/api/emails` | Send a new email or save a draft (triggers ML spam detection) |
| `PATCH` | `/api/emails/read` | Mark selected emails as read / unread |
| `PATCH` | `/api/emails/star` | Toggle star on an email |
| `PATCH` | `/api/emails/trash` | Move emails to Bin or restore them |
| `DELETE` | `/api/emails` | Permanently delete emails from Bin/Spam |
| `POST` | `/api/emails/empty-folder` | Empty all messages from Bin or Spam |
| `POST` | `/api/emails/:id/spam` | Report an email as Spam (remembers user preference) |
| `POST` | `/api/emails/:id/not-spam` | Mark an email as Not Spam and return to Inbox |

### AI Tasks & Actions
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/tasks/extract` | Extract action items from an email via Gemini AI |
| `GET` | `/api/tasks` | Fetch extracted tasks for the authenticated user |
| `PATCH` | `/api/tasks/:id/status` | Toggle task completion status (`Pending` / `Completed`) |
| `DELETE` | `/api/tasks/:id` | Delete an extracted task |

### Custom Labels
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/labels` | List all custom labels for the authenticated user |
| `POST` | `/api/labels` | Create a new custom label |
| `PATCH` | `/api/labels/:id` | Rename an existing label |
| `DELETE` | `/api/labels/:id` | Delete a label (unlinks from emails without deleting them) |
| `PATCH` | `/api/emails/bulk-labels` | Apply or remove labels across multiple emails |

---

## 🔒 Security & Privacy

- **Data Isolation**: User emails, tasks, and labels are strictly scoped to the authenticated user's address. Account deletion cleanly purges only the deleted user's records.
- **Private Attachments**: Uploaded attachments are stored in non-public directories / GridFS and require signed JWT authorization to stream or download.
- **Environment Secrets**: Database URIs, Gemini API keys, and JWT secrets are kept in git-ignored `.env` files.
- **Automated Lifecycle**: Background cleanup job runs hourly to automatically purge Bin and Spam emails older than 30 days.

---

## 📄 License
This project is for educational and portfolio demonstration purposes. All rights to original brand assets and references belong to their respective copyright holders.