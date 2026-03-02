const express = require('express');
const app = express();

require("dotenv").config();

const connectToDatabase = require('./config/db');

app.use(express.json());

const PORT = process.env.PORT || 5000;

app.get('/', (req, res) => {
  res.send('Welcome to cinisphere!');
});

const startServer = async () => {
  try {
    await connectToDatabase();
    console.log("Database connected successfully");

    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

  } catch (error) {
    console.error("Failed to connect to database:", error);
    process.exit(1);
  }
};

startServer();