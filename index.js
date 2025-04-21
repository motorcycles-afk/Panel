/*
██████╗ ██████╗  █████╗  ██████╗ ██████╗ 
██╔══██╗██╔══██╗██╔══██╗██╔════╝██╔═══██╗
██║  ██║██████╔╝███████║██║     ██║   ██║
██║  ██║██╔══██╗██╔══██║██║     ██║   ██║
██████╔╝██║  ██║██║  ██║╚██████╗╚██████╔╝
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═════╝            
 *              
/*
*/ 
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const bodyParser = require('body-parser');
const CatLoggr = require('cat-loggr');
const fs = require('node:fs');
const config = require('./config.json')
const ascii = fs.readFileSync('./handlers/ascii.txt', 'utf8');
const app = express();
const path = require('path');
const chalk = require('chalk');
const expressWs = require('express-ws')(app);
const { db } = require('./handlers/db.js')
const translationMiddleware = require('./handlers/translation');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const theme = require('./storage/theme.json');
const { loadPlugins } = require('./plugins/loadPls.js');
const { init } = require('./handlers/init.js');
const SQLiteStore = require('connect-sqlite3')(session);

const log = new CatLoggr();

// Basic middleware setup
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
// app.use(cookieParser()); // Temporarily disabled

// Set up view engine
app.set('view engine', 'ejs');

// Rate limiter for POST requests (Temporarily disabled)
/*
const postRateLimiter = rateLimit({
  windowMs: 60 * 100,
  max: 6,
  message: 'Too many requests, please try again later'
});

app.use((req, res, next) => {
  if (req.method === 'POST') {
    postRateLimiter(req, res, next);
  } else {
    next();
  }
});
*/

// --- Session and Passport Setup ---
// Session middleware - MUST BE BEFORE PASSPORT
const sessionSecret = config.sessionSecret || "default_fallback_secret";
app.use(session({
  store: new SQLiteStore({
    db: 'sessions.db',
    dir: '.'
  }),
  secret: sessionSecret,
  resave: true,
  saveUninitialized: true,
  cookie: {
    secure: false,
    httpOnly: true,
    maxAge: 3600000
  },
  name: 'app.session'
}));
log.info("Express session middleware configured.");

// Passport initialization - MUST BE AFTER SESSION
app.use(passport.initialize());
app.use(passport.session()); // Handles req.user, req.isAuthenticated, etc.
log.info("Passport middleware initialized.");

// Translation middleware - AFTER PASSPORT (Temporarily disabled)
// app.use(translationMiddleware);

// Authenticate routes that need protection (Temporarily disabled - rely on passport.session())
/*
app.use('/instance', (req, res, next) => {
  if (!req.isAuthenticated()) {
    log.warn(`Unauthorized access attempt to /instance route: ${req.path}`);
    return res.redirect('/login?err=AuthRequired');
  }
  next();
});

app.use('/instances', (req, res, next) => {
  if (!req.isAuthenticated()) {
    log.warn(`Unauthorized access attempt to /instances route: ${req.path}`);
    return res.redirect('/login?err=AuthRequired');
  }
  next();
});
*/

// Additional security for protected routes (Temporarily disabled)
/*
app.use((req, res, next) => {
  const url = req.originalUrl || req.url;
  if (url === '/instances' || url.startsWith('/instances/') || 
      url === '/instance' || url.startsWith('/instance/')) {
    if (!req.isAuthenticated()) {
      log.warn(`Blocked direct access attempt to protected URL: ${url}`);
      return res.redirect(`/login?blocked=true&from=${encodeURIComponent(url)}`);
    }
  }
  next();
});
*/

// Zombie session detection (Temporarily disabled)
/*
app.use((req, res, next) => {
  const hasSessionButNoUser = req.session && !req.isAuthenticated();
  const hasSessionWithoutPassport = req.session && !req.session.passport;
  
  if (hasSessionButNoUser || hasSessionWithoutPassport) {
    log.warn('Detected zombie session, cleaning up...');
    req.session.destroy(err => {
      if (err) console.error('Error destroying zombie session:', err);
      
      res.clearCookie('app.session', { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('sid', { path: '/' });
      
      if (req.path !== '/login' && req.path !== '/' && !req.path.startsWith('/auth/')) {
        return res.redirect('/login?err=SessionCleanup');
      }
      next();
    });
  } else {
    next();
  }
});
*/

// Add locals for templates
app.use(async (req, res, next) => {
  try {
    const settings = await db.get('settings') || {};
    res.locals.languages = getlanguages();
    res.locals.ogTitle = config.ogTitle;
    res.locals.ogDescription = config.ogDescription;
    res.locals.footer = settings.footer || '';
    res.locals.theme = theme;
    next();
  } catch (error) {
    console.error('Error fetching settings:', error);
    next(); // Continue even if settings fail
  }
});

// Production mode headers (Temporarily disabled)
/*
if (config.mode === 'production') {
  app.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '5');
    next();
  });

  app.use('/assets', (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=1');
    next();
  });
}
*/

