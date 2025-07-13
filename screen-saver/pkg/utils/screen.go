package utils

import (
	"log/slog"
	"os/exec"
	"strconv"
	"strings"
)

// Default screen resolution used as fallback
const (
	DefaultScreenWidth  = 1920
	DefaultScreenHeight = 1080
)

// GetScreenDimensions returns the primary screen dimensions
func GetScreenDimensions() (width, height int, err error) {
	slog.Info("Attempting to get screen dimensions using system_profiler")
	cmd := exec.Command("system_profiler", "SPDisplaysDataType")
	output, err := cmd.Output()
	if err != nil {
		slog.Warn("system_profiler failed, falling back to default resolution", "error", err)
		// Fallback to a common resolution
		return DefaultScreenWidth, DefaultScreenHeight, nil
	}

	// Parse the output to find resolution
	lines := strings.Split(string(output), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.Contains(line, "Resolution:") {
			// Example: "Resolution: 2560 x 1440"
			parts := strings.Fields(line)
			if len(parts) >= 4 {
				width, err1 := strconv.Atoi(parts[1])
				height, err2 := strconv.Atoi(parts[3])
				if err1 == nil && err2 == nil {
					slog.Info("system_profiler method successful", "width", width, "height", height)
					return width, height, nil
				}
			}
		}
	}

	// If parsing fails, use default resolution
	slog.Warn("system_profiler parsing failed, using default resolution", "width", DefaultScreenWidth, "height", DefaultScreenHeight)
	return DefaultScreenWidth, DefaultScreenHeight, nil
}

// LockScreen locks the screen based on the operating system
func LockScreen() error {
	// Try the primary method (newer macOS versions)
	cmd := exec.Command("osascript", "-e", "tell application \"System Events\" to keystroke \"q\" using {control down, command down}")
	err := cmd.Run()
	if err == nil {
		return nil
	}

	// Fallback method
	cmd = exec.Command("pmset", "displaysleepnow")
	return cmd.Run()
}