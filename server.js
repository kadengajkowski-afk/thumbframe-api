const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();

const PORT = 5000;

app.use(cors({
  origin: ['https://www.thumbframe.com', 'https://thumbframe-api-production.up.railway.app', 'http://localhost:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS']
}));

// Serve the React build folder
app.use(express.static(path.join(__dirname, 'build')));

app.options('*', cors());

app.get('/health', (req, res) => res.status(200).send('OK'));

// Support for Single Page Application routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('--- API BOOTED ON PORT 5000 ---');
});
