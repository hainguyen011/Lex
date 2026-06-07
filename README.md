# MobileControl

MobileControl is a client-server application designed to provide remote control and monitoring capabilities. The system is composed of a mobile frontend and a backend server running on a PC.

## Architecture

The project is divided into two main components:

1. **Mobile Client (`/mobile-client`)**: 
   - A cross-platform mobile application built using the Ionic framework and Angular.
   - Handles the user interface, interaction, and sending commands to the server.

2. **PC Server (`/pc-server-py`)**: 
   - A Python-based backend server.
   - Listens for incoming connections over Wi-Fi, processes commands from the mobile client, and serves static frontend assets when required.

## Prerequisites

Before running the application, ensure the following software is installed on your system:

- **Node.js** and **npm**: Required for building and running the Mobile Client.
- **Ionic CLI**: Can be installed globally via npm (`npm install -g @ionic/cli`).
- **Python 3.x**: Required for the PC Server.

## Installation & Setup

### Setting up the Mobile Client

1. Navigate to the client directory:
   ```bash
   cd mobile-client
   ```
2. Install the required dependencies:
   ```bash
   npm install
   ```
3. To run the client locally in a development server:
   ```bash
   ionic serve
   ```

### Setting up the PC Server

1. Navigate to the server directory:
   ```bash
   cd pc-server-py
   ```
2. It is recommended to use a virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # On Windows
   # or
   source venv/bin/activate      # On macOS/Linux
   ```
3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the Application

1. Start the PC Server. There is a batch script provided in the root directory for convenience on Windows:
   ```bash
   ./CHAY_SERVER_NGAY.bat
   ```
   Alternatively, you can run the Python script directly:
   ```bash
   cd pc-server-py
   python server_wifi.py
   ```

2. Ensure your mobile device and the PC are connected to the same Wi-Fi network for communication. Open the Mobile Client to connect to the server's IP address.

## License

This project is proprietary and confidential.
