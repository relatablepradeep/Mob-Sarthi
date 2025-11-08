const express = require('express');
const path = require('path');
const app = express();
const port = 4000;

// Middleware for JSON parsing
app.use(express.json());

// API route
app.use('/scaler/translate', require('./routes/route.js'));

// Serve index.html from public folder
app.get('/', (req, res) => {
  res.sendFile('index.html', { root: path.join(__dirname, 'public') });
});

// Serve static frontend build files
app.use(express.static(path.join(__dirname, '../frontend/build')));

// Serve React app for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/build/index.html'));
});

app.listen(port, () => {
  console.log(`Server listening at ${port}`);
});
