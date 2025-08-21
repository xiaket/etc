use std::env;
use std::sync::mpsc;
use std::thread;
use std::time::Duration;

use git2::Repository;

// Configuration constants
const SHORT_PATH_TRUNCATE: u8 = 3;
const GIT_TIMEOUT_MS: u64 = 150;
const BRANCH_MAX_LENGTH: usize = 15;
const BRANCH_TRUNCATE_START: usize = 12;

// Symbol constants
const START_BRACKET: &str = "{";
const END_BRACKET: &str = "}";
const GIT_UNCOMMITED: &str = "+";
const GIT_UNSTAGED: &str = "!";
const GIT_UNTRACKED: &str = "?";
const GIT_STASHED: &str = "¥";
const VENV_INDICATOR: &str = "∇";
const BRANCH_TRUNCATION: &str = "⁁";

// Color constants
const COLOR_PWD_DELETED: u16 = 178;
const COLOR_CMD_EXIT_0: u16 = 34;
const COLOR_CMD_EXIT_NON_0: u16 = 124;
const COLOR_CURRENT_PATH: u16 = 33;
const COLOR_SHORT_PATH: u16 = 15;
const COLOR_GIT_BRANCH: u16 = 166;
const COLOR_GIT_STATUS: u16 = 136;
const COLOR_VENV: u16 = 166;
const COLOR_DEFAULT: u16 = 15;

fn colorize(text: &str, color_name: &str) -> String {
    let color_code = match color_name {
        "PWD_DELETED" => COLOR_PWD_DELETED,
        "CMD_EXIT_0_COLOR" => COLOR_CMD_EXIT_0,
        "CMD_EXIT_NON0_COLOR" => COLOR_CMD_EXIT_NON_0,
        "CURRENT_PATH_COLOR" => COLOR_CURRENT_PATH,
        "SHORT_PATH_COLOR" => COLOR_SHORT_PATH,
        "GIT_BRANCH_COLOR" => COLOR_GIT_BRANCH,
        "GIT_STATUS_COLOR" => COLOR_GIT_STATUS,
        "VENV_COLOR" => COLOR_VENV,
        _ => COLOR_DEFAULT,
    };
    format!("\x5c\x5b\x1b[38;5;{}m\x5c\x5d{}", color_code, text)
}

fn get_last_color() -> &'static str {
    match env::current_dir() {
        Err(_) => return "PWD_DELETED",
        _ => (),
    }

    let args: Vec<String> = env::args().collect();

    if args.len() == 1 || args[1] == "0" {
        "CMD_EXIT_0_COLOR"
    } else {
        "CMD_EXIT_NON0_COLOR"
    }
}

// add indicator for venv setup
fn venv_prompt() -> &'static str {
    match env::var("VIRTUAL_ENV") {
        Ok(val) => {
            if !env!("PATH").contains(&val) {
                VENV_INDICATOR
            } else {
                ""
            }
        }
        Err(_e) => "",
    }
}

// cwd_prompt would output the current path, with intermediate path truncated. Example:
//    /usr/local/lib/python2.7/site-packages -> /usr/loc/lib/pyt/site-packages
fn cwd_prompt() -> String {
    let dir = get_cwd().replacen(env!("HOME"), "~", 1);
    let mut paths: Vec<String> = dir
        .split("/")
        .map(|e| e.to_string())
        .collect::<Vec<String>>();
    let segments = paths.len();
    for (i, path) in paths.iter_mut().enumerate() {
        // Don't change short path, don't change last segment.
        if path.len() < SHORT_PATH_TRUNCATE.into() || i == segments - 1 {
            continue;
        }
        let mut truncate = SHORT_PATH_TRUNCATE;
        if path.starts_with(".") {
            truncate += 1;
        }
        path.truncate(truncate.into());
    }
    return if paths.len() == 1 {
        paths[0].to_string()
    } else {
        format!(
            "{short_path}/{current_path}",
            short_path = colorize(&paths[..segments - 1].join("/"), "SHORT_PATH_COLOR"),
            current_path = colorize(paths.last().unwrap_or(&String::new()), "CURRENT_PATH_COLOR"),
        )
    };
}

