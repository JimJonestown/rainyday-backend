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
        const { lat, lon, maxDistance = 100 } = req.query;
        console.log(`Requesting Windy API for location: ${lat}, ${lon} with max distance: ${maxDistance}km`);

        // Updated API request with additional parameters
        const response = await fetch(
            `https://api.windy.com/webcams/api/v3/webcams?lat=${lat}&lon=${lon}&distance=${maxDistance}&include=location,player&limit=50`,
            {
                headers: {
                    'x-windy-api-key': process.env.WINDY_API_KEY
                }
            }
        );

        console.log('Windy API Response Status:', response.status);
        const data = await response.json();
        
        // Log the raw response structure
        console.log('API Response Structure:', JSON.stringify(data, null, 2));

        if (!data.webcams || data.webcams.length === 0) {
            console.warn('No webcams found in the response.');
            return res.json({ webcams: [] });
        }

        const webcams = data.webcams || [];
        const validWebcams = webcams.filter(webcam => {
            // Log the raw webcam data to see its structure
            console.log('Raw webcam data:', JSON.stringify(webcam, null, 2));

            if (!webcam.location) {
                console.warn(`Webcam ${webcam.title} missing location data`);
                return false;
            }

            const { latitude, longitude } = webcam.location;
            if (!latitude || !longitude) {
                console.warn(`Webcam ${webcam.title} has invalid coordinates:`, webcam.location);
                return false;
            }

            const distance = calculateDistance(
                parseFloat(lat), 
                parseFloat(lon), 
                parseFloat(latitude), 
                parseFloat(longitude)
            );
            
            console.log(`Webcam: ${webcam.title}, Location: ${latitude},${longitude}, Distance: ${distance.toFixed(2)}km`);
            return distance <= maxDistance;
        });

        console.log(`Total webcams from API: ${webcams.length}`);
        console.log(`Webcams within ${maxDistance}km: ${validWebcams.length}`);

        res.json({
            ...data,
            webcams: validWebcams
        });
    } catch (error) {
        console.error('Error fetching webcams:', error);
        console.error('Error details:', error.stack);
        res.status(500).json({ 
            error: 'Failed to fetch webcams',
            details: error.message 
        });
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