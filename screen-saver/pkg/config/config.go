package config

import (
	"image/color"
	"time"
)

// Application settings
var (
	AppTitle = "Glow up" // Application window title
)

// Visual settings
var (
	BallSize    = 60 // Size of each ball in pixels
	BallPadding = 8  // Padding between balls in pixels
)

// Color definitions
var (
	ColorBackground = color.NRGBA{0, 0, 0, 255}       // Black
	ColorIdle       = color.NRGBA{61, 61, 61, 255}    // #3d3d3d
	ColorCompleted  = color.NRGBA{19, 163, 181, 255}  // #13a3b5
	ColorText       = color.NRGBA{255, 255, 255, 255} // White
	ColorCountdown  = color.NRGBA{255, 255, 0, 255}   // Yellow for countdown

	// Gradient colors for downloading state (horizontal gradient)
	GradientColor1 = color.NRGBA{12, 196, 204, 255} // #0cc4cc
	GradientColor2 = color.NRGBA{125, 42, 232, 255} // #7d2ae8
)

// Threading settings
var (
	ThreadOptions = []int{7, 11, 13} // Prime numbers for better visual distribution
)

// Timing settings
var (
	StartupGracePeriod = 5 * time.Second        // Grace period before handling events and starting app monitoring
	RenderInterval     = 500 * time.Millisecond // 2 FPS (how often to render frames)
	SimulationInterval = 250 * time.Millisecond // 4 FPS (how often to update simulation)
	CountdownDuration  = 3                      // Countdown seconds before restart
)
