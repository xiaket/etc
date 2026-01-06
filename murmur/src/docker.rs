//! Docker container lifecycle management for GLM ASR server

use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

use crate::utils::Config;

const CONTAINER_NAME: &str = "murmur-glm-asr";
const DOCKER_IMAGE: &str = "lmsysorg/sglang:dev";
const MODEL_PATH: &str = "zai-org/GLM-ASR-Nano-2512";
const MODEL_NAME: &str = "glm-asr";

/// Manages the GLM ASR Docker container lifecycle
pub struct GlmAsrContainer {
    container_id: Option<String>,
    host_port: u16,
    shared_audio_dir: PathBuf,
    huggingface_cache_dir: PathBuf,
}

impl GlmAsrContainer {
    /// Create a new container manager
    pub fn new(config: &Config) -> Result<Self> {
        // Clean up any orphan container from previous runs
        Self::cleanup_orphan_container();

        // Determine HuggingFace cache directory
        let huggingface_cache_dir = dirs::home_dir()
            .context("Cannot determine home directory")?
            .join(".cache/huggingface");

        Ok(Self {
            container_id: None,
            host_port: config.container_port,
            shared_audio_dir: PathBuf::from(&config.shared_audio_dir),
            huggingface_cache_dir,
        })
    }

    /// Start the Docker container
    pub async fn start(&mut self) -> Result<()> {
        // Ensure shared audio directory exists
        std::fs::create_dir_all(&self.shared_audio_dir)
            .context("Failed to create shared audio directory")?;

        // Ensure HuggingFace cache directory exists
        std::fs::create_dir_all(&self.huggingface_cache_dir)
            .context("Failed to create HuggingFace cache directory")?;

        // Check if image exists, if not, pull it first with visible progress
        if !self.image_exists()? {
            println!(
                "Docker image '{}' not found locally. Pulling (this may take a while)...",
                DOCKER_IMAGE
            );
            self.pull_image()?;
        }

        println!("Starting GLM ASR Docker container...");

        // Build the startup command that runs inside the container
        let startup_cmd = format!(
            "pip install git+https://github.com/huggingface/transformers && \
             python3 -m sglang.launch_server \
             --model-path {} \
             --served-model-name {} \
             --host 0.0.0.0 \
             --port 8000",
            MODEL_PATH, MODEL_NAME
        );

        let output = Command::new("docker")
            .args([
                "run",
                "-d",
                "--name",
                CONTAINER_NAME,
                "-p",
                &format!("{}:8000", self.host_port),
                "-v",
                &format!(
                    "{}:/root/.cache/huggingface",
                    self.huggingface_cache_dir.display()
                ),
                "-v",
                &format!("{}:/audio:ro", self.shared_audio_dir.display()),
                "--gpus",
                "all",
                DOCKER_IMAGE,
                "sh",
                "-c",
                &startup_cmd,
            ])
            .output()
            .context("Failed to execute docker command. Is Docker installed and running?")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            // If GPU not available, try without --gpus flag
            if stderr.contains("could not select device driver")
                || stderr.contains("nvidia")
                || stderr.contains("GPU")
            {
                return self.start_without_gpu().await;
            }
            anyhow::bail!("Failed to start Docker container: {}", stderr);
        }

        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        self.container_id = Some(container_id);