// Plugin setup
let loadedPlugins = loadPlugins(path.join(__dirname, './plugins'));
let pluginConfigs = Object.values(loadedPlugins).map(plugin => plugin.config);

const pluginRoutes = require('./plugins/pluginmanager.js');
app.use("/", pluginRoutes);
const pluginDir = path.join(__dirname, 'plugins');
const pluginViewDirs = fs.readdirSync(pluginDir)
  .map(addonName => path.join(pluginDir, addonName, 'views'))
  .filter(viewDir => fs.existsSync(viewDir)); // Ensure view directory exists
app.set('views', [path.join(__dirname, 'views'), ...pluginViewDirs]);

// Initialize application data (like default settings if needed)
init();

// Log the ASCII banner
console.log(chalk.gray(ascii) + chalk.white(`version v${config.version}\n`));

// Load routes dynamically
const routesDir = path.join(__dirname, 'routes');
loadRoutes(routesDir);
log.info("Application routes loaded.")

// Serve static files from 'public' directory
app.use(express.static('public'));

// Last resort security check before 404
app.use((req, res, next) => {
  const url = req.originalUrl || req.url;
  if (url === '/instances' || url.startsWith('/instances/') || 
      url === '/instance' || url.startsWith('/instance/')) {
    if (!req.user) { // Checking req.user is more reliable here after passport runs
      log.error(`LAST DEFENSE: Caught unauthorized access to ${url}`);
      return res.redirect(`/login?critical=true&t=${Date.now()}`);
    }
  }
  next();
});

// Start the HTTP server
const server = app.listen(config.port, () => log.info(`DracoPanel is listening on port ${config.port}`));

// Apply WebSocket support AFTER server is created
expressWs.getWss().on('connection', (ws, req) => {
  log.info('WebSocket connection established');
});

// 404 handler for any routes not matched
app.get('*', async function(req, res){
  log.warn(`404 Not Found for route: ${req.path}`);
  try {
    res.status(404).render('errors/404', {
      req,
      name: await db.get('name') || 'DracoPanel',
      logo: await db.get('logo') || false
    });
  } catch (err) {
    log.error("Error rendering 404 page:", err);
    res.status(500).send("Internal Server Error");
  }
});

// --- Helper Functions ---
function getlanguages() {
  try {
    const langDir = path.join(__dirname, '/lang');
    if (!fs.existsSync(langDir)) return [];
    return fs.readdirSync(langDir).map(file => file.split('.')[0]);
  } catch (error) {
    log.error('Error reading languages:', error);
    return [];
  }
}

function getlangname() {
  try {
    const langDir = path.join(__dirname, '/lang');
    if (!fs.existsSync(langDir)) return [];
    return fs.readdirSync(langDir).map(file => {
      const langFilePath = path.join(langDir, file);
      try {
        const langFileContent = JSON.parse(fs.readFileSync(langFilePath, 'utf-8'));
        return langFileContent.langname;
      } catch (parseError) {
        log.error(`Error parsing language file ${file}:`, parseError);
        return null;
      }
    }).filter(name => name !== null); // Filter out nulls from failed parses
  } catch (error) {
    log.error('Error reading language names:', error);
    return [];
  }
}

// Language switcher route
app.get('/setLanguage', async (req, res) => {
  const lang = req.query.lang;
  const availableLangs = getlanguages(); // No need for await here
  if (lang && availableLangs.includes(lang)) {
      res.cookie('lang', lang, { maxAge: 90000000, httpOnly: true, sameSite: 'strict' });
      if (req.user) req.user.lang = lang; // Only update if user exists
      res.json({ success: true });
  } else {
      res.status(400).json({ success: false, error: 'Invalid language' });
  }
});

// Route loader function
function loadRoutes(directory) {
  fs.readdirSync(directory).forEach(file => {
    const fullPath = path.join(directory, file);
    try {
      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        loadRoutes(fullPath); // Recurse into subdirectories
      } else if (stat.isFile() && path.extname(file) === '.js') {
        const route = require(fullPath);
        if (typeof route === 'function' || typeof route.router === 'function') {
          
          // Determine if this is the auth route
          // Note: path.sep provides the correct directory separator ('\' on Windows, '/' on Linux/Mac)
          const authRoutePath = path.join('routes', 'auth.js');
          const isAuthRoute = fullPath.endsWith(authRoutePath);

          // Apply WebSocket support specifically to routers, *except* auth.js
          if (route.stack && !isAuthRoute) { 
            log.info(`Applying WebSocket support to router: ${file}`); 
            expressWs.applyTo(route);
          } else if (isAuthRoute) {
             log.info(`Skipping WebSocket support for auth router: ${file}`); 
          }
          
          app.use("/", route); 
        } else {
          log.warn(`Skipping non-router module: ${file}`);
        }
      }
    } catch (error) {
      log.error(`Error loading route from ${fullPath}:`, error);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', () => {
  log.info('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    log.info('HTTP server closed');
    // Close database connections if necessary
    if (sessionDb) sessionDb.close();
    if (db && typeof db.close === 'function') db.close(); 
    process.exit(0);
  });
});
