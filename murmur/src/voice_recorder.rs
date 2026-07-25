use anyhow::{Context, Result};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use crossterm::{
    event::{self, Event, KeyCode, KeyEvent, KeyModifiers},
    terminal::{disable_raw_mode, enable_raw_mode},
};
use hound::{WavSpec, WavWriter};
use std::fs::File;
use std::io::BufWriter;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct VoiceRecorder {
    device: Device,
    config: StreamConfig,
}

impl VoiceRecorder {
    pub fn new() -> Result<Self> {
        let host = cpal::default_host();
        let device = host
            .default_input_device()
            .context("No input device available. Please check microphone permissions.")?;

        let config = device
            .default_input_config()
            .context("Failed to get default input config")?
            .into();

        Ok(Self { device, config })
    }

    pub async fn record_directly() -> Result<PathBuf> {
        println!("Recording...");

        let recorder = Self::new()?;
        let temp_dir = std::env::temp_dir();
        let audio_file = temp_dir.join("murmur_recording.wav");

        enable_raw_mode()?;

        let audio_data: Arc<Mutex<Vec<f32>>> = Arc::new(Mutex::new(Vec::new()));

        // Start recording immediately
        let data_clone = Arc::clone(&audio_data);
        data_clone.lock().unwrap().clear();
        let stream = recorder.start_recording(data_clone)?;

        // Wait for 'q' key to stop recording or Ctrl+C to exit
        loop {
            if event::poll(Duration::from_millis(100))? {
                if let Event::Key(KeyEvent {
                    code, modifiers, ..
                }) = event::read()?
                {
                    match code {
                        KeyCode::Char('q') => {
                            break;
                        }
                        KeyCode::Char('c') if modifiers.contains(KeyModifiers::CONTROL) => {
                            // Ctrl+C pressed - exit the entire program
                            disable_raw_mode()?;
                            std::process::exit(0);
                        }
                        _ => {}
                    }
                }
            }
            thread::sleep(Duration::from_millis(10));
        }

        // Stop recording
        drop(stream);

        let data = audio_data.lock().unwrap();
        let result = if !data.is_empty() {
            Self::save_audio_data(&data, &audio_file, &recorder.config)
                .context("Failed to save audio data")
                .map(|_| audio_file)
        } else {
            Err(anyhow::anyhow!("No audio data recorded"))
        };

        // Always cleanup terminal state
        disable_raw_mode()?;
        result
    }

    fn start_recording(&self, audio_data: Arc<Mutex<Vec<f32>>>) -> Result<Stream> {
        let stream = self
            .device
            .build_input_stream(
                &self.config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if let Ok(mut buffer) = audio_data.lock() {
                        buffer.extend_from_slice(data);
                    }
                },
                |err| eprintln!("Audio stream error: {}", err),
                None,
            )
            .context("Failed to build input stream")?;

        stream.play().context("Failed to start audio stream")?;
        Ok(stream)
    }

    fn save_audio_data(data: &[f32], path: &PathBuf, config: &StreamConfig) -> Result<()> {
        let spec = WavSpec {
            channels: config.channels,
            sample_rate: config.sample_rate.0,
            bits_per_sample: 32,
            sample_format: hound::SampleFormat::Float,
        };

        let file = File::create(path)?;
        let mut writer = WavWriter::new(BufWriter::new(file), spec)?;

        for &sample in data {
            writer.write_sample(sample)?;
        }

        writer.finalize()?;
        Ok(())
    }
}
