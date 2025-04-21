/**
 * @fileoverview This module dynamically sets up express routes for different pages based on
 * configuration read from a JSON file. It utilizes middleware for authentication checks and
 * accesses a database to fetch user-specific or global information to render pages.
 */

const express = require('express');
const fs = require('fs').promises;
const router = express.Router();
const config = require('../config.json')

const { isAuthenticated } = require('../handlers/auth.js');
const { db } = require('../handlers/db.js');

/**
 * Dynamically reads the page configurations from a JSON file and sets up express routes accordingly.
 * Each page configuration can specify if authentication is required. Authenticated routes fetch
 * user-specific instance data from the database, while non-authenticated routes fetch general data.
 * Routes render pages with the specified templates and data.
 *
 * @async
 * @function setupRoutes
 * @returns {Promise<void>} Executes the asynchronous setup of routes, does not return a value but logs errors.
 */

async function setupRoutes() {
    try {
        const data = await fs.readFile('pages.json', 'utf8'); 
        const pages = JSON.parse(data);

        pages.forEach(async page => {
            if (page.requiresAuth) {
                router.get(page.path, isAuthenticated, async (req, res) => {
                    try {
                        const userId = req.user.userId;
                        let instances = await db.get(userId + '_instances') || [];
                        let adminInstances = [];
                        if (req.user.admin) {
                            const allInstances = await db.get('instances') || [];
                            adminInstances = allInstances.filter(instance => instance.User == userId);
                        }
                
                        const users = await db.get('users') || [];
                
                        const authenticatedUser = users.find(user => user.userId === userId);
                        if (!authenticatedUser) {
                            throw new Error('Authenticated user not found in database.');
                        }
                        const subUserInstances = authenticatedUser.accessTo || [];
                        for (const instanceId of subUserInstances) {
                            const instanceData = await db.get(`${instanceId}_instance`);
                            if (instanceData) {
                                instances.push(instanceData);
                            }
                        }
                
                        res.render(page.template, { 
                            req, 
                            user: req.user, 
                            name: await db.get('name') || 'DracoPanel', 
                            logo: await db.get('logo') || false,
                            settings: await db.get('settings'),
                            config, 
                            instances, 
                            adminInstances
                        });
                    } catch (error) {
                        console.error('Error fetching subuser instances:', error);
                        res.status(500).send('Internal Server Error');
                    }
                });
                
                
            } else {
                router.get(page.path, async (req, res) => {
                    res.render(page.template, {
                        req,
                        name: await db.get('name') || 'DracoPanel',
                        logo: await db.get('logo') || false,
                        settings: await db.get('settings')
                    });
                });
            }
        });
    } catch (error) {
        console.error('Error setting up routes:', error);
    }
}

/**
 * GET /
 * Redirects the user to the instances overview page. This route serves as a default route that
 * directs users to a more specific page, handling the initial access or any unspecified routes.
 *
 * @returns {Response} Redirects to the '/instances' page.
 */

router.get('/', async (req, res) => {
    res.redirect('../instances')
});

/**
 * Custom login route to add information about admin access
 */
router.get('/login', async (req, res) => {
    // Render the login page
    res.render('auth/login', {
        req,
        name: await db.get('name') || 'DracoPanel',
        logo: await db.get('logo') || false,
        settings: await db.get('settings')
    });
    
    // Log if someone is trying to access admin login
    if (req.query.admin === 'true') {
        console.log('Admin login form requested from IP:', req.ip);
    }
});

/**
 * Admin Login route - hidden from normal users
 * Commented out to revert back to showing admin login on main login page
 */
// router.get('/admin-login', async (req, res) => {
//     // Log admin login attempts
//     console.log('Admin login page accessed from IP:', req.ip);
//     
//     // Render the login page with admin parameter set to true
//     res.render('auth/login', {
//         req: { ...req, query: { ...req.query, admin: 'true' } },
//         name: await db.get('name') || 'DracoPanel',
//         logo: await db.get('logo') || false,
//         settings: await db.get('settings'),
//         isAdminLogin: true
//     });
// });

// Setup routes
setupRoutes();

module.exports = router;
