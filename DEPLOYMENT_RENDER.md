# Render Deployment — ScriptFlow Pro v2.8

## Recommended service type

Use **Web Service / Node**, not Static Site, because this project contains `server.js` and the Render configuration starts the Express server.

## Render settings

| Setting | Value |
|---|---|
| Name | `scriptflow-pro` |
| Branch | `main` |
| Root Directory | Blank when `package.json` is at repository root |
| Runtime | Node |
| Build Command | `npm ci && npm run build` |
| Start Command | `npm start` |
| Auto-Deploy | Yes |
| Pull Request Previews | Optional |
| Node Version | `20.11.0` |

Do not configure a Static Site Publish Directory when using the Node Web Service configuration.

## Repository layout

For a blank Root Directory, `package.json`, `render.yaml`, `server.js`, `src/`, and `vite.config.ts` should be directly inside the GitHub repository root.

