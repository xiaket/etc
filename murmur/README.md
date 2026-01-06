# Murmur

A command-line tool to transcribe audio files using GLM-ASR, with support for both file transcription and voice recording.

## Features

- **File Transcription**: Transcribe audio files using GLM-ASR model locally
- **Voice Recording**: Voice recording and transcription with 'q' key control
- Support for multiple audio formats: MP3, WAV, M4A, FLAC, OGG
- Support for language specification
- Automatically handles large audio files by splitting them into chunks
- Intelligently merges transcripts from multiple chunks with overlap detection
- **Caching System**: Automatically caches chunk transcriptions to avoid repeating processing on retries
- **Auto-managed Python environment**: Uses `uv` to automatically set up and manage Python dependencies
- Uses system temporary directory for audio chunks with automatic cleanup

## Requirements

- Rust (latest stable version)
- FFmpeg (for processing large audio files)
- [uv](https://docs.astral.sh/uv/) (Python package manager)
- Audio system support (for voice recording mode)

## Installation

1. Install uv (if not already installed):
   ```bash
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

2. Clone this repository

3. Build the project:
   ```bash
   cargo build --release
   ```

4. The executable will be available at `target/release/murmur`

5. Copy to your PATH (optional):
   ```bash
   cp target/release/murmur /usr/local/bin/
   ```

## First Run

On the first run, murmur will automatically:
1. Create a Python virtual environment at `~/.cache/murmur/venv`
2. Install required dependencies (torch, transformers, fastapi, uvicorn, etc.)
3. Download the GLM-ASR model (~3GB)

This may take several minutes. Subsequent runs will be much faster.

## Usage

### File Transcription Mode
```bash
murmur <FILE_PATH> [--language <LANGUAGE_CODE>]
```

### Voice Recording Mode
```bash
murmur [--language <LANGUAGE_CODE>]
```

### Arguments:

- `<FILE_PATH>` (optional): Path to the audio file. If not provided, enters voice recording mode
- `--language`, `-l` (optional): Language code (e.g., "en" for English, "zh" for Chinese)

### Examples:

**File transcription:**
```bash
murmur recording.mp3
murmur audio.m4a --language zh
```

**Voice recording (no input file specified):**
```bash
murmur
```

## Size Limitations

- Files up to 25MB are processed directly
- Larger files are automatically split into chunks of approximately 23MB each
- **Smart Overlap**: Each chunk includes 10 seconds of overlap with adjacent chunks to prevent word/sentence cutoff issues
- Transcripts from multiple chunks are intelligently merged with automatic duplicate removal

## Output

### File Transcription Mode
The transcription will be saved as a text file in the same directory as the input file, with the same name but a `.txt` extension.

### Voice Recording Mode
- The program will start recording automatically when no input file is provided
- Press **'q'** to stop recording and begin transcription
- The transcription will be displayed in the terminal

## External Server Mode

You can connect to an external GLM-ASR server instead of running one locally:

```bash
GLM_ASR_URL=http://your-server:8000 murmur recording.mp3
```

## Debugging

For detailed logging, set the `RUST_LOG` environment variable:

```bash
RUST_LOG=debug murmur recording.mp3
```

## Caching

- When processing large files, each chunk's transcription is automatically cached
- If processing is interrupted and restarted, cached transcripts will be reused
- This saves time when dealing with interruptions

## Testing

Run the test suite with:

```bash
cargo test
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
