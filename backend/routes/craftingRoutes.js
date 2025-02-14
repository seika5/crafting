const express = require('express');
const router = express.Router();
const { Pool } = require('pg');
require('dotenv').config();

// Set up PostgreSQL connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Get all materials
router.get('/materials', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Materials');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching materials:', error);
        res.status(500).json({ error: 'Error fetching materials' });
    }
});

// Get all augments
router.get('/augments', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM Augments');
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching augments:', error);
        res.status(500).json({ error: 'Error fetching augments' });
    }
});

// Crafting logic for the rifle
function craftRifle(materials, augments) {
    let totalStatPoints = 0;
    let totalEffectPoints = 0;
    let totalElementalChancePoints = 0;
    let elementalDistributions = []; // 2D array to hold elemental distributions for triplets

    // Initialize the elementalDistributions as an empty 2D array
    for (let i = 0; i < materials.length; i++) {
        elementalDistributions.push(new Array(16).fill(0)); // Manually set 16 elements
    }

    // Pool stats from materials
    materials.forEach((material, index) => {
        totalStatPoints += material.stat_points;
        totalEffectPoints += material.effect_points;
        totalElementalChancePoints += material.elemental_chance_points;

        // Distribute material elemental values into the appropriate rows in the 2D array
        material.elemental_distribution.forEach((value, distIndex) => {
            for (let i = Math.max(0, index - 1); i < Math.min(index + 2, materials.length); i++) { // Add distribution to adjacent rows
                elementalDistributions[i][distIndex] += value;
            }
        });
    });

    // Apply augments
    augments.forEach(augment => {
        if (augment.type === 0) { // Stat point increase
            totalStatPoints += augment.magnitude;
        } else if (augment.type === 1) { // Effect point increase
            totalEffectPoints += augment.magnitude;
        } else if (augment.type === 2) { // Elemental chance point increase
            totalElementalChancePoints += augment.magnitude;
        }
    });

    // Determine elemental effects for each consecutive triplet
    const elementalEffects = [];
    for (let i = 1; i <= 3; i++) {
        const distribution = elementalDistributions[i]; // Get the distribution for the current index (1, 2, or 3)
        const sum = distribution.reduce((a, b) => a + b, 0); // Calculate sum of the current distribution

        if (sum > 0) {
            const roll = Math.floor(Math.random() * sum); // Generate a random number within the sum of the distribution
            let cumulative = 0;

            // Iterate through the distribution and select the effect based on the roll
            for (let j = 0; j < distribution.length; j++) {
                cumulative += distribution[j];
                if (roll < cumulative) {
                    elementalEffects.push(getElementalEffect(j)); // Push the effect corresponding to the index
                    break;
                }
            }
        }
    }

    return {
        statPoints: totalStatPoints,
        effectPoints: totalEffectPoints,
        elementalChancePoints: totalElementalChancePoints,
        elementalEffects
    };
}

// Function to get elemental effect name from index
function getElementalEffect(index) {
    const effects = [
        "Bleed", "Enhance", "Ignite", "Drenched", "Accelerate",
        "Armor Break", "Surge", "Cascade", "Mark", "Slow",
        "Explosion", "Swirl", "Shatter", "Metallicize", "Shock", "Consume"
    ];
    return effects[index] || "Unknown Effect";
}

// Rifle crafting route
router.post('/craft', async (req, res) => {
    try {
        const { materials, augments } = req.body;

        // Ensure there are exactly 5 materials (duplicates allowed)
        if (materials.length !== 5) {
            return res.status(400).json({ error: 'Exactly 5 materials must be used.' });
        }

        // Ensure there are exactly 10 augments (duplicates allowed)
        if (augments.length !== 10) {
            return res.status(400).json({ error: 'Exactly 10 augments must be used.' });
        }

        // Fetch material details from the database
        const materialIds = materials.map(m => m.id);
        //console.log('Requested material IDs:', materialIds);

        // Build a query to fetch each material individually, including duplicates
        const materialQueryText = materialIds
            .map(id => `SELECT * FROM Materials WHERE id = ${id}`)
            .join(' UNION ALL ');

        const materialQuery = await pool.query(materialQueryText);
        const materialData = materialQuery.rows;

        //console.log('Fetched materials from DB:', materialData);

        // Ensure we have the correct number of materials (duplicates allowed)
        if (materialData.length !== materials.length) {
            return res.status(400).json({ error: 'Some material IDs are invalid.' });
        }

        // Fetch augment details from the database (allowing duplicates)
        const augmentIds = augments.map(a => a.id);
        //console.log('Requested augment IDs:', augmentIds);

        // Build a query to fetch each augment individually, including duplicates
        const augmentQueryText = augmentIds
            .map(id => `SELECT * FROM Augments WHERE id = ${id}`)
            .join(' UNION ALL ');

        const augmentQuery = await pool.query(augmentQueryText);
        const augmentData = augmentQuery.rows;

        //console.log('Fetched augments from DB:', augmentData);

        // Ensure we have the correct number of augments (duplicates allowed)
        if (augmentData.length !== augments.length) {
            return res.status(400).json({ error: 'Some augment IDs are invalid.' });
        }

        // Calculate final stats for the crafted rifle
        const craftedRifle = craftRifle(materialData, augmentData);

        res.json({ craftedRifle });
    } catch (error) {
        console.error('Error during crafting:', error);
        res.status(500).json({ error: 'Crafting failed.' });
    }
});

// Export the router to be used in the main server file
module.exports = router;
