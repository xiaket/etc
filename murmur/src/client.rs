//! GLM ASR client for audio transcription via SGLang server

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;

use crate::utils::{self, Config};
use crate::Args;

/// Request structure for GLM ASR API
#[derive(Serialize)]
struct GlmAsrRequest {
    model: String,
    messages: Vec<Message>,
    max_tokens: u32,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: Vec<ContentPart>,
}

#[derive(Serialize)]
#[serde(tag = "type")]
enum ContentPart {
    #[serde(rename = "audio_url")]
    AudioUrl { audio_url: AudioUrlData },
    #[serde(rename = "text")]
    Text { text: String },
}

#[derive(Serialize)]
struct AudioUrlData {
    url: String,
}

/// Response structure from GLM ASR API
#[derive(Deserialize)]
struct GlmAsrResponse {
    choices: Vec<Choice>,
}

#[derive(Deserialize)]
struct Choice {
    message: ResponseMessage,
}

#[derive(Deserialize)]
struct ResponseMessage {
    content: String,
}

/// GLM ASR API client using chat completions format
pub struct GlmAsrClient {
    client: reqwest::Client,
    base_url: String,
}

impl GlmAsrClient {
    pub fn new(base_url: String, config: &Config) -> Result<Self> {
        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(config.asr_timeout_seconds))
            .build()?;

        Ok(Self { client, base_url })
    }

    /// Transcribe an audio file
    /// The container_path should be the path to the audio file inside the Docker container
    pub async fn transcribe(&self, args: &Args, container_path: &str) -> Result<String> {
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

        // Check size limit
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

        self.send_transcription_request(container_path).await
    }

    fn is_chunk_file(&self, path: &Path) -> bool {
        path.to_string_lossy().contains("murmur_audio")
            && path.to_string_lossy().contains("chunks")
    }

    fn is_temp_recording(&self, path: &Path) -> bool {
        path.to_string_lossy().contains("murmur_recording")
    }

    async fn send_transcription_request(&self, container_path: &str) -> Result<String> {
        let request = GlmAsrRequest {
            model: "glm-asr".to_string(),
            messages: vec![Message {
                role: "user".to_string(),
                content: vec![
                    ContentPart::AudioUrl {
                        audio_url: AudioUrlData {
                            url: container_path.to_string(),
                        },
                    },
                    ContentPart::Text {
                        text: "Please transcribe this audio".to_string(),
                    },
                ],
            }],
            max_tokens: 4096,
        };

        let response = self
            .client
            .post(format!("{}/v1/chat/completions", self.base_url))
            .json(&request)
            .send()
            .await
            .context("Failed to send request to GLM ASR server")?;

        let status = response.status();
        if !status.is_success() {
            let error_text = response.text().await.unwrap_or_default();
            anyhow::bail!("GLM ASR error ({}): {}", status.as_u16(), error_text);
        }

        let response_body: GlmAsrResponse = response
            .json()
            .await
            .context("Failed to parse GLM ASR response")?;

        response_body
            .choices
            .first()
            .map(|c| c.message.content.trim().to_string())
            .context("No transcription in response")
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
    async fn test_glm_asr_client() {
        let mock_server = MockServer::start().await;
        let response_body = serde_json::json!({
            "choices": [{
                "message": {
                    "content": "This is a test transcription."
                }
            }]
        });

        Mock::given(method("POST"))
            .and(path("/v1/chat/completions"))
            .respond_with(ResponseTemplate::new(200).set_body_json(&response_body))
            .mount(&mock_server)
            .await;

        let mut temp_file = NamedTempFile::new().unwrap();
        let dummy_data = vec![0u8; 1024];
        temp_file.write_all(&dummy_data).unwrap();
        temp_file.flush().unwrap();

        let config = Config::default();
        let client = GlmAsrClient::new(mock_server.uri(), &config).unwrap();

        let args = Args {
            input: Some(temp_file.path().to_path_buf()),
            language: Some("en".to_string()),
        };

        let result = client.transcribe(&args, "/audio/test.mp3").await;
        assert!(result.is_ok(), "Transcribe failed: {:?}", result.err());
        assert_eq!(result.unwrap(), "This is a test transcription.");
    }

    #[test]
    fn test_is_chunk_file() {
        let config = Config::default();
        let client = GlmAsrClient::new("http://test".to_string(), &config).unwrap();

        let chunk_path = std::path::Path::new("/tmp/murmur_audio/chunks/chunk_001.mp3");
        let normal_path = std::path::Path::new("/tmp/audio.mp3");

        assert!(client.is_chunk_file(chunk_path));
        assert!(!client.is_chunk_file(normal_path));
    }
}
