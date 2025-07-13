package main

import (
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/xiaket/etc/screen-saver/pkg/ui"
	"github.com/xiaket/etc/screen-saver/pkg/utils"
)

func main() {
	// Setup signal handling for graceful exit
	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	// Get screen dimensions
	screenWidth, screenHeight, err := utils.GetScreenDimensions()
	if err != nil {
		slog.Error("Failed to get screen dimensions", "error", err)
		os.Exit(1)
	}

	slog.Info("Screen dimensions detected", "width", screenWidth, "height", screenHeight)

	// Calculate grid layout and total blocks dynamically
	gridLayout := ui.CalculateLayout(screenWidth, screenHeight)
	totalBlocks := gridLayout.GetActualBlockCount()

	slog.Info("Grid layout calculated", "cols", gridLayout.Cols, "rows", gridLayout.Rows, "total_blocks", totalBlocks)

	// Create UI app
	app, err := ui.NewApp(gridLayout, totalBlocks)
	if err != nil {
		slog.Error("Failed to create UI app", "error", err)
		os.Exit(1)
	}

	slog.Info("Starting screen-saver", "message", "Press Ctrl+C to exit")

	// Handle exit scenarios
	go func() {
		<-sigChan
		slog.Info("Received interrupt signal, exiting")
		app.Exit()
		os.Exit(0)
	}()

	// Run the UI (blocking call)
	if err := app.Run(); err != nil {
		slog.Error("Failed to run app", "error", err)
		os.Exit(1)
	}
}