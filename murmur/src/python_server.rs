//! Python GLM-ASR server management with uv for virtual environment

use anyhow::{Context, Result};
use std::io::Write;
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::time::Duration;

const SERVER_SCRIPT: &str = r#"#!/usr/bin/env python3
import os, sys, warnings
os.environ["HF_HUB_DISABLE_PROGRESS_BARS"] = "1"
os.environ["TRANSFORMERS_NO_ADVISORY_WARNINGS"] = "1"
warnings.filterwarnings("ignore")

import torch
from typing import List
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

model, processor, device = None, None, None
app = FastAPI()

class AudioUrlData(BaseModel):
    url: str

class ContentPart(BaseModel):
    type: str
    text: str | None = None
    audio_url: AudioUrlData | None = None

class Message(BaseModel):
    role: str
    content: List[ContentPart]

class ChatRequest(BaseModel):
    model: str
    messages: List[Message]
    max_tokens: int = 1024

class ResponseMessage(BaseModel):
    content: str

class Choice(BaseModel):
    message: ResponseMessage

class ChatResponse(BaseModel):
    choices: List[Choice]

class ModelInfo(BaseModel):
    id: str
    object: str = "model"

class ModelsResponse(BaseModel):
    data: List[ModelInfo]

def load_model():
    global model, processor, device
    if model is not None:
        return
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    from transformers import AutoModel, AutoProcessor
    repo_id = "zai-org/GLM-ASR-Nano-2512"
    processor = AutoProcessor.from_pretrained(repo_id, trust_remote_code=True)
    model = AutoModel.from_pretrained(repo_id, torch_dtype=torch.float32, trust_remote_code=True).to(device)

@app.get("/v1/models")
def list_models():
    return ModelsResponse(data=[ModelInfo(id="glm-asr")])

@app.post("/v1/chat/completions")
def chat_completions(request: ChatRequest):
    try:
        load_model()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to load model: {e}")

    audio_path, text_prompt = None, "Please transcribe this audio"
    for msg in request.messages:
        for part in msg.content:
            if part.type == "audio_url" and part.audio_url:
                audio_path = part.audio_url.url
            elif part.type == "text" and part.text:
                text_prompt = part.text
    if not audio_path:
        raise HTTPException(status_code=400, detail="No audio_url provided")
    if not os.path.isabs(audio_path):
        audio_path = os.path.abspath(audio_path)
    if not os.path.exists(audio_path):
        raise HTTPException(status_code=400, detail=f"Audio file not found: {audio_path}")

    messages = [{"role": "user", "content": [{"type": "audio", "url": audio_path}, {"type": "text", "text": text_prompt}]}]
    try:
        inputs = processor.apply_chat_template(messages, tokenize=True, add_generation_prompt=True, return_dict=True, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model.generate(**inputs, max_new_tokens=min(request.max_tokens, 2048), do_sample=False)
        transcription = processor.batch_decode(outputs[:, inputs["input_ids"].shape[1]:], skip_special_tokens=True)[0]
        return ChatResponse(choices=[Choice(message=ResponseMessage(content=transcription))])
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), log_level="warning")
"#;

const REQUIRED_PACKAGES: &[&str] = &[
    "torch",
    "git+https://github.com/huggingface/transformers",  // Need latest for glmasr
    "fastapi",
    "uvicorn",
    "soundfile",  // Required for audio loading
    "librosa",    // Required for audio resampling
];

/// Manages the Python GLM-ASR server process with uv virtual environment
pub struct PythonServer {
    process: Option<Child>,
    port: u16,
    script_path: PathBuf,
    venv_dir: PathBuf,
}

impl PythonServer {
    /// Create a new Python server manager
    pub fn new(port: u16) -> Result<Self> {
        let cache_dir = dirs::cache_dir()
            .unwrap_or_else(|| PathBuf::from("/tmp"))
            .join("murmur");

        let script_path = cache_dir.join("glm_asr_server.py");
        let venv_dir = cache_dir.join("venv");

        Ok(Self {
            process: None,
            port,
            script_path,
            venv_dir,
        })
    }

