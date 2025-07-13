# Screen Saver

A screen-saver application for macOS that simulates multi-threaded download progress visualization, inspired by classic download managers like NetAnt and BitSpirit.

## Features

- **Smooth Animations**: Real-time color transitions and progress updates

## System Requirements

**⚠️ macOS Only**: This application is designed exclusively for macOS and uses AppleScript for system integration.

- macOS 10.14+ (recommended)
- Go 1.19+ (for development)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/xiaket/etc/screen-saver.git
cd screen-saver
```

2. Build the application:
```bash
go build -o screen-saver cmd/screen-saver/main.go
```

3. Run the screen-saver:
```bash
./screen-saver
```

## Usage

### Running the Application

```bash
./screen-saver
```

The application will:
1. Display a full-screen grid of colored circles representing download blocks
2. Simulate multi-threaded downloading with color transitions:
   - **Gray**: Undownloaded blocks
   - **Blue**: Currently downloading
   - **Green**: Completed downloads
3. Show a 3-second countdown after completion
4. Restart automatically with a new random thread count

### Exiting the Application

The screen-saver will automatically exit and lock the screen when:
- **Any key** is pressed
- **Mouse click** or trackpad tap
- **Application switching** (⌘+Tab to another app)
- **Window loses focus**

## Project Structure

```
screen-saver/
├── cmd/screen-saver/       # Application entry point
│   └── main.go            # Main application logic
├── pkg/
│   ├── simulator/         # Download simulation engine
│   │   ├── simulator.go   # Core simulation logic
│   │   └── state.go       # Block state definitions
│   ├── ui/                # User interface layer
│   │   ├── app.go         # Basic app structure
│   │   ├── app_restart.go # Restart functionality & input handling
│   │   ├── layout.go      # Grid layout calculations
│   │   └── renderer.go    # Graphics rendering
│   └── utils/             # System utilities
│       └── screen.go      # Screen resolution & lock functionality
└── doc/                   # Documentation
    └── requirements.md    # Technical requirements
```

## Use Cases

- **Screen-saver Alternative**: Engaging visual display during idle time
- **Demonstration Tool**: Showcase multi-threaded download concepts
- **Security Tool**: Automatic screen locking when stepping away
- **Nostalgia**: Reminiscent of classic download manager interfaces

## Technical Implementation

- **Framework**: Go with Gio UI for cross-platform GUI capabilities
- **System Integration**: AppleScript for macOS-specific functionality
- **Animation**: Smooth real-time rendering with optimized performance
- **Architecture**: Modular design with clear separation of concerns

## Development

### Building from Source
```bash
go mod tidy
go build -o screen-saver cmd/screen-saver/main.go
```

### Contributing
Contributions are welcome! Please ensure all changes maintain macOS compatibility and follow the existing code structure.

## License

MIT License - See LICENSE file for details.