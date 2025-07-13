package ui

import (
	"log/slog"
	"math/rand"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"gioui.org/app"
	"gioui.org/io/key"
	"gioui.org/io/pointer"
	"gioui.org/io/system"
	"gioui.org/layout"
	"gioui.org/op"
	"gioui.org/op/clip"

	"github.com/xiaket/etc/screen-saver/pkg/config"
	"github.com/xiaket/etc/screen-saver/pkg/simulator"
	"github.com/xiaket/etc/screen-saver/pkg/utils"
)

// AppState represents the current state of the application
type AppState int

const (
	appSwitchingScript = `
on run
	tell application "System Events"
		repeat
			set currentApp to name of first application process whose frontmost is true
			if currentApp is not "screen-saver" and currentApp is not "Screen Saver" then
				return "switched"
			end if
			delay 0.1
		end repeat
	end tell
end run
`
	StateDownloading AppState = iota
	StateCountdown
)

// App represents the main UI application
type App struct {
	window      *app.Window
	sim         *simulator.DownloadSimulator
	layout      GridLayout
	totalBlocks int
	renderer    *Renderer
	exit        chan struct{}
	exitOnce    sync.Once
	state       AppState
	countdown   int
	startTime   time.Time
}

// Exit signals the application to exit safely
func (a *App) Exit() {
	a.exitOnce.Do(func() {
		close(a.exit)
	})
	if a.window != nil {
		a.window.Perform(system.ActionClose)
	}
}

// safeExit safely exits and locks screen, avoiding double close
func (a *App) safeExit() {
	a.exitOnce.Do(func() {
		close(a.exit)
	})

	// Lock the screen
	if err := utils.LockScreen(); err != nil {
		slog.Error("Failed to lock screen", "error", err)
	}

	os.Exit(0)
}

// NewApp creates a new UI application
func NewApp(gridLayout GridLayout, totalBlocks int) (*App, error) {
	// Create a new window
	window := app.NewWindow(
		app.Title(config.AppTitle),
		app.Fullscreen.Option(),
		app.Decorated(false),
	)

	// Create renderer
	renderer, err := NewRenderer()
	if err != nil {
		return nil, err
	}

	// Create initial simulator with random thread count (using primes for better visual distribution)
	threadCount := config.ThreadOptions[rand.Intn(len(config.ThreadOptions))]
	slog.Info("Starting simulation", "threads", threadCount)
	sim := simulator.New(totalBlocks, threadCount)

	return &App{
		window:      window,
		sim:         sim,
		layout:      gridLayout,
		totalBlocks: totalBlocks,
		renderer:    renderer,
		exit:        make(chan struct{}),
		state:       StateDownloading,
		startTime:   time.Now(),
	}, nil
}

// restart creates a new simulation with random thread count
func (a *App) restart() {
	// Stop current simulation
	if a.sim != nil {
		a.sim.Stop()
	}

	threadCount := config.ThreadOptions[rand.Intn(len(config.ThreadOptions))]
	slog.Info("Restarting simulation", "threads", threadCount)
	a.sim = simulator.New(a.totalBlocks, threadCount)

	// Start new simulation
	go a.sim.Start()

	// Reset state
	a.state = StateDownloading
}

// Run starts the UI event loop with restart capability
func (a *App) Run() error {
	var ops op.Ops

	// Start initial simulation
	go a.sim.Start()

	// Monitor app switching using macOS notifications
	go func() {
		// Wait a few seconds before starting app monitoring
		time.Sleep(config.StartupGracePeriod)
		a.monitorAppSwitching()
	}()

	// Setup render timer and simulation monitoring
	renderTicker := time.NewTicker(config.RenderInterval)
	defer renderTicker.Stop()

	// Render timer goroutine
	go func() {
		for {
			select {
			case <-renderTicker.C:
				a.window.Invalidate()
			case <-a.exit:
				return
			}
		}
	}()

	// Simulation monitoring and restart logic
	go func() {
		for {
			select {
			case <-a.exit:
				return
			case <-a.sim.Done():
				// Start countdown
				a.state = StateCountdown
				a.countdown = config.CountdownDuration

				countdownTicker := time.NewTicker(time.Second)
				defer countdownTicker.Stop()

				for a.countdown > 0 {
					select {
					case <-countdownTicker.C:
						a.countdown--
					case <-a.exit:
						return
					}
				}

				a.restart()
			}
		}
	}()

	// Main UI event loop
	go func() {
		for {
			select {
			case <-a.exit:
				return
			default:
				e := a.window.NextEvent()
				switch e := e.(type) {
				case system.DestroyEvent:
					a.Exit()
					return
				case system.StageEvent:
					slog.Debug("Stage event received", "stage", e.Stage)
					// Exit and lock screen when window loses focus (but only after grace period)
					if e.Stage < system.StageRunning && time.Since(a.startTime) > config.StartupGracePeriod {
						slog.Info("Window lost focus, exiting and locking screen")
						a.safeExit()
						return
					}
				case system.FrameEvent:
					gtx := layout.NewContext(&ops, e)

					// Set up input handling for the entire screen
					area := clip.Rect{Max: gtx.Constraints.Max}.Push(gtx.Ops)

					// Add key input area
					key.InputOp{Tag: "screen-saver"}.Add(gtx.Ops)

					// Add pointer input area - capture all pointer events including movement
					pointer.InputOp{
						Tag:   "screen-saver",
						Kinds: pointer.Press | pointer.Release | pointer.Move | pointer.Drag | pointer.Enter | pointer.Leave,
					}.Add(gtx.Ops)

					area.Pop()

					// Check for input events
					for _, ev := range e.Queue.Events("screen-saver") {
						// Check grace period for all input events
						if time.Since(a.startTime) < config.StartupGracePeriod {
							continue
						}

						switch ev := ev.(type) {
						case key.Event:
							if ev.State == key.Press {
								a.safeExit()
								return
							}
						case pointer.Event:
							// Exit on ANY pointer event after the grace period
							a.safeExit()
							return
						}
					}

					a.draw(gtx)
					e.Frame(gtx.Ops)
				}
			}
		}
	}()

	// Call app.Main() to start the GUI
	app.Main()
	return nil
}

// monitorAppSwitching uses AppleScript to monitor for app switching events
func (a *App) monitorAppSwitching() {
	slog.Info("Starting app switching monitor")

	cmd := exec.Command("osascript", "-e", appSwitchingScript)
	output, err := cmd.Output()

	if err == nil && strings.TrimSpace(string(output)) == "switched" {
		slog.Info("App switching detected, exiting and locking screen")
		a.safeExit()
	}
}

// draw renders the current frame with state awareness
func (a *App) draw(gtx layout.Context) {
	// Set black background
	a.renderer.DrawBackground(gtx)

	switch a.state {
	case StateDownloading:
		// Draw progress balls (full screen)
		a.renderer.DrawProgressBalls(gtx, a.sim, a.layout)
	case StateCountdown:
		// Draw countdown
		a.renderer.DrawCountdown(gtx, a.countdown)
	}
}