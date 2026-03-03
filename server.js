const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

// Serve your HTML files
// If you have an index.html file, put it in a folder called 'public'
app.use(express.static('public'));

// Or if you want a simple response
app.get('/', (req, res) => {
  res.send('Welcome to my Node.js website!');
});

// THIS IS CRITICAL - MUST USE '0.0.0.0'
app.listen(port, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${port}`);
});
