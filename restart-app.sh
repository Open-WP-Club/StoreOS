#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Stopping application...${NC}"

# Kill process on port 5173 (Vite dev server)
echo -e "${YELLOW}Checking for processes on port 5173...${NC}"
PORT_PID=$(lsof -ti:5173)
if [ ! -z "$PORT_PID" ]; then
    echo -e "${YELLOW}Killing process on port 5173 (PID: $PORT_PID)${NC}"
    kill -9 $PORT_PID
    echo -e "${GREEN}Process on port 5173 killed${NC}"
else
    echo -e "${YELLOW}No process found on port 5173${NC}"
fi

# Kill any running Electron processes
echo -e "${YELLOW}Checking for Electron processes...${NC}"
ELECTRON_PIDS=$(pgrep -f "electron.*woocommerce")
if [ ! -z "$ELECTRON_PIDS" ]; then
    echo -e "${YELLOW}Killing Electron processes...${NC}"
    pkill -f "electron.*woocommerce"
    echo -e "${GREEN}Electron processes killed${NC}"
else
    echo -e "${YELLOW}No Electron processes found${NC}"
fi

# Kill any Node processes related to this project
echo -e "${YELLOW}Checking for Node processes...${NC}"
NODE_PIDS=$(pgrep -f "node.*vite")
if [ ! -z "$NODE_PIDS" ]; then
    echo -e "${YELLOW}Killing Node/Vite processes...${NC}"
    pkill -f "node.*vite"
    echo -e "${GREEN}Node processes killed${NC}"
else
    echo -e "${YELLOW}No Node/Vite processes found${NC}"
fi

# Wait a moment for processes to fully terminate
echo -e "${YELLOW}Waiting for processes to terminate...${NC}"
sleep 2

# Start the application
echo -e "${GREEN}Starting application...${NC}"
npm run dev
