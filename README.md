# Gmail Clone (Fullstack Web Application)

A web-based Gmail Clone built with HTML, CSS, JavaScript, Node.js, Express, and MongoDB.

## Features
- User Authentication (Sign up & Sign in with MongoDB persistence)
- Interactive Inbox & Email Interface (Compose, view, star, delete, search, filter emails)
- Responsive Modern UI design mimicking Gmail
- RESTful API Backend built with Express & Mongoose
- Spam Detection: rule-based spam filter, Spam folder with unread count, Report spam / Not spam actions
- Auto-Delete: Bin and Spam emails are permanently deleted after 30 days (backend cleanup job), plus an "Empty Bin now" button
- Email attachments with private storage, authenticated downloads, and message details
- User-owned custom labels with persistent email associations, bulk actions, and label filtering
- Searchable in-app InboxFlow Guide with a guided tour and account-scoped first-time onboarding

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
├── inbox-guide.js / inbox-guide.css # In-app feature guide and guided tour
├── images/               # Assets and UI icons
└── backend/              # Express + MongoDB API Server
    ├── models/           # Mongoose Data Schemas (User, Email, etc.)
    ├── controllers/      # Email and attachment API handlers
    ├── middleware/       # Identity checks and validated multipart upload
    ├── services/         # Spam, cleanup, and private attachment storage
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
   JWT_SECRET=your_random_secret_of_at_least_32_characters
   ```
   Generate a secret with Node.js using `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` and keep it private. The backend refuses to start without it. Sign-in issues an eight-hour token used to authorize attachment access.
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

## Email Attachments

- Attachments are stored in the private `backend/uploads/` directory; only their filename, MIME type, byte size, and opaque storage reference are stored in each MongoDB email record. The upload directory is git-ignored and is never served as a static directory.
- Uploads are limited to 10 files per draft, with a maximum of 10 MB per file. Allowed types are common JPEG/PNG/GIF/WebP images, PDF, plain text, CSV, ZIP, and Microsoft Word/Excel/PowerPoint documents. The backend checks both the supplied MIME type and filename extension; it does not claim to inspect or verify file contents.
- Image previews and downloads require a valid bearer token and an email record owned by that signed-in account. Tokens are issued by `/api/signin` and expire after eight hours.
- Attachments stay with drafts, are copied to sent and recipient email records when sent, and are removed from disk when no email record references them. Image previews are limited to JPEG, PNG, GIF, and WebP.

## Custom Labels

Create, rename, and delete labels from the inbox sidebar. Labels are private to the signed-in account; label API requests require the bearer token returned by `/api/signin`. Names are trimmed, whitespace-normalized, limited to 50 characters, and unique per account without regard to case.

- `GET /api/labels` and `POST /api/labels` (JSON body: `{ "name": "Work" }`)
- `PATCH /api/labels/:labelId` (JSON body: `{ "name": "Projects" }`) and `DELETE /api/labels/:labelId`
- `PATCH /api/emails/:emailId/labels` and `PATCH /api/emails/bulk-labels` (JSON body: `{ "emailIds": ["..."], "labelId": "...", "action": "apply" }`; use `"remove"` to remove associations)
- Filter the existing email listing with `GET /api/emails?labelId=:labelId&folder=all`; include the signed-in user's bearer token. Existing folder and search query parameters can be used alongside the label filter.

Deleting a label removes its email associations but never deletes emails.
Existing email records remain compatible: the new `labels` array is optional and starts empty.

### Postman smoke test

1. **Sign in:** `POST http://localhost:5000/api/signin` with JSON such as:
   ```json
   { "email": "sender@flow.com", "password": "your-password" }
   ```
   Copy `user.token` from the response.
2. **Create a draft:** `POST http://localhost:5000/api/emails`, set `Authorization: Bearer <token>` and `Content-Type: application/json`, and send:
   ```json
   {
     "sender": "sender@flow.com",
     "receiver": "recipient@flow.com",
     "subject": "Files attached",
     "body": "See the attached files.",
     "isDraft": true
   }
   ```
   Copy `email._id` from the response.
3. **Upload files:** `POST http://localhost:5000/api/emails/<draftId>/attachments`, set `Authorization: Bearer <token>`, choose **Body → form-data**, and add one or more file fields named `attachments`. Postman supplies the multipart content type.
4. **Send the draft:** `POST http://localhost:5000/api/emails` with the bearer token and JSON `sender`, `receiver`, `subject`, `body`, and `draftId`. The application’s compose flow includes this `draftId` automatically so the stored attachment references are copied to the sent and received email records.
5. **Download:** use `GET http://localhost:5000/api/emails/<ownedEmailId>/attachments/<attachmentId>/download` with the same bearer token. The attachment id is in the email’s `attachments` metadata.
6. **Remove from draft:** use `DELETE http://localhost:5000/api/emails/<draftId>/attachments/<attachmentId>` with the bearer token. A request without a token should return `401`; unsupported types return `415`; files over 10 MB return `413`.

## Security Note
Make sure never to commit your actual `.env` file containing sensitive database credentials. `.env` is listed in `.gitignore`.