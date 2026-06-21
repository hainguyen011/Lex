# Lex: Advanced Low-Latency Remote Control System

Lex is a high-performance, client-server remote control solution engineered to provide low-latency cursor movement, keyboard input replication, and multi-player virtual Xbox 360 controller emulation on a Windows host machine. The system comprises a cross-platform mobile client and a secure Python-based backend server.

---

## Table of Contents
1. Key Features
2. System Architecture
3. System Requirements
4. Download and Run
5. Auto-Update and Hot-Reload System
6. Compilation and Packaging (for Developers)
7. Technical Configuration & Troubleshooting
8. Safety & Security Commitment
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

## 3. System Requirements

- **Host PC**: Windows 10 or Windows 11 (64-bit).
- **Gamepad Driver**: ViGEmBus Driver (only required if you wish to use the virtual Xbox 360 controller/gamepad mode).

---

## 4. Download and Run

> **Recommendation**: For the simplest setup and optimal performance, it is highly recommended to run the pre-compiled `Lex.exe` executable inside the `bin/` directory, or use `run.bat` which automatically detects it. Running from source is intended primarily for development purposes.

### Step 1: Download or Build the Executable
Obtain the pre-compiled `Lex.exe` executable and ensure it is placed inside the `bin/` directory at the project root (yielding `bin/Lex.exe`).

### Step 2: Run the Server
You can launch the server using one of the following methods:
- **Method A (Recommended)**: Double-click `run.bat` in the project root. This launcher script is engineered to automatically detect and run `bin/Lex.exe` with priority, providing a fast and stable startup. If the executable is not built, it automatically falls back to running the Python source code.
- **Method B**: Navigate into the `bin/` directory and double-click `Lex.exe` directly.

1. If prompted, grant **Administrator privileges (UAC)**. This allows the server to send inputs to secure windows and full-screen games.
2. The server terminal will open, showing a QR code and a secret pairing key. **Keep this terminal window running** at all times during remote operation; closing the terminal will terminate the connection and stop the server.

### Step 3: Connect your Mobile Device
1. Make sure your PC and mobile device are connected to the same local Wi-Fi network.
2. Open the browser on your phone and navigate to the IP address shown in the terminal (e.g., `http://192.168.1.15:5000`), or scan the QR code using your phone's camera.
3. Once the controller interface loads, pair it using the secret key displayed in the terminal.
4. Select mouse, keyboard, or gamepad mode and start controlling your PC!

---

## 5. Auto-Update and Hot-Reload System

Lex features an integrated Git-based update and hot-reload mechanism accessible directly from the client dashboard:

1. **Version Monitoring**: Upon connection, the PC Server reports its current Git commit SHA to the client. The client queries the public GitHub Repository API to check for newer commits on the `main` branch.
2. **Update Alert**: If a new commit is detected, a Vercel-style notification card appears on the client dashboard detailing the new version, SHA, and commit message.
3. **Execution**: Pressing the "Update & Restart" button triggers a secure WebSocket command `trigger_update` to the server.
4. **Processing**: The server executes a `git pull origin main` in the repository root. If successful, it automatically hot-reloads the Python server process (`os.execv`) within 1.5 seconds, ensuring zero manual intervention.

---

## 6. Compilation and Packaging (for Developers)

To compile the entire Lex application into a single standalone Windows executable (`Lex.exe`), run the packaging script in the root directory:
```bash
package.bat
```
This automated batch script will:
1. Compile the Angular/Ionic mobile client assets into static files.
2. Synchronize the compiled web files into the server package (`server/www`).
3. Set up the virtual environment, install PyInstaller, and run the compilation process using `lex.spec`.
4. Copy the final standalone `Lex.exe` executable to the `bin/` directory at the project root (`bin/Lex.exe`) and clean up temporary files.

---

## 7. Technical Configuration & Troubleshooting

| Issue / Warning | Potential Cause | Resolution |
| --- | --- | --- |
| WARNING: vgamepad not installed | Missing python library in virtual environment | Run `pip install vgamepad` inside the active `venv`. |
| Gamepad mode does not emulate controller | Missing kernel-level controller driver | Download and install the ViGEmBus driver. |
| Keyboard/Mouse inputs blocked in games | Lack of administrative permissions | Right-click the terminal and run as Administrator before launching `run.bat` or `Lex.exe`. |
| PWA "Install App" button is hidden | Chrome insecure origin policy (HTTP) | Access via `localhost` or enable the unsafely-treat-insecure-origin flag in Chrome: `chrome://flags/#unsafely-treat-insecure-origin-as-secure` |

---

## 8. Safety & Security Commitment

Lex is built and distributed with transparency and user safety as absolute priorities:
- **Intended Purpose Only**: Lex is programmed exclusively to act as a remote input receiver utility (mouse touchpad, keyboard, and virtual controller emulation).
- **No System Exploitation or Intrusions**: The application does not perform any hacking actions, background system modifications, or unauthorized registry exploits.
- **Privacy and Data Isolation**: Lex runs entirely within your Local Area Network (Wi-Fi LAN) and does not contain telemetry, tracking, or network-reporting features. No keystrokes, personal details, or system logs are ever collected or sent to external servers.
- **UAC Privileges Isolation**: The request for UAC Administrator permissions is strictly isolated to the input injection APIs (`SendInput` / Win32 mouse and keyboard events) to allow control over secure windows (such as Task Manager or games with active anti-cheat protections). These permissions are never leveraged for unauthorized privilege escalation or security exploits.

---

## 9. Authors

Developed and Maintained by **I2FLabs Viet Nam**.

---

## 10. License

This project is proprietary. Non-commercial and personal use only. Unauthorized commercial use, duplication, or distribution is strictly prohibited. 

For full details, please refer to the license files:
- [LICENSE (Vietnamese Version)](./LICENSE)
- [LICENSE_EN (English Version)](./LICENSE_EN)
