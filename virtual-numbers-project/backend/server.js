// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const countryTranslations = require('./translations.js');
const servicePriority = require('./service-priority.js'); // <-- This was missing

const app = express();
const PORT = process.env.PORT || 3001;
const FIVESIM_API_KEY = process.env.FIVESIM_API_KEY;

// --- Middleware ---
app.use(cors());
app.use(express.json());

// --- 5sim API Configuration ---
const fiveSimClient = axios.create({
  baseURL: 'https://5sim.net/v1',
  headers: {
    'Authorization': `Bearer ${FIVESIM_API_KEY}`,
    'Accept': 'application/json',
  },
});

// --- API Endpoints ---
app.get('/api/services', async (req, res) => {
  console.log('Received request for /api/services using the /prices endpoint.');
  try {
    const response = await fiveSimClient.get('/guest/prices');
    const priceData = response.data;

    const RUB_TO_TOMAN_RATE = 1200;
    const allServices = [];

    for (const countryName in priceData) {
      const products = priceData[countryName];
      for (const productName in products) {
        const details = products[productName];
        if (details.cost !== undefined) {
          if (details.count > 0) {
            allServices.push({
              country: countryName,
              service: productName,
              operator: 'any',
              price: details.cost,
            });
          }
        } else {
          for (const operatorName in details) {
            const operatorDetails = details[operatorName];
            if (operatorDetails.count > 0) {
              allServices.push({
                country: countryName,
                service: productName,
                operator: operatorName,
                price: operatorDetails.cost,
              });
            }
          }
        }
      }
    }

    let formattedServices = allServices.map(s => {
      const cleanCountry = s.country.toLowerCase();
      const cleanService = s.service.toLowerCase();
      const priorityInfo = servicePriority[cleanService];

      return {
        id: `srv_${cleanService}_${cleanCountry}_${s.operator}`,
        service: s.service,
        service_persian: priorityInfo ? priorityInfo.name : s.service,
        country: s.country,
        country_persian: countryTranslations[cleanCountry] || s.country,
        operator: s.operator,
        price_toman: Math.ceil(s.price * RUB_TO_TOMAN_RATE * 1.2),
        priority: priorityInfo ? priorityInfo.priority : 99,
      };
    });

    // This is the new, corrected code
formattedServices.sort((a, b) => {
  // 1. First, sort by the priority number
  if (a.priority !== b.priority) {
    return a.priority - b.priority;
  }
  // 2. If priorities are equal, sort alphabetically by Persian service name
  if (a.service_persian !== b.service_persian) {
    return a.service_persian.localeCompare(b.service_persian);
  }
  // 3. If service names are also the same, sort by the cheapest price
  return a.price_toman - b.price_toman;
});

    res.json(formattedServices);

  } catch (error) {
    console.error('Error fetching from 5sim /prices:', error.message);
    res.status(500).json({ message: 'Failed to fetch services from provider.' });
  }
});

app.post('/api/purchase', async (req, res) => {
    const { service_id } = req.body;
    if (!service_id) {
        return res.status(400).json({ message: 'Service ID is required.' });
    }
    const [_, service, country, operator] = service_id.split('_');
    if (!service || !country || !operator) {
        return res.status(400).json({ message: 'Invalid Service ID format.'});
    }
    console.log(`Attempting to purchase: Service=${service}, Country=${country}, Operator=${operator}`);
    try {
        const response = await fiveSimClient.get(`/user/buy/activation/${country}/${operator}/${service}`);
        const orderData = response.data;
        res.json({
            order_id: orderData.id,
            number: orderData.phone,
            sms_code: null,
            note: 'شماره با موفقیت خریداری شد. منتظر دریافت کد فعال‌سازی بمانید'
        });
    } catch (error) {
        const errorMessage = error.response ? error.response.data : 'An unknown error occurred';
        console.error('Purchase failed:', errorMessage);
        res.status(500).json({ message: `خرید انجام نشد: ${errorMessage}` });
    }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});