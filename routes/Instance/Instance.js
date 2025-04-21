const axios = require('axios')
const express = require('express');
const router = express.Router();
const { db } = require('../../handlers/db.js');
const { isUserAuthorizedForContainer } = require('../../utils/authHelper');
const { loadPlugins } = require('../../plugins/loadPls.js');
const path = require('path');
const { config } = require('process');
const { fetchFiles } = require('../../utils/fileHelper');
const { isAuthenticated } = require('../../handlers/auth.js');

const plugins = loadPlugins(path.join(__dirname, '../../plugins'));

// SPECIAL DIRECT ACCESS PREVENTION FOR INSTANCES ROUTE
router.get("/instances", (req, res, next) => {
  console.log("💂 GUARD: Instances route accessed, checking authentication...");
  
  // Multiple checks to ensure no bypass is possible
  if (!req.isAuthenticated || 
      !req.isAuthenticated() || 
      !req.user || 
      !req.session || 
      !req.session.passport || 
      req.session.isLoggedOut) {
    
    console.log("🚫 ACCESS DENIED: Unauthenticated access attempt to /instances");
    
    // Clear all cookies to be sure
    res.clearCookie('app.session', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('sid', { path: '/' });
    
    // Add cache prevention headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Redirect with random parameter to prevent caching
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return res.redirect(`/login?blocked=instances&r=${random}&t=${timestamp}`);
  }
  
  // If we get here, proceed to the regular instances route handler
  next();
}, isAuthenticated, async (req, res) => {
    // Double-check authentication - belt and suspenders approach
    if (!req.user || !req.isAuthenticated()) {
        console.log("Caught unauthenticated access attempt to /instances");
        return res.redirect('/login?err=AuthRequired');
    }
    
    // Validate the user exists in the database again
    try {
        const users = await db.get('users') || [];
        const userExists = users.some(user => user.username === req.user.username);
        
        if (!userExists) {
            console.log(`User ${req.user.username} attempted to access /instances but doesn't exist in database.`);
            return res.redirect('/login?err=InvalidUser');
        }
    } catch (error) {
        console.error("Error validating user for /instances:", error);
        return res.redirect('/login?err=DatabaseError');
    }
    
    let instances = [];

    if (req.query.see === "other") {
        let allInstances = await db.get('instances') || [];
        instances = allInstances.filter(instance => instance.User !== req.user.userId);
    } else {
        const userId = req.user.userId;
        const users = await db.get('users') || [];
        const authenticatedUser = users.find(user => user.userId === userId);
        instances = await db.get(req.user.userId + '_instances') || [];
        const subUserInstances = authenticatedUser.accessTo || [];
        for (const instanceId of subUserInstances) {
            const instanceData = await db.get(`${instanceId}_instance`);
            if (instanceData) {
                instances.push(instanceData);
            }
        }
    }

    // Set cache control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    res.render('instances', {
        req,
        user: req.user,
        name: await db.get('name') || 'HydraPanel',
        logo: await db.get('logo') || false,
        instances,
        config: require('../../config.json')
    });
});

// SPECIAL DIRECT ACCESS PREVENTION FOR INSTANCE/:ID ROUTE
router.get("/instance/:id", (req, res, next) => {
  console.log("💂 GUARD: Instance route accessed, checking authentication...");
  
  // Multiple checks to ensure no bypass is possible
  if (!req.isAuthenticated || 
      !req.isAuthenticated() || 
      !req.user || 
      !req.session || 
      !req.session.passport || 
      req.session.isLoggedOut) {
    
    console.log("🚫 ACCESS DENIED: Unauthenticated access attempt to /instance/:id");
    
    // Clear all cookies to be sure
    res.clearCookie('app.session', { path: '/' });
    res.clearCookie('connect.sid', { path: '/' });
    res.clearCookie('sid', { path: '/' });
    
    // Add cache prevention headers
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    // Redirect with random parameter to prevent caching
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    return res.redirect(`/login?blocked=instance&r=${random}&t=${timestamp}`);
  }
  
  // If we get here, proceed to the regular instances route handler
  next();
}, isAuthenticated, async (req, res) => {
    // Double-check authentication - belt and suspenders approach
    if (!req.user || !req.isAuthenticated()) {
        console.log("Caught unauthenticated access attempt to /instance/:id");
        return res.redirect('/login?err=AuthRequired');
    }
    
    // Validate the user exists in the database again
    try {
        const users = await db.get('users') || [];
        const userExists = users.some(user => user.username === req.user.username);
        
        if (!userExists) {
            console.log(`User ${req.user.username} attempted to access /instance/:id but doesn't exist in database.`);
            return res.redirect('/login?err=InvalidUser');
        }
    } catch (error) {
        console.error("Error validating user for /instance/:id:", error);
        return res.redirect('/login?err=DatabaseError');
    }

    const { id } = req.params;
    if (!id) return res.redirect('/login');

    let instance = await db.get(id + '_instance');
    if (!instance) return res.redirect('../instances');

    const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
    if (!isAuthorized) {
        return res.status(403).send('Unauthorized access to this instance.');
    }

    if(!instance.suspended) {
        instance.suspended = false;
        db.set(id + '_instance', instance);
    }

    if (instance.State === 'INSTALLING') {
        return res.redirect('../../instance/' + id + '/installing')
    }
    if(instance.suspended === true) {
        return res.redirect('../../instances?err=SUSPENDED');
   }

    const config = require('../../config.json');
    const { port, domain } = config;

    const allPluginData = Object.values(plugins).map(plugin => plugin.config);

    // Set cache control headers to prevent browser caching
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');

    res.render('instance/instance', {
        req,
        ContainerId: instance.ContainerId,
        instance,
        port,
        domain,
        user: req.user,
        name: await db.get('name') || 'HydraPanel',
        logo: await db.get('logo') || false,
        files: await fetchFiles(instance, ""),
        addons: {
            plugins: allPluginData
        }
    });
});

