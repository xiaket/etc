# Murmur

A command-line tool to transcribe audio files using the OpenAI Whisper API, with support for both file transcription and real-time voice recording.

## Features

- **File Transcription**: Transcribe audio files using OpenAI's Whisper API
- **Voice Recording**: Real-time voice recording and transcription with spacebar control
- **Text Enhancement**: Automatically improve transcribed text grammar and formatting using OpenAI
- Support for language specification
- Automatically handles large audio files by splitting them into chunks
- Intelligently merges transcripts from multiple chunks with overlap detection
- **Caching System**: Automatically caches chunk transcriptions as `.transcript.txt` files to avoid repeating API calls on network failures or retries
- Uses system temporary directory for audio chunks with automatic cleanup
- Includes logging support for debugging (set `RUST_LOG=debug` for detailed output)

## Requirements

- Rust (latest stable version)
- FFmpeg (for processing large audio files)
- OpenAI API key
- Audio system support (for voice recording mode)

## Installation

1. Make sure you have Rust installed. If not, visit [rustup.rs](https://rustup.rs) to install.
2. Clone this repository
3. Build the project:
   ```bash
   cargo build --release
   ```
4. The executable will be available at `target/release/murmur`

## Setup

1. Set up your OpenAI API key as an environment variable:
   ```bash
   export OPENAI_API_KEY=your_api_key_here
   ```
   
   Alternatively, create a `.env` file in the same directory as the executable with:
   ```
   OPENAI_API_KEY=your_api_key_here
   ```

## Usage

### File Transcription Mode
```bash
murmur --input <FILE_PATH> [--language <LANGUAGE_CODE>]
```

### Voice Recording Mode
```bash
murmur [--language <LANGUAGE_CODE>]
```

### Arguments:

- `--input`, `-i` (optional): Path to the audio file (MP3 format). If not provided, enters voice recording mode
- `--language`, `-l` (optional): Language code (e.g., "en" for English, "es" for Spanish)

### Examples:

**File transcription:**
```bash
murmur --input recording.mp3 --language en
```

**Voice recording (no input file specified):**
```bash
murmur --language en
```

## Size Limitations

- Files up to 25MB (OpenAI's API limit) are processed directly
- Larger files are automatically split into chunks of approximately 23MB each
- **Smart Overlap**: Each chunk includes 10 seconds of overlap with adjacent chunks to prevent word/sentence cutoff issues
- Transcripts from multiple chunks are intelligently merged with automatic duplicate removal

## Output

### File Transcription Mode
The transcription will be saved as a text file in the same directory as the input file, with the same name but a `.txt` extension.

### Voice Recording Mode
- Press and hold the **spacebar** to start recording
- Release the **spacebar** to stop recording and begin transcription
- Status messages will show processing progress:
  - "Waiting for Whisper response..." during transcription
  - "Waiting for OpenAI response..." during text enhancement
- The enhanced transcription will be displayed in the terminal and the program will exit normally

## Debugging

For detailed logging, set the `RUST_LOG` environment variable:

```bash
RUST_LOG=debug murmur --input recording.mp3
```

## Caching
- When processing large files, each chunk's transcription is automatically cached as `chunk_XXX.mp3.transcript.txt`
- If processing is interrupted and restarted, cached transcripts will be reused instead of making new API calls
- This saves time and API costs when dealing with network issues or interruptions


## Testing

Run the test suite with:

```bash
cargo test
```

Note: Tests include mock HTTP server tests that require the `wiremock` crate.

## License

This project is licensed under the MIT License - see the LICENSE file for details.