package simulator

// BlockState represents the state of a download block
type BlockState int

const (
	BlockStateIdle BlockState = iota
	BlockStateDownloading
	BlockStateCompleted
)


// thread represents a download thread (internal use)
type thread struct {
	id            int        // Thread ID
	active        bool       // Whether thread is currently downloading
	currentBlock  int        // Index of block currently being downloaded (-1 if idle)
	blockStartTime int64      // Timestamp when block download started
	targetDuration float64   // Target time to complete current block (seconds)
	startBlock    int        // First block assigned to this thread
	endBlock      int        // Last block assigned to this thread (exclusive)
}