router.get("/instance/:id/installing", isAuthenticated, async (req, res) => {
   // Double-check authentication - belt and suspenders approach
   if (!req.user || !req.isAuthenticated()) {
      console.log("Caught unauthenticated access attempt to /instance/:id/installing");
      return res.redirect('/login?err=AuthRequired');
   }
   
   // Validate the user exists in the database again
   try {
      const users = await db.get('users') || [];
      const userExists = users.some(user => user.username === req.user.username);
      
      if (!userExists) {
         console.log(`User ${req.user.username} attempted to access /instance/:id/installing but doesn't exist in database.`);
         return res.redirect('/login?err=InvalidUser');
      }
   } catch (error) {
      console.error("Error validating user for /instance/:id/installing:", error);
      return res.redirect('/login?err=DatabaseError');
   }

   const { id } = req.params;
   if (!id) return res.redirect('/login');

   let instance = await db.get(id + '_instance');
   if (!instance) return res.redirect('../instances');
   
   const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
   if (!isAuthorized) {
       return res.status(403).send('Unauthorized access to this instance.');
   }
   
   await checkState(id);
   
   // Set cache control headers to prevent browser caching
   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
   res.setHeader('Pragma', 'no-cache');
   res.setHeader('Expires', '0');
   
   res.render('instance/installing', {
    req,
    instance,
    user: req.user,
    name: await db.get('name') || 'HydraPanel',
    logo: await db.get('logo') || false,
    config: require('../../config.json')
   });
});

router.get("/instance/:id/installing/status", isAuthenticated, async (req, res) => {
   // Double-check authentication - belt and suspenders approach
   if (!req.user || !req.isAuthenticated()) {
      console.log("Caught unauthenticated access attempt to /instance/:id/installing/status");
      return res.redirect('/login?err=AuthRequired');
   }
   
   // Validate the user exists in the database again
   try {
      const users = await db.get('users') || [];
      const userExists = users.some(user => user.username === req.user.username);
      
      if (!userExists) {
         console.log(`User ${req.user.username} attempted to access /instance/:id/installing/status but doesn't exist in database.`);
         return res.status(401).json({ error: 'Authentication required' });
      }
   } catch (error) {
      console.error("Error validating user for /instance/:id/installing/status:", error);
      return res.status(500).json({ error: 'Server error' });
   }

   const { id } = req.params;

   if (!id) {
      return res.status(400).json({ error: 'Instance ID is required' });
   }

   const instance = await db.get(id + '_instance');

   if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
   }

   const isAuthorized = await isUserAuthorizedForContainer(req.user.userId, instance.Id);
   if (!isAuthorized) {
      return res.status(403).json({ error: 'Unauthorized access to this instance' });
   }
    
   await checkState(id);
   
   // Set cache control headers to prevent browser caching
   res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
   res.setHeader('Pragma', 'no-cache');
   res.setHeader('Expires', '0');
     
   res.status(200).json({ state: instance.State });
});

async function checkState(instanceId) {
    try {
      // Get the specific instance from the "instances" database
      const instance = await db.get(`${instanceId}_instance`);
  
      if (!instance) {
        return ("Instance not found.");
      }
  
      try {
        // Fetch the current state from the remote server
        const getStateUrl = `http://${instance.Node.address}:${instance.Node.port}/instances/${instance.Id}/states/get`;
        const getStateResponse = await axios.get(getStateUrl, {
          auth: {
            username: "Skyport",
            password: instance.Node.apiKey,
          },
        });
  
        const newState = getStateResponse.data.state;
  
        // Update the state on the remote server
        const setStateUrl = `http://${instance.Node.address}:${instance.Node.port}/instances/${instance.Id}/states/set/${newState}`;
        await axios.get(setStateUrl, {
          auth: {
            username: "Skyport",
            password: instance.Node.apiKey,
          },
        });
  
        // Update the instance state locally
        instance.State = newState;
  
        // Get the instance-specific database and ensure it has the "State" property
        const instanceDbKey = `${instanceId}_instance`; // Define the key for instance-specific database
        let instanceDb = await db.get(instanceDbKey);
  
        if (!instanceDb) {
          instanceDb = {};
        }
  
        instanceDb.State = newState;
  
        // Save the updated instance-specific database
        await db.set(instanceDbKey, instanceDb);
  
      } catch (instanceError) {
        console.error(`Error processing instance ${instance.Id}:`, instanceError.message);
      }
    } catch (error) {
      console.error("Error processing instances:", error.message);
    }
  }
  

module.exports = router;