    /// Start the Python server
    pub fn start(&mut self) -> Result<()> {
        // Ensure cache directory exists
        if let Some(parent) = self.script_path.parent() {
            std::fs::create_dir_all(parent).context("Failed to create cache directory")?;
        }

        // Setup virtual environment with uv
        self.setup_venv()?;

        // Write the server script
        let mut file =
            std::fs::File::create(&self.script_path).context("Failed to create server script")?;
        file.write_all(SERVER_SCRIPT.as_bytes())
            .context("Failed to write server script")?;

        let python_path = self.get_python_path();
        let child = Command::new(&python_path)
            .arg(&self.script_path)
            .env("PORT", self.port.to_string())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .with_context(|| format!("Failed to start Python server with {}", python_path.display()))?;

        self.process = Some(child);
        Ok(())
    }

    /// Get the path to Python in the virtual environment
    fn get_python_path(&self) -> PathBuf {
        if cfg!(target_os = "windows") {
            self.venv_dir.join("Scripts").join("python.exe")
        } else {
            self.venv_dir.join("bin").join("python")
        }
    }

    /// Check if uv is available
    fn has_uv() -> bool {
        Command::new("uv")
            .arg("--version")
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Setup virtual environment and install dependencies
    fn setup_venv(&self) -> Result<()> {
        if !Self::has_uv() {
            anyhow::bail!(
                "uv is required but not found. Please install it:\n\
                 curl -LsSf https://astral.sh/uv/install.sh | sh\n\
                 Or visit: https://docs.astral.sh/uv/getting-started/installation/"
            );
        }

        // Check if venv exists and has required packages
        if self.venv_is_valid() {
            return Ok(());
        }

        println!("Setting up Python virtual environment...");

        // Create venv with uv
        let status = Command::new("uv")
            .args(["venv", "--python", "3.11"])
            .arg(&self.venv_dir)
            .status()
            .context("Failed to create virtual environment with uv")?;

        if !status.success() {
            anyhow::bail!("Failed to create virtual environment");
        }

        // Install required packages
        println!("Installing dependencies (this may take a while on first run)...");
        let status = Command::new("uv")
            .args(["pip", "install", "--python"])
            .arg(self.get_python_path())
            .args(REQUIRED_PACKAGES)
            .status()
            .context("Failed to install packages with uv")?;

        if !status.success() {
            anyhow::bail!("Failed to install required packages");
        }

        println!("Python environment ready.");
        Ok(())
    }

    /// Check if existing venv has all required packages
    fn venv_is_valid(&self) -> bool {
        let python_path = self.get_python_path();
        if !python_path.exists() {
            return false;
        }

        // Check if all required packages are importable
        // Map package specs to import names (git URLs -> package name)
        let import_names = ["torch", "transformers", "fastapi", "uvicorn", "soundfile", "librosa"];
        let import_check = import_names
            .iter()
            .map(|p| format!("import {}", p))
            .collect::<Vec<_>>()
            .join("; ");

        Command::new(&python_path)
            .args(["-c", &import_check])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    /// Wait until the server is ready
    pub async fn wait_until_ready(&self, timeout: Duration) -> Result<()> {
        let client = reqwest::Client::new();
        let url = format!("{}/v1/models", self.get_api_url());
        let start = std::time::Instant::now();

        // Give the server a moment to start
        tokio::time::sleep(Duration::from_millis(500)).await;

        loop {
            if start.elapsed() > timeout {
                anyhow::bail!(
                    "GLM ASR Python server did not start within {} seconds.",
                    timeout.as_secs()
                );
            }

            match client.get(&url).send().await {
                Ok(response) if response.status().is_success() => {
                    return Ok(());
                }
                _ => {
                    tokio::time::sleep(Duration::from_secs(1)).await;
                }
            }
        }
    }

    /// Stop the Python server
    pub fn stop(&mut self) -> Result<()> {
        if let Some(ref mut child) = self.process {
            let _ = child.kill();
            let _ = child.wait();
            self.process = None;
        }

        // Clean up script file (keep venv for reuse)
        let _ = std::fs::remove_file(&self.script_path);

        Ok(())
    }

    /// Get the API URL
    pub fn get_api_url(&self) -> String {
        format!("http://127.0.0.1:{}", self.port)
    }
}

impl Drop for PythonServer {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}
