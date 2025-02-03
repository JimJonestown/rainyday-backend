const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for your frontend domain
app.use(cors({
    origin: 'https://rainyday.live'
}));

// Add a test route
app.get('/', (req, res) => {
    res.send('Rainyday Backend Server is Running!');
});

// Cache for API responses
const cache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

app.get('/api/webcams', async (req, res) => {
    try {
        const { lat, lon } = req.query;
        if (!lat || !lon) {
            return res.status(400).json({ error: 'Latitude and longitude are required' });
        }

        // Check cache
        const cacheKey = `${lat},${lon}`;
        const cachedData = cache.get(cacheKey);
        if (cachedData && Date.now() - cachedData.timestamp < CACHE_DURATION) {
            return res.json(cachedData.data);
        }

        // Make request to Windy API
        const response = await fetch(
            `https://webcams.windy.com/api/webcams/v2/list/nearby=${lat},${lon},20/limit=5?show=webcams:location,player`,
            {
                headers: {
                    'x-windy-key': process.env.WINDY_API_KEY
                }
            }
        );

        console.log('Windy API Response Status:', response.status);
        console.log('Windy API Response Headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Windy API Error:', errorText);
            throw new Error(`Windy API responded with status: ${response.status}, body: ${errorText}`);
        }

        const data = await response.json();
        console.log('Windy API Data:', data);

        // Cache the response
        cache.set(cacheKey, {
            timestamp: Date.now(),
            data
        });

        res.json(data);
    } catch (error) {
        console.error('Detailed error:', error);
        res.status(500).json({ 
            error: 'Failed to fetch webcam data',
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});