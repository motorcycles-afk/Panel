/**
 * @fileoverview Provides authentication middleware to ensure that routes are accessible only
 * to authenticated users. This middleware leverages Passport's authentication check to determine
 * if the user's session is currently authenticated. If the user is authenticated, it allows the
 * request to proceed. Otherwise, it redirects the user to the login page.
 */

const { db } = require('./db');

/**
 * Middleware function to check if the user is authenticated. Utilizes Passport's built-in method
 * to determine if the current session is authenticated. If the session is authenticated, it calls
 * 'next()' to pass control to the next middleware or route handler. If not authenticated, it
 * redirects the user to the login page.
 *
 * @param {Object} req - The HTTP request object, provided by Express.
 * @param {Object} res - The HTTP response object, provided by Express.
 * @param {Function} next - Callback function to pass execution to the next middleware or route handler.
 * @returns {void} Does not return a value; either calls the next middleware in the stack or redirects.
 */
function isAuthenticated(req, res, next) {
  // First check if the request has a valid session authentication
  if (req.isAuthenticated() && req.user) {
    // Additional check: verify the user still exists in the database
    const verifyUser = async () => {
      try {
        const users = await db.get('users') || [];
        const userExists = users.some(user => user.username === req.user.username);
        
        if (!userExists) {
          console.log(`User ${req.user.username} has a session but doesn't exist in database. Forcing logout.`);
          forceLogout(req, res);
          return;
        }
        
        // Add a timestamp to track last activity
        req.user.lastActive = Date.now();
        return next();
      } catch (error) {
        console.error('Error verifying user in database:', error);
        forceLogout(req, res);
        return;
      }
    };
    
    verifyUser();
  } else {
    // If there's any session data but not properly authenticated,
    // clear it completely to prevent session fixation
    if (req.session) {
      req.session.destroy((err) => {
        if (err) console.error('Error destroying invalid session:', err);
        res.clearCookie('app.session', { path: '/' });
        res.clearCookie('connect.sid', { path: '/' });
        res.clearCookie('sid', { path: '/' });
        
        // Redirect with cache prevention
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        
        const timestamp = Date.now();
        res.redirect(`/login?err=SessionExpired&t=${timestamp}`);
      });
    } else {
      res.redirect('/login');
    }
  }
}

// Helper function to force logout a user with invalid session
function forceLogout(req, res) {
  req.logout((err) => {
    if (err) console.error('Error during forced logout:', err);
    
    req.user = null;
    delete req.session.passport;
    
    req.session.destroy((err) => {
      if (err) console.error('Error destroying session:', err);
      
      res.clearCookie('app.session', { path: '/' });
      res.clearCookie('connect.sid', { path: '/' });
      res.clearCookie('sid', { path: '/' });
      
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      
      const timestamp = Date.now();
      res.redirect(`/login?err=SessionInvalid&t=${timestamp}`);
    });
  });
}

module.exports = { isAuthenticated }