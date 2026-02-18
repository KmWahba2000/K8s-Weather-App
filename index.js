const express = require('express');
const axios = require('axios');
const app = express();
const PORT = 3000;

app.set('view engine', 'ejs');
app.use(express.static('public'));

function weatherCodeToDescription(code) {
    const codes = {
        0: 'Clear Sky', 1: 'Mainly Clear', 2: 'Partly Cloudy', 3: 'Overcast',
        45: 'Foggy', 48: 'Icy Fog',
        51: 'Light Drizzle', 53: 'Drizzle', 55: 'Heavy Drizzle',
        61: 'Light Rain', 63: 'Rain', 65: 'Heavy Rain',
        71: 'Light Snow', 73: 'Snow', 75: 'Heavy Snow',
        80: 'Light Showers', 81: 'Showers', 82: 'Heavy Showers',
        95: 'Thunderstorm', 99: 'Thunderstorm w/ Hail',
    };
    return codes[code] ?? 'Unknown';
}

const COUNTRY_NAMES = {
    eg: 'Egypt', us: 'United States', gb: 'United Kingdom', de: 'Germany',
    fr: 'France', it: 'Italy', es: 'Spain', sa: 'Saudi Arabia',
    ae: 'UAE', jo: 'Jordan', lb: 'Lebanon', iq: 'Iraq', sy: 'Syria',
    ly: 'Libya', tn: 'Tunisia', dz: 'Algeria', ma: 'Morocco', sd: 'Sudan',
    tr: 'Turkey', in: 'India', cn: 'China', jp: 'Japan', br: 'Brazil',
    ca: 'Canada', au: 'Australia', ru: 'Russia', za: 'South Africa',
    ng: 'Nigeria', ke: 'Kenya', pk: 'Pakistan', bd: 'Bangladesh',
    mx: 'Mexico', ar: 'Argentina', id: 'Indonesia', nl: 'Netherlands',
    be: 'Belgium', ch: 'Switzerland', se: 'Sweden', no: 'Norway',
    dk: 'Denmark', fi: 'Finland', pl: 'Poland', pt: 'Portugal',
    gr: 'Greece', ir: 'Iran', af: 'Afghanistan', kw: 'Kuwait',
    qa: 'Qatar', bh: 'Bahrain', om: 'Oman', ye: 'Yemen',
};

async function getLocation(lat, lon) {
    try {
        const { data } = await axios.get(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            {
                headers: {
                    'User-Agent': 'weather-k8s-app/1.0',
                    'Accept-Language': 'en',
                },
                timeout: 5000,
            }
        );

        console.log('Nominatim address:', JSON.stringify(data.address));

        const code = data.address?.country_code?.toLowerCase();
        const country = COUNTRY_NAMES[code] || data.address?.country || 'Unknown';

        const region =
            data.address?.state_district ||
            data.address?.county ||
            data.address?.state ||
            null;

        const location = region ? `${region}, ${country}` : country;
        console.log('Resolved location:', location);
        return location;
    } catch (err) {
        console.warn('Nominatim failed:', err.message);
        return 'Unknown';
    }
}

app.get('/', (req, res) => {
    const podName = process.env.HOSTNAME || 'unknown-pod';
    res.render('index', { podName });
});

app.get('/weather', async (req, res) => {
    const lat = parseFloat(req.query.lat);
    const lon = parseFloat(req.query.lon);

    if (isNaN(lat) || isNaN(lon)) {
        return res.status(400).json({ error: 'Invalid coordinates' });
    }

    console.log(`Weather request: lat=${lat}, lon=${lon}`);

    try {
        const [weatherRes, location] = await Promise.all([
            axios.get(
                `https://api.open-meteo.com/v1/forecast` +
                `?latitude=${lat}&longitude=${lon}` +
                `&current=temperature_2m,relative_humidity_2m,weather_code` +
                `&timezone=auto`,
                { timeout: 8000 }
            ),
            getLocation(lat, lon),
        ]);

        const current = weatherRes.data.current;

        res.json({
            location,
            temp: Math.round(current.temperature_2m),
            humidity: current.relative_humidity_2m,
            description: weatherCodeToDescription(current.weather_code),
        });
    } catch (err) {
        console.error('Weather fetch failed:', err.message);
        res.status(500).json({ error: 'Failed to fetch weather data' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));