use anyhow::{Context, Result};
use reqwest::multipart::{Form, Part};
use std::path::Path;
use tokio::fs;

use crate::utils::{self, Config};
use crate::Args;

/// OpenAI Whisper API client
pub struct WhisperClient {
    client: reqwest::Client,
    api_key: String,
    base_url: String,
}

impl WhisperClient {
    pub fn new(api_key: String, config: &Config) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(
                config.whisper_timeout_seconds,
            ))
            .build()?;

        Ok(Self {
            client,
            api_key,
            base_url: "https://api.openai.com/v1".to_string(),
        })
    }

    pub async fn transcribe(&self, args: &Args) -> Result<String> {
        let input_path = args
            .input
            .as_ref()
            .context("Input file path is required for transcription")?;

        // Validate input file exists
        if !input_path.exists() {
            anyhow::bail!("Input file {:?} does not exist", input_path);
        }

        let file_size = utils::get_file_size(input_path).await?;
        let file_size_mb = utils::bytes_to_mb(file_size);

        // Check size limit for direct API calls
        if file_size_mb > utils::MAX_FILE_SIZE_MB as f64 {
            anyhow::bail!(
                "File size ({:.2} MB) exceeds {} MB limit",
                file_size_mb,
                utils::MAX_FILE_SIZE_MB
            );
        }

        // Print processing message only for regular files (not chunks or recordings)
        if !self.is_chunk_file(input_path) && !self.is_temp_recording(input_path) {
            println!("Processing file ({:.1} MB)...", file_size_mb);
        }

        // Read file content
        let file_bytes = fs::read(input_path)
            .await
            .context("Failed to read audio file")?;

        // Build multipart form
        let file_name = utils::get_filename_or_default(input_path, "audio.mp3");
        let form = self.build_form(&file_name, file_bytes, &args.language)?;

        // Send request
        self.send_transcription_request(form).await
    }

    fn is_chunk_file(&self, path: &Path) -> bool {
        path.to_string_lossy().contains("murmur_audio_chunks")
    }

    fn is_temp_recording(&self, path: &Path) -> bool {
        path.to_string_lossy().contains("murmur_recording")
    }

    fn build_form(
        &self,
        file_name: &str,
        file_bytes: Vec<u8>,
        language: &Option<String>,
    ) -> Result<Form> {
        let mut form = Form::new()
            .text("model", "whisper-1")
            .text("response_format", "text")
            .text("temperature", "0");

        if let Some(lang) = language {
            form = form.text("language", lang.clone());
        }

        let file_part = Part::bytes(file_bytes)
            .file_name(file_name.to_string())
            .mime_str("audio/mpeg")?;

        form = form.part("file", file_part);
        Ok(form)
    }

    async fn send_transcription_request(&self, form: Form) -> Result<String> {
        let response = self
            .client
            .post(format!("{}/audio/transcriptions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .context("Failed to send request")?;

        // Handle response
        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            let error_message = match status.as_u16() {
                401 => "Invalid API key. Please check your OPENAI_API_KEY environment variable."
                    .to_string(),
                429 => "Rate limit exceeded. Please wait a moment and try again.".to_string(),
                413 => "File too large for API. This shouldn't happen with proper chunking."
                    .to_string(),
                400 => format!("Bad request: {}", error_text),
                500..=599 => "OpenAI server error. Please try again later.".to_string(),
                _ => format!("API error ({}): {}", status, error_text),
            };
            anyhow::bail!("{}", error_message);
        }

        response.text().await.context("Failed to read response")
    }

    pub async fn enhance_text(&self, prompt: &str) -> Result<String> {
        let request_body = serde_json::json!({
            "model": "gpt-3.5-turbo",
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "max_tokens": 2000,
            "temperature": 0.3
        });

        let response = self
            .client
            .post(format!("{}/chat/completions", self.base_url))
            .header("Authorization", format!("Bearer {}", self.api_key))
            .header("Content-Type", "application/json")
            .json(&request_body)
            .send()
            .await
            .context("Failed to send enhancement request")?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await?;
            let error_message = match status.as_u16() {
                401 => "Invalid API key for text enhancement.".to_string(),
                429 => "Rate limit exceeded for text enhancement.".to_string(),
                400 => format!("Bad request for text enhancement: {}", error_text),
                500..=599 => "OpenAI server error during text enhancement.".to_string(),
                _ => format!("Enhancement API error ({}): {}", status, error_text),
            };
            anyhow::bail!("{}", error_message);
        }

        let response_json: serde_json::Value = response
            .json()
            .await
            .context("Failed to parse enhancement response")?;

        let enhanced_text = response_json["choices"][0]["message"]["content"]
            .as_str()
            .context("Invalid response format from enhancement API")?
            .trim()
            .to_string();

        Ok(enhanced_text)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn test_whisper_client() {
        let mock_server = MockServer::start().await;
        let response_body = "This is a test transcription.";

        Mock::given(method("POST"))
            .and(path("/audio/transcriptions"))
            .respond_with(ResponseTemplate::new(200).set_body_string(response_body))
            .mount(&mock_server)
            .await;

        let mut temp_file = NamedTempFile::new().unwrap();
        let dummy_data = vec![0u8; 1024];
        temp_file.write_all(&dummy_data).unwrap();
        temp_file.flush().unwrap();

        let client = WhisperClient {
            client: reqwest::Client::new(),
            api_key: "test_key".to_string(),
            base_url: mock_server.uri(),
        };

        let args = Args {
            input: Some(temp_file.path().to_path_buf()),
            language: Some("en".to_string()),
            watch: false,
        };

        let result = client.transcribe(&args).await;
        assert!(result.is_ok(), "Transcribe failed: {:?}", result.err());
        assert_eq!(result.unwrap(), response_body);
    }

    #[test]
    fn test_is_chunk_file() {
        let _config = Config::default();
        let client = WhisperClient {
            client: reqwest::Client::new(),
            api_key: "test".to_string(),
            base_url: "test".to_string(),
        };

        let chunk_path = std::path::Path::new("/tmp/murmur_audio_chunks/chunk_001.mp3");
        let normal_path = std::path::Path::new("/tmp/audio.mp3");

        assert!(client.is_chunk_file(chunk_path));
        assert!(!client.is_chunk_file(normal_path));
    }
}
