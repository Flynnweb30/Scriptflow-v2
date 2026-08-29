# Render Deployment — ScriptFlow Pro

## Service type
Use **Web Service / Node**, not Static Site. The project includes `server.js` and the existing `render.yaml` expects a Node service.

## Settings
- Name: `scriptflow-pro`
- Branch: `main`
- Root Directory: blank when `package.json` is at repository root
- Runtime: Node
- Build Command: `npm ci && npm run build`
- Start Command: `npm start`
- Node Version: `20.11.0`
- Auto-Deploy: Yes
- Pull Request Previews: Optional

Do not configure `dist` as a Static Site Publish Directory for this Node-service build.

## Environment variables
Set the required Firebase/Vite variables in Render Environment Variables. See `FIREBASE_SETUP.md` and `.env.example`.
