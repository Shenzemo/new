// server.js
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');
const countryCodes = require('./country-codes.js');
const countryTranslations = require('./translations.js');
const servicePriority = require('./service-priority.js');

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
            allServices.push({ country: countryName, service: productName, operator: 'any', price: details.cost });
          }
        } else {
          for (const operatorName in details) {
            const operatorDetails = details[operatorName];
            if (operatorDetails.count > 0) {
              allServices.push({ country: countryName, service: productName, operator: operatorName, price: operatorDetails.cost });
            }
          }
        }
      }
    }

    let formattedServices = allServices.map(s => {
      if (!s) return null;
      const cleanCountry = s.country.toLowerCase();
      const cleanService = s.service.toLowerCase();
      const priorityInfo = servicePriority[cleanService];

      return {
        id: `srv_${cleanService}_${cleanCountry}_${s.operator}`,
        service: s.service,
        service_persian: priorityInfo ? priorityInfo.name : s.service,
        country: s.country,
        country_persian: countryTranslations[cleanCountry] || s.country,
        country_code: countryCodes[cleanCountry] || null,
        operator: s.operator,
        price_toman: Math.ceil(s.price * RUB_TO_TOMAN_RATE * 1.2),
        priority: priorityInfo ? priorityInfo.priority : 99,
      };
    }).filter(Boolean); // Remove any null entries

    formattedServices.sort((a, b) => {
      if (a.priority !== b.priority) {
        return a.priority - b.priority;
      }
      if (a.service_persian !== b.service_persian) {
        return a.service_persian.localeCompare(b.service_persian);
      }
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
    if (!service_id) return res.status(400).json({ message: 'Service ID is required.' });
    
    const [_, service, country, operator] = service_id.split('_');
    if (!service || !country || !operator) return res.status(400).json({ message: 'Invalid Service ID format.'});
    
    try {
        const response = await fiveSimClient.get(`/user/buy/activation/${country}/${operator}/${service}`);
        const orderData = response.data;
        const expires = new Date(orderData.expires).getTime();
        const now = new Date().getTime();
        const expiresInSeconds = Math.max(0, Math.floor((expires - now) / 1000));

        res.json({
            order_id: orderData.id,
            number: orderData.phone,
            expiresIn: expiresInSeconds,
        });
    } catch (error) {
        const errorMessage = error.response ? error.response.data : 'An unknown error occurred';
        console.error('Purchase failed:', errorMessage);
        res.status(500).json({ message: `خرید انجام نشد: ${errorMessage}` });
    }
});

app.get('/api/check-order/:id', async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ message: 'Order ID is required.' });

  try {
    const response = await fiveSimClient.get(`/user/check/${id}`);
    const orderData = response.data;
    const lastSms = orderData.sms && orderData.sms.length > 0 ? orderData.sms[orderData.sms.length - 1] : null;
    const expires = new Date(orderData.expires).getTime();
    const now = new Date().getTime();
    const expiresInSeconds = Math.max(0, Math.floor((expires - now) / 1000));

    res.json({
      status: orderData.status,
      smsCode: lastSms ? lastSms.code : null,
      expiresIn: expiresInSeconds,
    });
  } catch (error) {
    const errorMessage = error.response ? error.response.data : 'An unknown error occurred';
    console.error(`Failed to check order ${id}:`, errorMessage);
    res.status(500).json({ message: `خطا در بررسی سفارش: ${errorMessage}` });
  }
});

app.post('/api/cancel-order/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const response = await fiveSimClient.get(`/user/cancel/${id}`);
    res.json(response.data);
  } catch (error) {
    const errorMessage = error.response ? error.response.data : 'An unknown error occurred';
    console.error(`Failed to cancel order ${id}:`, errorMessage);
    res.status(500).json({ message: `خطا در لغو سفارش: ${errorMessage}` });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