        Ok(())
    }

    /// Start container without GPU support (fallback)
    async fn start_without_gpu(&mut self) -> Result<()> {
        let startup_cmd = format!(
            "pip install git+https://github.com/huggingface/transformers && \
             python3 -m sglang.launch_server \
             --model-path {} \
             --served-model-name {} \
             --host 0.0.0.0 \
             --port 8000",
            MODEL_PATH, MODEL_NAME
        );

        let output = Command::new("docker")
            .args([
                "run",
                "-d",
                "--name",
                CONTAINER_NAME,
                "-p",
                &format!("{}:8000", self.host_port),
                "-v",
                &format!(
                    "{}:/root/.cache/huggingface",
                    self.huggingface_cache_dir.display()
                ),
                "-v",
                &format!("{}:/audio:ro", self.shared_audio_dir.display()),
                DOCKER_IMAGE,
                "sh",
                "-c",
                &startup_cmd,
            ])
            .output()
            .context("Failed to execute docker command")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            anyhow::bail!("Failed to start Docker container: {}", stderr);
        }

        let container_id = String::from_utf8_lossy(&output.stdout).trim().to_string();
        self.container_id = Some(container_id);

        Ok(())
    }

    /// Wait until the SGLang server is ready to accept requests
    pub async fn wait_until_ready(&self, timeout: Duration) -> Result<()> {
        let client = reqwest::Client::new();
        let url = format!("{}/v1/models", self.get_api_url());
        let start = std::time::Instant::now();
        let poll_interval = Duration::from_secs(2);

        println!("Waiting for GLM ASR server to start...");

        loop {
            if start.elapsed() > timeout {
                // Get container logs for debugging
                let logs = self.get_container_logs();
                anyhow::bail!(
                    "GLM ASR server did not start within {} seconds.\nContainer logs:\n{}",
                    timeout.as_secs(),
                    logs
                );
            }

            // Check if container is still running
            if !self.is_container_running() {
                let logs = self.get_container_logs();
                anyhow::bail!("Docker container stopped unexpectedly.\nLogs:\n{}", logs);
            }

            match client.get(&url).send().await {
                Ok(response) if response.status().is_success() => {
                    println!("GLM ASR server is ready.");
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(poll_interval).await;
                }
            }
        }
    }

    /// Check if the container is still running
    fn is_container_running(&self) -> bool {
        let output = Command::new("docker")
            .args(["ps", "-q", "-f", &format!("name={}", CONTAINER_NAME)])
            .output();

        match output {
            Ok(o) => !o.stdout.is_empty(),
            Err(_) => false,
        }
    }

    /// Get container logs for debugging
    fn get_container_logs(&self) -> String {
        let output = Command::new("docker")
            .args(["logs", "--tail", "50", CONTAINER_NAME])
            .output();

        match output {
            Ok(o) => {
                let stdout = String::from_utf8_lossy(&o.stdout);
                let stderr = String::from_utf8_lossy(&o.stderr);
                format!("STDOUT:\n{}\nSTDERR:\n{}", stdout, stderr)
            }
            Err(e) => format!("Failed to get logs: {}", e),
        }
    }

    /// Stop the Docker container
    pub fn stop(&mut self) -> Result<()> {
        if self.container_id.is_some() {
            let _ = Command::new("docker")
                .args(["stop", CONTAINER_NAME])
                .output();
            let _ = Command::new("docker")
                .args(["rm", CONTAINER_NAME])
                .output();
            self.container_id = None;
        }
        Ok(())
    }

    /// Clean up orphan container from previous runs
    fn cleanup_orphan_container() {
        // Try to stop and remove any existing container with our name
        let _ = Command::new("docker")
            .args(["stop", CONTAINER_NAME])
            .output();
        let _ = Command::new("docker")
            .args(["rm", CONTAINER_NAME])
            .output();
    }

    /// Check if the Docker image exists locally
    fn image_exists(&self) -> Result<bool> {
        let output = Command::new("docker")
            .args(["images", "-q", DOCKER_IMAGE])
            .output()
            .context("Failed to check Docker images")?;

        Ok(!output.stdout.is_empty())
    }

    /// Pull the Docker image with visible progress
    fn pull_image(&self) -> Result<()> {
        use std::process::Stdio;

        let status = Command::new("docker")
            .args(["pull", DOCKER_IMAGE])
            .stdout(Stdio::inherit())
            .stderr(Stdio::inherit())
            .status()
            .context("Failed to pull Docker image")?;

        if !status.success() {
            anyhow::bail!("Failed to pull Docker image '{}'", DOCKER_IMAGE);
        }

        Ok(())
    }

    /// Get the API URL for the running container
    pub fn get_api_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.host_port)
    }

    /// Get the shared audio directory path
    pub fn get_shared_audio_dir(&self) -> &PathBuf {
        &self.shared_audio_dir
    }

    /// Convert a host file path to the corresponding container path
    pub fn host_to_container_path(&self, host_path: &std::path::Path) -> Result<String> {
        let file_name = host_path
            .file_name()
            .context("Invalid file path")?
            .to_string_lossy();
        Ok(format!("/audio/{}", file_name))
    }
}

impl Drop for GlmAsrContainer {
    fn drop(&mut self) {
        // Clean up container on drop
        if self.container_id.is_some() {
            let _ = Command::new("docker")
                .args(["stop", CONTAINER_NAME])
                .output();
            let _ = Command::new("docker")
                .args(["rm", CONTAINER_NAME])
                .output();
        }
    }
}
