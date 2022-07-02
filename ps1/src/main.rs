use std::collections::HashMap;
use std::env;
use std::thread;
use std::sync::mpsc;
use std::time::Duration;

use git2::Repository;


const SHORT_PATH_TRUNCATE: u8 = 3;
const GIT_TIMEOUT: u16 = 150;

const START_BRACKET: &str = "{";
const END_BRACKET: &str = "}";
const GIT_UNCOMMITED: &str = "+";
const GIT_UNSTAGED: &str = "!";
const GIT_UNTRACKED: &str = "?";
const GIT_STASHED: &str = "¥";
const VENV_INDICATOR: &str = "∇";
const BRANCH_TRUNCATION: &str = "⁁";


fn colorize(text: &str, color: &str) -> String {
    let colors = HashMap::from([
        ("PWD_DELETED", 178),
        ("CMD_EXIT_0_COLOR", 34),
        ("CMD_EXIT_NON0_COLOR", 124),
        ("CURRENT_PATH_COLOR", 33),
        ("SHORT_PATH_COLOR", 15),
        ("GIT_BRANCH_COLOR", 166),
        ("GIT_STATUS_COLOR", 136),
        ("VENV_COLOR", 166),
    ]);
    let color = colors.get(color).unwrap();
    format!("\x5c\x5b\x1b[38;5;{}m\x5c\x5d{}", color, text)
}

fn get_last_color() -> &'static str {
    match env::current_dir(){
        Err(_) => return "PWD_DELETED",
        _ => (),
    }

    let args: Vec<String> = env::args().collect();

	if args.len() == 1 || args[1] == "0" {
		"CMD_EXIT_0_COLOR"
	}else{
        "CMD_EXIT_NON0_COLOR"
    }
}

// add indicator for venv setup
fn venv_prompt() -> &'static str {
    match env::var("VIRTUAL_ENV") {
        Ok(val) => {
            if !env!("PATH").contains(&val) {
                VENV_INDICATOR
            }else{
                ""
            }
        },
        Err(_e) => "",
    }
}

// cwd_prompt would output the current path, with intermediate path truncated. Example:
//    /usr/local/lib/python2.7/site-packages -> /usr/loc/lib/pyt/site-packages
fn cwd_prompt() -> String {
    let dir = get_cwd().replacen(env!("HOME"), "~", 1);
    let mut paths: Vec<String> = dir.split("/").map(|e| e.to_string()).collect::<Vec<String>>();
    let segments = paths.len();
    for (i, path) in paths.iter_mut().enumerate() {
        // Don't change short path, don't change last segment.
        if path.len() < SHORT_PATH_TRUNCATE.into() || i == segments - 1 {
            continue
        }
        let mut truncate = SHORT_PATH_TRUNCATE;
        if path.starts_with(".") {
            truncate += 1;
        }
        path.truncate(truncate.into());
    }
    return if paths.len() == 1 {
        paths[0].to_string()
    }else{
        format!(
            "{short_path}/{current_path}",
            short_path=colorize(&paths[..segments-1].join("/"), "SHORT_PATH_COLOR"),
            current_path=colorize(paths.last().unwrap(), "CURRENT_PATH_COLOR"),
        )
    }
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

    for entry in repo.statuses(Some(&mut opts)).unwrap().iter() {
        let status = entry.status();
        if status.is_index_modified() || status.is_index_new() || status.is_index_deleted() || status.is_index_renamed() || status.is_index_typechange(){
            has_uncommited = true;
        }
        if status.is_wt_new(){
            has_untracked = true;
        }
        if status.is_wt_modified(){
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
            let branch = reference.shorthand().unwrap();
            match branch {
                "master" => "🏠".to_string(),
                "main" => "🏠".to_string(),
                _ => {
                    let mut name = branch.replacen("feature/", "🔨/", 1)
                        .replacen("bugfix/", "🐛/", 1)
                        .replacen("bug/", "🐛/", 1)
                        .replacen("fix/", "🐛/", 1);
                    if name.len() > 15 {
                        name.replace_range(12..(name.len() - 3), BRANCH_TRUNCATION);
                        name
                    }else{
                        name
                    }
                },
            }
        },
    }
}

fn get_cwd() -> String {
    let current_dir = env::current_dir();
    match current_dir {
        Ok(current_dir) => current_dir.display().to_string(),
        Err(_) => env::var("PWD").unwrap(),
    }
}

fn main() {
    let last_color = get_last_color();
    let (sender, receiver) = mpsc::channel();
    let cwd_sender = sender.clone();

    let mut has_git: bool = false;
    let mut git_branch: String = "".to_string();
    let mut git_st: String = "".to_string();

    let mut cwd: String = "".to_string();
    let mut threads = 1;

    // Spawning threads to do the heavy-lifting.
    thread::spawn(move || {cwd_sender.send(format!("cwd:{}", cwd_prompt())).unwrap();});

    match Repository::discover(get_cwd()) {
        Err(_e) => {},
        Ok(repo) => {
            has_git = true;
            threads += 1;
            let git_sender = sender.clone();
            git_branch = get_git_branch(&repo);

            thread::spawn(move|| {
                let result = get_git_st(&repo).unwrap();
                git_sender.send(format!("git-st:{}", result)).unwrap();
            });
        },
    };

    for _ in 0..threads {
        match receiver.recv_timeout(Duration::from_millis(GIT_TIMEOUT.into())) {
            Ok(val) => {
                let split: Vec<&str> = val.splitn(2, ":").collect();
                match split[0] {
                    "git-st" => git_st = split[1].to_string(),
                    "cwd" => cwd = split[1].to_string(),
                    _ => panic!("Unknown message"),
                }
            },
            Err(mpsc::RecvTimeoutError::Timeout) => {},
            Err(_) => panic!("Unknown error."),
        }
    };

    let git_prompt = if has_git {
        format!(
            "{}{} ",
            colorize(&git_branch, "GIT_BRANCH_COLOR"), colorize(&git_st, "GIT_STATUS_COLOR")
        )
    }else{
        "".to_string()
    };

    println!(
        "{start_bracket}{venv}{git}{cwd}{end_bracket}\x5c\x5b\x1b[0m\x5c\x5d",
        venv=colorize(venv_prompt(), "VENV_COLOR"),
        start_bracket=colorize(START_BRACKET, last_color),
        end_bracket=colorize(END_BRACKET, last_color),
        git=git_prompt,
        cwd=cwd,
    );
}
