package simulator

import (
	"log/slog"
	"math/rand"
	"sync"
	"time"

	"github.com/xiaket/etc/screen-saver/pkg/config"
)

// DownloadSimulator simulates a multi-threaded download process
type DownloadSimulator struct {
	totalBlocks int
	maxThreads  int
	blocks      []BlockState
	threads     []thread
	running     bool
	done        chan struct{}
	mutex       sync.RWMutex
	rand        *rand.Rand
}

// New creates a new download simulator
func New(totalBlocks, maxThreads int) *DownloadSimulator {
	return &DownloadSimulator{
		totalBlocks: totalBlocks,
		maxThreads:  maxThreads,
		blocks:      make([]BlockState, totalBlocks),
		threads:     make([]thread, maxThreads),
		done:        make(chan struct{}),
		rand:        rand.New(rand.NewSource(time.Now().UnixNano())),
	}
}

// Start begins the download simulation
func (ds *DownloadSimulator) Start() {
	ds.running = true

	// Initialize threads with evenly distributed starting positions
	for i := range ds.threads {
		ds.threads[i] = thread{
			id:             i,
			active:         false,
			currentBlock:   -1,
			blockStartTime: time.Now().UnixNano(),
			targetDuration: 0,
		}
	}

	// Start threads at evenly distributed positions
	ds.initializeEvenlyDistributedThreads()

	// Start simulation goroutine
	go ds.simulate()
}

// initializeEvenlyDistributedThreads starts all threads with their assigned block ranges
func (ds *DownloadSimulator) initializeEvenlyDistributedThreads() {
	if ds.totalBlocks == 0 || ds.maxThreads == 0 {
		return
	}

	// Calculate blocks per thread
	blocksPerThread := ds.totalBlocks / ds.maxThreads
	remainingBlocks := ds.totalBlocks % ds.maxThreads

	// Start all threads with their first assigned block
	for i := 0; i < ds.maxThreads; i++ {
		// Calculate this thread's block range
		startBlock := i * blocksPerThread
		if i < remainingBlocks {
			startBlock += i
		} else {
			startBlock += remainingBlocks
		}

		endBlock := startBlock + blocksPerThread
		if i < remainingBlocks {
			endBlock += 1
		}

		// Set thread's assigned range
		ds.threads[i].startBlock = startBlock
		ds.threads[i].endBlock = endBlock

		// Only activate thread if it has blocks to download
		if startBlock < ds.totalBlocks {
			ds.threads[i].active = true
			ds.threads[i].currentBlock = startBlock
			// Start time will be set when simulation actually begins
			ds.threads[i].blockStartTime = 0
			ds.threads[i].targetDuration = ds.rand.Float64()*2.5 + 0.8 // 0.8-3.3 seconds (faster initial download)
			ds.blocks[startBlock] = BlockStateDownloading
		}
	}
}

// Stop stops the download simulation
func (ds *DownloadSimulator) Stop() {
	ds.running = false
}

// GetBlocks returns a copy of the current block states
func (ds *DownloadSimulator) GetBlocks() []BlockState {
	ds.mutex.RLock()
	defer ds.mutex.RUnlock()

	result := make([]BlockState, len(ds.blocks))
	copy(result, ds.blocks)
	return result
}

// Done returns a channel that is closed when download is complete
func (ds *DownloadSimulator) Done() <-chan struct{} {
	return ds.done
}

// simulate runs the main simulation loop
func (ds *DownloadSimulator) simulate() {
	updateInterval := config.SimulationInterval // Update simulation more frequently than UI

	// Set start time for all active threads when simulation actually begins
	now := time.Now().UnixNano()
	for i := range ds.threads {
		if ds.threads[i].active && ds.threads[i].blockStartTime == 0 {
			ds.threads[i].blockStartTime = now
		}
	}

	ticker := time.NewTicker(updateInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ticker.C:
			if !ds.updateSimulation() {
				slog.Info("Simulation completed")
				return
			}
		}
	}
}

// updateSimulation updates the simulation state and returns false if done
func (ds *DownloadSimulator) updateSimulation() bool {
	ds.mutex.Lock()
	defer ds.mutex.Unlock()

	if !ds.running {
		return false
	}

	// Check if all blocks are completed
	allCompleted := true
	for _, block := range ds.blocks {
		if block != BlockStateCompleted {
			allCompleted = false
			break
		}
	}

	if allCompleted {
		close(ds.done)
		ds.running = false
		return false
	}

	// Update each thread
	for i := range ds.threads {
		ds.updateThread(&ds.threads[i])
	}

	return true
}

// updateThread updates a single thread's state
func (ds *DownloadSimulator) updateThread(thread *thread) {
	now := time.Now().UnixNano()

	// Skip inactive threads - they stay idle after completing their assigned block
	if !thread.active {
		return
	}

	// Continue downloading current block
	elapsedTime := float64(now-thread.blockStartTime) / float64(time.Second)

	// Simulate occasional pauses (reduced frequency for better pacing)
	if ds.rand.Float64() < 0.05 { // 5% chance of pause
		thread.targetDuration += ds.rand.Float64()*1.0 + 0.3 // Add 0.3-1.3s delay
	}

	// Complete block when target duration is reached
	if elapsedTime > thread.targetDuration {
		if thread.currentBlock >= 0 && thread.currentBlock < len(ds.blocks) {
			ds.blocks[thread.currentBlock] = BlockStateCompleted
		}

		// Find next block in this thread's assigned range
		nextBlock := ds.findNextBlockForThread(thread.id)
		if nextBlock >= 0 {
			// Continue with next assigned block
			thread.currentBlock = nextBlock
			thread.blockStartTime = time.Now().UnixNano()
			thread.targetDuration = ds.rand.Float64()*3.0 + 0.8 // 0.8-3.8 seconds
			ds.blocks[nextBlock] = BlockStateDownloading
		} else {
			// No more blocks assigned to this thread, become inactive
			thread.active = false
			thread.currentBlock = -1
			thread.targetDuration = 0
		}
	}
}

// findNextBlockForThread finds the next block for a thread to download
// Each thread works on consecutive blocks in its assigned region ONLY
func (ds *DownloadSimulator) findNextBlockForThread(threadID int) int {
	if threadID >= len(ds.threads) {
		return -1
	}

	thread := &ds.threads[threadID]

	// Find the FIRST idle block in this thread's assigned region (sequential order)
	for i := thread.startBlock; i < thread.endBlock && i < ds.totalBlocks; i++ {
		if ds.blocks[i] == BlockStateIdle {
			return i
		}
	}

	return -1 // No more idle blocks in this thread's assigned region
}
