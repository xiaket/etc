use std::env;
use std::thread;
use std::sync::mpsc;
use std::time::Duration;

use ansi_term::Colour;
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

const CMD_EXIT_0_COLOR: Colour = Colour::Fixed(34);
const CMD_EXIT_NON0_COLOR: Colour = Colour::Fixed(124);
const CURRENT_PATH_COLOR: Colour = Colour::Fixed(33);
const SHORT_PATH_COLOR: Colour = Colour::Fixed(15);
const GIT_BRANCH_COLOR: Colour = Colour::Fixed(166);
const GIT_STATUS_COLOR: Colour = Colour::Fixed(136);
const VENV_COLOR: Colour = Colour::Fixed(166);


fn get_last_color() -> Colour {
    let args: Vec<String> = env::args().collect();
	if args.len() == 1 || args[1] == "0" {
		CMD_EXIT_0_COLOR
	}else{
        CMD_EXIT_NON0_COLOR
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
    let dir = std::env::current_dir().unwrap().to_str().unwrap().replacen(env!("HOME"), "~", 1);
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
            short_path=SHORT_PATH_COLOR.paint(paths[..segments-1].join("/")).to_string(),
            current_path=CURRENT_PATH_COLOR.paint(paths.last().unwrap()),
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

    match Repository::discover(std::env::current_dir().unwrap()) {
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
            GIT_BRANCH_COLOR.paint(git_branch), GIT_STATUS_COLOR.paint(git_st)
        )
    }else{
        "".to_string()
    };

    println!(
        "{start_bracket}{venv}{git}{cwd}{end_bracket}",
        venv=VENV_COLOR.paint(venv_prompt()),
        start_bracket=last_color.paint(START_BRACKET),
        end_bracket=last_color.paint(END_BRACKET),
        git=git_prompt,
        cwd=cwd,
    );
}
