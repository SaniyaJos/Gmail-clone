# Gmail Clone (Fullstack Web Application)

A web-based Gmail Clone built with HTML, CSS, JavaScript, Node.js, Express, and MongoDB.

## Features
- User Authentication (Sign up & Sign in with MongoDB persistence)
- Interactive Inbox & Email Interface (Compose, view, star, delete, search, filter emails)
- Responsive Modern UI design mimicking Gmail
- RESTful API Backend built with Express & Mongoose
- Spam Detection: rule-based spam filter, Spam folder with unread count, Report spam / Not spam actions
- Auto-Delete: Bin and Spam emails are permanently deleted after 30 days (backend cleanup job), plus an "Empty Bin now" button

## Project Structure
```text
Gmail/
├── index.html            # Landing / Welcome Page
├── signin.html           # Login Page
├── signin.js             # Login Logic & API Integration
├── signup.html           # Registration Page
├── signup.js             # Registration Logic & API Integration
├── inbox.html            # Main Inbox Interface
├── inbox.js              # Inbox Features & API Integration
├── inbox.css / style.css # Styling
├── images/               # Assets and UI icons
└── backend/              # Express + MongoDB API Server
    ├── models/           # Mongoose Data Schemas (User, Email, etc.)
    ├── services/         # spamService.js (spam detection), cleanupService.js (30-day auto-delete)
    ├── server.js         # Express Server Entry Point
    ├── package.json      # Dependencies
    └── .env.example      # Sample Environment Variables
```

## Setup & Running Locally

### 1. Backend Setup
1. Open terminal and navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file in the `backend` folder based on `.env.example`:
   ```env
   PORT=5000
   MONGODB_URI=your_mongodb_connection_string
   ```
4. Start the backend server:
   - For production / normal run:
     ```bash
     npm start
     ```
   - For development (auto-reload with nodemon):
     ```bash
     npm run dev
     ```

### 2. Frontend Setup
- Open `index.html` or `signin.html` directly in your browser or run with Live Server (VS Code extension).

## Security Note
Make sure never to commit your actual `.env` file containing sensitive database credentials. `.env` is listed in `.gitignore`.