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
        const { lat, lon, maxDistance = 100 } = req.query; // Increased default maxDistance
        console.log(`Requesting Windy API for location: ${lat}, ${lon} with max distance: ${maxDistance}km`);

        const response = await fetch(
            `https://api.windy.com/webcams/api/v3/webcams?lat=${lat}&lon=${lon}&distance=${maxDistance}&include=player`, // Added distance parameter
            {
                headers: {
                    'x-windy-api-key': process.env.WINDY_API_KEY
                }
            }
        );

        console.log('Windy API Response Status:', response.status);
        const data = await response.json();

        // Check if the response contains webcams
        if (!data.webcams || data.webcams.length === 0) {
            console.warn('No webcams found in the response.');
        }

        const webcams = data.webcams || []; // Ensure we have an array
        const validWebcams = webcams.filter(webcam => 
            webcam.location && webcam.location.latitude && webcam.location.longitude
        );

        console.log(`Total webcams from API: ${webcams.length}`);
        console.log(`Webcams within 100km: ${validWebcams.length}`);

        // Filter webcams by actual distance and log each one's distance
        const filteredWebcams = validWebcams.filter(webcam => {
            // Check if webcam is defined and has a location
            if (!webcam || !webcam.location) {
                console.warn('Webcam or location is undefined:', webcam);
                return false; // Skip this webcam
            }

            const distance = calculateDistance(
                parseFloat(lat),
                parseFloat(lon),
                webcam.location.latitude,
                webcam.location.longitude
            );

            // Log all webcams with their distances for debugging
            console.log(`[WEB CAM] ${webcam.title} at ${webcam.location.city}, ${webcam.location.country}`);
            console.log(`  - Coordinates: (${webcam.location.latitude}, ${webcam.location.longitude})`);
            console.log(`  - Distance: ${distance.toFixed(2)}km`);
            console.log(`  - Target: (${lat}, ${lon})`);

            return distance <= maxDistance; // Only include webcams within the max distance
        });

        // Log the total number of webcams found
        console.log(`Total webcams from API: ${webcams.length}`);
        console.log(`Webcams within ${maxDistance}km: ${filteredWebcams?.length || 0}`);

        res.json({
            ...data,
            webcams: filteredWebcams || []
        });
    } catch (error) {
        console.error('Error fetching webcams:', error);
        res.status(500).send('Internal Server Error');
    }
});

// Update the calculateDistance function to add more precision
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in kilometers
    const lat1Rad = lat1 * Math.PI / 180;
    const lat2Rad = lat2 * Math.PI / 180;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    
    const a = 
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;
    
    return distance;
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