import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config();

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
        const radius = 100; // Increased from 50
        
        const url = `https://api.windy.com/webcams/api/v3/webcams?lat=${lat}&lon=${lon}&radius=${radius}&limit=50&include=location,images,player&show_inactive=0&orderby=distance`;
        
        console.log(`Requesting Windy API: ${url}`);
        
        const response = await fetch(url, {
            headers: {
                'x-windy-api-key': process.env.WINDY_API_KEY
            }
        });
        
        console.log(`Windy API Response Status: ${response.status}`);
        const data = await response.json();
        console.log(`Number of webcams found: ${data.webcams?.length || 0}`);
        console.log(`First webcam location: ${data.webcams?.[0]?.location?.city}, ${data.webcams?.[0]?.location?.country}`);
        
        res.json(data);
    } catch (error) {
        console.error('Error fetching webcams:', error);
        res.status(500).json({ error: 'Failed to fetch webcams' });
    }
});

// Helper function to calculate distance between two points
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

app.get('/api/webcams/:id/player', async (req, res) => {
    try {
        const { id } = req.params;
        console.log('Fetching player for webcam ID:', id);
        
        // Updated URL format for v3 API
        const response = await fetch(
            `https://api.windy.com/webcams/api/v3/webcams/${id}?include=player`,
            {
                headers: {
                    'x-windy-api-key': process.env.WINDY_API_KEY
                }
            }
        );

        console.log('Player API Response Status:', response.status);
        const responseText = await response.text();
        console.log('Player API Response:', responseText);

        if (!response.ok) {
            throw new Error(`Windy API responded with status: ${response.status}, body: ${responseText}`);
        }

        const data = JSON.parse(responseText);
        console.log('Player Data:', data);
        res.json(data);
    } catch (error) {
        console.error('Error fetching webcam player:', error);
        res.status(500).json({ 
            error: 'Failed to fetch webcam player data',
            details: error.message 
        });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});