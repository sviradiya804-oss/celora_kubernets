#!/bin/bash
cd /home/site/wwwroot

# Check if node_modules exists, if not install
if [ ! -d "node_modules" ]; then
    echo "Installing dependencies..."
    npm install --production
fi

# Start the application
# Adjust this path if your main file is located elsewhere (e.g., src/app.js)
node src/server.js