// git_st will combine GitSt and BranchName and provide git info for prompt.
fn get_git_st(repo: &Repository) -> Result<String, mpsc::RecvTimeoutError> {
    let mut has_uncommited = false;
    let mut has_unstaged = false;
    let mut has_untracked = false;

    let mut opts = git2::StatusOptions::new();
    opts.exclude_submodules(true);
    opts.include_ignored(false);
    opts.include_untracked(true);
    opts.renames_head_to_index(true);

    let statuses = match repo.statuses(Some(&mut opts)) {
        Ok(statuses) => statuses,
        Err(_) => return Ok(String::new()),
    };

    for entry in statuses.iter() {
        let status = entry.status();
        if status.is_index_modified()
            || status.is_index_new()
            || status.is_index_deleted()
            || status.is_index_renamed()
            || status.is_index_typechange()
        {
            has_uncommited = true;
        }
        if status.is_wt_new() {
            has_untracked = true;
        }
        if status.is_wt_modified() {
            has_unstaged = true;
        }
    }
    let mut status = "".to_string();
    if has_uncommited {
        status.push_str(GIT_UNCOMMITED)
    }
    if has_untracked {
        status.push_str(GIT_UNTRACKED)
    }
    if has_unstaged {
        status.push_str(GIT_UNSTAGED)
    }
    if repo.path().join("refs/stash").exists() {
        status.push_str(GIT_STASHED)
    }

    Ok(status.to_string())
}

fn get_git_branch(repo: &Repository) -> String {
    return match repo.head() {
        Err(_) => "Unknown".to_string(),
        Ok(reference) => {
            let branch = reference.shorthand().unwrap_or("Unknown");
            match branch {
                "master" => "🏠".to_string(),
                "main" => "🏠".to_string(),
                _ => {
                    let mut name = branch
                        .replacen("feature/", "🔨/", 1)
                        .replacen("bugfix/", "🐛/", 1)
                        .replacen("bug/", "🐛/", 1)
                        .replacen("fix/", "🐛/", 1);
                    if name.len() > BRANCH_MAX_LENGTH {
                        let truncate_start = BRANCH_TRUNCATE_START.min(name.len() - 3);
                        name.replace_range(truncate_start..(name.len() - 3), BRANCH_TRUNCATION);
                    }
                    name
                }
            }
        }
    };
}

fn get_cwd() -> String {
    let current_dir = env::current_dir();
    match current_dir {
        Ok(current_dir) => current_dir.display().to_string(),
        Err(_) => env::var("PWD").unwrap_or_else(|_| "unknown".to_string()),
    }
}

fn main() {
    let last_color = get_last_color();
    let (sender, receiver) = mpsc::channel();

    let mut has_git = false;
    let mut git_branch = String::new();
    let mut git_st = String::new();
    let mut cwd = String::new();

    // Spawn cwd thread
    let cwd_sender = sender.clone();
    thread::spawn(move || {
        if let Err(e) = cwd_sender.send(format!("cwd:{}", cwd_prompt())) {
            eprintln!("Failed to send cwd: {}", e);
        }
    });

    // Handle git repository discovery
    let mut repo_option = None;
    if let Ok(repo) = Repository::discover(get_cwd()) {
        has_git = true;
        git_branch = get_git_branch(&repo);

        // Get git status in the main thread to avoid Repository cloning issues
        let git_status = get_git_st(&repo).unwrap_or_default();
        if let Err(e) = sender.send(format!("git-st:{}", git_status)) {
            eprintln!("Failed to send git status: {}", e);
        }

        repo_option = Some(repo);
    }

    // Collect results with timeout
    let expected_messages = if has_git { 2 } else { 1 };
    for _ in 0..expected_messages {
        match receiver.recv_timeout(Duration::from_millis(GIT_TIMEOUT_MS)) {
            Ok(val) => {
                if let Some((msg_type, content)) = val.split_once(':') {
                    match msg_type {
                        "git-st" => git_st = content.to_string(),
                        "cwd" => cwd = content.to_string(),
                        _ => eprintln!("Unknown message type: {}", msg_type),
                    }
                }
            }
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(e) => eprintln!("Channel error: {}", e),
        }
    }

    // Clean up repository resources explicitly
    drop(repo_option);

    let git_prompt = if has_git {
        format!(
            "{}{} ",
            colorize(&git_branch, "GIT_BRANCH_COLOR"),
            colorize(&git_st, "GIT_STATUS_COLOR")
        )
    } else {
        "".to_string()
    };

    println!(
        "{start_bracket}{venv}{git}{cwd}{end_bracket}\x5c\x5b\x1b[0m\x5c\x5d",
        venv = colorize(venv_prompt(), "VENV_COLOR"),
        start_bracket = colorize(START_BRACKET, last_color),
        end_bracket = colorize(END_BRACKET, last_color),
        git = git_prompt,
        cwd = cwd,
    );
}
