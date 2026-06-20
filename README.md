# Lex: Advanced Low-Latency Remote Control System

Lex is a high-performance, client-server remote control solution engineered to provide low-latency cursor movement, keyboard input replication, and multi-player virtual Xbox 360 controller emulation on a Windows host machine. The system comprises a cross-platform mobile client and a secure Python-based backend server.

---

## Table of Contents
1. Key Features
2. System Architecture
3. System Requirements & Prerequisites
4. Installation & Setup
5. Running the Application
6. Auto-Update and Hot-Reload System
7. Compilation and Packaging
8. Technical Configuration & Troubleshooting
9. Authors
10. License

---

## 1. Key Features

- **Sub-Millisecond Input Latency**: Leverages direct Win32 API calls (`mouse_event` and `keybd_event` via `ctypes`) rather than high-level scripting wrappers to bypass mouse movement delay, achieving ~0ms processing overhead.
- **Smooth Continuous Key Replication**: Implements an active AsyncIO-based repeat engine operating at 40ms intervals to accurately emulate continuous key-down events for fluid gaming and remote navigation.
- **Virtual Gamepad Emulation**: Utilizes the virtual gamepad driver interface (`vgamepad`) to simulate up to 4 virtual Xbox 360 controllers on the host PC, enabling local multiplayer capabilities over local networks.
- **Dynamic Secure Pairing**: Generates a dynamic 16-character cryptographically secure pairing token (`SECRET_KEY`) for each host session, rendered as an ASCII-art QR code directly in the host terminal for secure mobile pairing.
- **Escalated Admin Permissions**: Automatically requests Windows UAC Administrator elevation at runtime, allowing the server to inject remote input events into UAC-protected applications, administrative tools, and games with anti-cheat protections.

---

## 2. System Architecture

The Lex ecosystem is split into two independent modules:

### PC Server (`/server`)
- Written in Python 3, leveraging AsyncIO for non-blocking concurrent connections.
- Utilizes `aiohttp` for hosting static web assets and API endpoints, and `python-socketio` for real-time WebSocket communication.
- Communicates directly with the Windows kernel via `ctypes` for mouse/keyboard inputs and interfaces with the ViGEmBus driver via `vgamepad` for Xbox 360 emulation.

### Mobile Client (`/client`)
- Built using the Ionic Framework and Angular (TypeScript).
- Designed as a Progressive Web App (PWA) with a Vercel-style minimalist dark theme.
- Features multi-mode control panels: Touchpad/Trackpad interface, Keyboard input replication, and customizable Gamepad layouts (4-button diamond or 6-button arcade).

---

## 3. System Requirements & Prerequisites

### Host PC (Windows)
- OS: Windows 10 or Windows 11 (64-bit).
- Python: Version 3.8 or higher.
- Driver: ViGEmBus Driver (required only for Gamepad Emulation mode).
- Privileges: Administrative UAC access.

### Client Build Environment
- Node.js (v16.x or newer) and NPM.
- Ionic CLI (installed globally via `npm install -g @ionic/cli`).

---

## 4. Installation & Setup

### Setting up the Mobile Client

1. Navigate to the client directory:
   ```bash
   cd client
   ```

2. Install the Node package dependencies:
   ```bash
   npm install
   ```

3. Run the development server locally to test in a browser:
   ```bash
   ionic serve
   ```

### Setting up the PC Server

1. Navigate to the server directory:
   ```bash
   cd server
   ```

2. Create a virtual environment and activate it:
   ```bash
   python -m venv venv
   
   # Activation on Windows
   venv\Scripts\activate
   ```

3. Install the required Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

---

## 5. Running the Application

### 1. Launch the Server
To run the server from source, execute the startup batch script in the root directory:
```bash
run.bat
```
Alternatively, run the server script directly inside the virtual environment:
```bash
cd server
python server_wifi.py
```
Upon startup, the script will prompt for UAC Administrator permissions. Once granted, the server starts on port `5000` and displays a secure connection URL alongside a terminal QR code.

### 2. Connect the Client
1. Ensure both the PC and the client mobile device are connected to the same local Wi-Fi network.
2. Open the Lex Mobile App (or access `http://<your-pc-ip>:5000` in your mobile web browser).
3. Scan the terminal QR code or enter the Server IP and Secret Key manually on the overview dashboard.
4. Select the desired control mode (Touchpad/Gamepad) to begin remote operation.

---

## 6. Auto-Update and Hot-Reload System

Lex features an integrated Git-based update and hot-reload mechanism accessible directly from the client dashboard:

1. **Version Monitoring**: Upon connection, the PC Server reports its current Git commit SHA to the client. The client queries the public GitHub Repository API to check for newer commits on the `main` branch.
2. **Update Alert**: If a new commit is detected, a Vercel-style notification card appears on the client dashboard detailing the new version, SHA, and commit message.
3. **Execution**: Pressing the "Update & Restart" button triggers a secure WebSocket command `trigger_update` to the server.
4. **Processing**: The server executes a `git pull origin main` in the repository root. If successful, it automatically hot-reloads the Python server process (`os.execv`) within 1.5 seconds, ensuring zero manual intervention.

---

## 7. Compilation and Packaging

To compile the entire Lex application into a single standalone Windows executable (`lex.exe`), run the packaging script in the root directory:
```bash
package.bat
```
This automated batch script will:
1. Compile the Angular/Ionic mobile client assets into static files.
2. Synchronize the compiled web files into the server package (`server/www`).
3. Set up the virtual environment, install PyInstaller, and run the compilation process using `lex.spec`.
4. Copy the final standalone `lex.exe` executable to the project root directory.

---

## 8. Technical Configuration & Troubleshooting

| Issue / Warning | Potential Cause | Resolution |
| --- | --- | --- |
| WARNING: vgamepad not installed | Missing python library in virtual environment | Run `pip install vgamepad` inside the active `venv`. |
| Gamepad mode does not emulate controller | Missing kernel-level controller driver | Download and install the ViGEmBus driver. |
| Keyboard/Mouse inputs blocked in games | Lack of administrative permissions | Right-click the terminal and run as Administrator before launching `run.bat` or `lex.exe`. |
| PWA "Install App" button is hidden | Chrome insecure origin policy (HTTP) | Access via `localhost` or enable the unsafely-treat-insecure-origin flag in Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` |

---

## 9. Authors

Developed and Maintained by **I2FLabs Viet Nam**.

---

## 10. License

This project is proprietary. Non-commercial and personal use only. Unauthorized commercial use, duplication, or distribution is strictly prohibited. 

For full details, please refer to the license files:
- [LICENSE (Vietnamese Version)](file:///d:/I2FLabs/Tools/Lex/LICENSE)
- [LICENSE_EN (English Version)](file:///d:/I2FLabs/Tools/Lex/LICENSE_EN)
