# DracoPanel  

**DracoPanel** is an open-source, modern game server and application management panel built with **Node.js, Docker, and Express**. It is designed to work seamlessly with the **DracoDaemon** backend.  

![GitHub](https://img.shields.io/badge/license-MIT-blue) ![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green) ![Status](https://img.shields.io/badge/status-active-brightgreen)  

## Features  
- **Game Server Management** - Easily deploy and control game servers  
- **Docker Integration** - Containerized applications for better isolation  
- **User-Friendly UI** - Intuitive dashboard for server administration  
- **Multi-OS Support** - Works on Linux, Windows (limited), and macOS  

## Installation  

### 1. Choose Your Operating System  

| OS         | Version  | Supported | Notes                         |
|------------|----------|-----------|-------------------------------|
| Ubuntu     | 24.04    | ✅ Yes    | Recommended                   |
|            | 22.04    | ✅ Yes    |                               |
| Debian     | 11, 12   | ✅ Yes    | Stable and well-tested        |
| CentOS     | 7, 8     | ⚠️ Partial | CentOS 8 is EOL              |
| Windows    | 10, 11   | ⚠️ Partial | Needs firewall adjustments   |
| macOS      | 10.15+   | ⚠️ Partial | Not for production use       |

### 2. Install Dependencies  

* Node.js `v20` and higher (Nodejs `v20` recommended).
* ### Installation Nodejs 20

```bash
curl -sL https://deb.nodesource.com/setup_20.x | sudo bash -
```
```bash
apt-get install nodejs -y
```

### Installation Panel

To install and start the Draco Panel , run the following commands:

```bash
git clone https://github.com/draco-labes/panel-v1.0.0.git && cd panel-v1.0.0 && npm install && npm run seed && npm run createUser && node .
```

## Database Information

DracoPanel uses SQLite for data storage via the Keyv library. Two database files are created when you run the application:

- `skyport.db` - Contains all application data including users, instances, settings, etc.
- `sessions.db` - Stores active user sessions

### Database Initialization

The application will automatically create these database files if they don't exist. The first time you run the application, you'll need to create an admin user with:

```bash
npm run createUser
```

### Preparing for GitHub

When contributing to this project, make sure to:

1. **Remove database files before committing**:
   ```bash
   rm skyport.db sessions.db
   ```
   
2. **Update the Discord OAuth credentials** in config.json:
   ```json
   "discord": {
       "clientId": "YOUR_DISCORD_CLIENT_ID",
       "clientSecret": "YOUR_DISCORD_CLIENT_SECRET",
       "callbackURL": "http://localhost:3000/auth/discord/callback",
       "useLocal": true
   }
   ```

3. **Don't commit sensitive files** - Check that no personal information, API keys, or secrets are in your commits

> Note: The `.gitignore` file is already set up to exclude database files and other sensitive information.

## Credits  
- **Developed by**: hopingboyz
- **made by**: hopingboyz   
- **Powered by**: WEBLAB  
- **Special Thanks**: SRYDEN

# Discord OAuth2 Setup (Localhost-Friendly)

To enable Discord login functionality for local development (even if you plan to use Cloudflare later), follow these steps:

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Create a new application or use an existing one
3. Navigate to the "OAuth2" section in the left sidebar
4. Add these redirect URLs (add both to be safe):
   - `http://localhost:3000/auth/discord/callback`
   - `http://127.0.0.1:3000/auth/discord/callback`
5. Copy the Client ID and Client Secret
6. Update your config.json file with the credentials:

```json
"discord": {
    "clientId": "YOUR_DISCORD_CLIENT_ID",
    "clientSecret": "YOUR_DISCORD_CLIENT_SECRET",
    "callbackURL": "http://localhost:3000/auth/discord/callback",
    "useLocal": true
}
```

7. Install the required dependency:
```
npm install passport-discord
```

8. Restart your application and test the Discord login functionality

## For Production Behind Cloudflare

If deploying behind Cloudflare later, you'll need to:

1. Add your production callback URL to Discord Developer Portal:
   - `https://yourdomain.com/auth/discord/callback`
2. Update config.json when deploying to production:
```json
"discord": {
    "clientId": "YOUR_DISCORD_CLIENT_ID",
    "clientSecret": "YOUR_DISCORD_CLIENT_SECRET",
    "callbackURL": "https://yourdomain.com/auth/discord/callback",
    "useLocal": false
}
```
