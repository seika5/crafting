require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
app.use(cors());
app.use(express.json());

// Set up PostgreSQL connection using the .env file
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Test database connection
pool.connect()
    .then(() => console.log('Connected to PostgreSQL'))
    .catch(err => console.error('Database connection error:', err));

// Import crafting routes and use them
const craftingRoutes = require('./routes/craftingRoutes');
app.use('/api', craftingRoutes);

// Start the server
app.listen(5000, () => {
    console.log('Server running on port 5000');
});
