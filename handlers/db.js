const Keyv = require('keyv');
const db = new Keyv('sqlite://skyport.db');

// Add getUser method to retrieve user by ID
db.getUser = async (id) => {
  try {
    // Try to get user from the users collection
    const user = await db.get(`user:${id}`);
    return user || null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

module.exports = { db }