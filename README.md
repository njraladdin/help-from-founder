# Help From Founder

A platform connecting users with project founders. Users can submit questions or report issues, and founders can respond directly to help their users.

## Features

- Users can submit questions or report issues without needing to log in
- Each project has its own dedicated page at /project-name
- Founders can create project pages after registering and logging in with Google
- Founder responses are tagged to distinguish them from other replies
- Threads can be marked as resolved or closed by the founder
- Project pages are public and accessible to anyone

## Tech Stack

- **Frontend**: React with TypeScript
- **Styling**: TailwindCSS
- **Backend**: Firebase (Authentication, Firestore, Hosting)
- **Routing**: React Router

## Getting Started

### Prerequisites

- Node.js (version 16 or higher)
- npm or yarn
- Firebase account

### Firebase Project Setup

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
2. Enable Google Authentication:
   - Go to Authentication > Sign-in method
   - Enable the Google provider
   - Configure the OAuth consent screen if prompted
3. Set up Firestore Database:
   - Go to Firestore Database > Create database
   - Start in production mode
   - Choose a location close to your users
4. Deploy Firestore Security Rules:
   - Use the rules in `firestore.rules` as a starting point
   - Deploy them using Firebase CLI or the Firebase Console
5. Enable Firestore Indexes:
   - Deploy the indexes in `firestore.indexes.json`

### Installation

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/help-from-founder.git
   cd help-from-founder
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Set up environment variables:
   - Copy `.env.example` to `.env`
   - Fill in your Firebase configuration values
   - Ensure the Firebase project has Google Auth and Firestore enabled

4. Start the development server:
   ```
   npm run dev
   ```

5. Open [http://localhost:5173](http://localhost:5173) to view the app.

### Troubleshooting Common Issues

- **400 Bad Request errors with Firestore**: Ensure Firestore is enabled and properly configured in your Firebase project. Check that your Firebase project ID in the `.env` file exactly matches the one in the Firebase console.

- **Google Authentication Issues**: Make sure that Google sign-in is enabled in the Firebase Authentication console and that you have properly configured the OAuth consent screen.

- **Authentication Popup Issues**: If you're having issues with authentication popups, try running the app in a regular browser window (not in an iframe or embedded view).

## Deployment

1. Build the project:
   ```
   npm run build
   ```

2. Deploy to Firebase Hosting:
   ```
   npm install -g firebase-tools
   firebase login
   firebase deploy
   ```

## Project Structure

- `src/`: Source code
  - `components/`: Reusable UI components
  - `lib/`: Utilities and Firebase configuration
  - `pages/`: Application pages
  - `App.tsx`: Main application component
  - `main.tsx`: Entry point
- `firestore.rules`: Security rules for Firestore
- `firestore.indexes.json`: Index configurations for Firestore
- `firebase.json`: Firebase project configuration

## Contributing

1. Fork the project
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request
