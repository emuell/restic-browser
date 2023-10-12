use std::{collections::HashMap, env, fs, path, sync::RwLock};

use anyhow::anyhow;
use tauri::api::dialog::blocking::{ask, FileDialogBuilder};

use crate::restic::*;

// -------------------------------------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct AppState {
    restic: ResticCommand,
    location: Location,
    snapshot_cache: HashMap<String, Snapshot>,
}

impl AppState {
    pub fn new(restic_path: &str) -> Self {
        Self {
            restic: ResticCommand::new(restic_path),
            location: Location::default(),
            snapshot_cache: HashMap::default(),
        }
    }
}

pub struct SharedAppState(pub RwLock<AppState>);

impl SharedAppState {
    // unwrap and return a copy of the current app state
    fn get(&self) -> Result<AppState, String> {
        let state = self
            .0
            .try_read()
            .map_err(|err| format!("Failed to query app state: {err}"))?;
        if state.restic.path.is_empty() {
            return Err("No restic binary set".to_string());
        }
        if state.location.path.is_empty() {
            return Err("No repository set".to_string());
        }
        Ok(state.clone())
    }

    fn update_location(&self, location: Location) -> Result<(), String> {
        self.0
            .try_write()
            .map_err(|err| format!("Failed to query app state: {err}"))?
            .location = location;
        Ok(())
    }

    fn update_snapshot_cache(&self, snapshots: HashMap<String, Snapshot>) -> Result<(), String> {
        self.0
            .try_write()
            .map_err(|err| format!("Failed to query app state: {err}"))?
            .snapshot_cache = snapshots;
        Ok(())
    }
}

// -------------------------------------------------------------------------------------------------

struct LocationInfo<'a> {
    prefix: &'a str,
    credentials: Vec<&'a str>,
}

fn location_infos() -> Vec<LocationInfo<'static>> {
    vec![
        LocationInfo {
            prefix: "bs",
            credentials: vec![],
        },
        LocationInfo {
            prefix: "sftp",
            credentials: vec![],
        },
        LocationInfo {
            prefix: "rest",
            credentials: vec![],
        },
        LocationInfo {
            prefix: "rclone",
            credentials: vec![],
        },
        LocationInfo {
            prefix: "s3",
            credentials: vec!["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
        },
        LocationInfo {
            prefix: "b2",
            credentials: vec!["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"],
        },
        LocationInfo {
            prefix: "azure",
            credentials: vec!["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"],
        },
    ]
}

// defaultRepo determines the default restic repository location from the environment.
fn default_repo() -> anyhow::Result<String> {
    if let Ok(repository_file) = env::var("RESTIC_REPOSITORY_FILE") {
        let content = fs::read_to_string(repository_file.clone());
        if let Ok(content) = content {
            return Ok(content.trim().replace('\n', ""));
        } else {
            return Err(anyhow!("{repository_file} does not exist"));
        }
    }
    if let Ok(repository) = env::var("RESTIC_REPOSITORY") {
        Ok(repository)
    } else {
        Err(anyhow!("No repository set"))
    }
}

// defaultRepoPassword determines the default restic repository password from the environment.
fn default_repo_password() -> anyhow::Result<String> {
    if let Ok(password_file) = env::var("RESTIC_PASSWORD_FILE") {
        let content = fs::read_to_string(password_file.clone());
        if let Ok(content) = content {
            return Ok(content.trim().replace('\n', ""));
        } else {
            return Err(anyhow!("{password_file} does not exist"));
        }
    }
    if let Ok(repository) = env::var("RESTIC_PASSWORD") {
        Ok(repository)
    } else {
        Err(anyhow!("No repository password set"))
    }
}

// -------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn default_repo_location() -> Result<Location, String> {
    let mut location = Location {
        path: default_repo().unwrap_or_default(),
        password: default_repo_password().unwrap_or_default(),
        credentials: vec![],
        prefix: "".to_string(),
    };
    if location.path.is_empty() {
        // skip reading other location info when no repo is present
        return Ok(location);
    }
    location.prefix = "".to_string();
    for location_info in location_infos() {
        if location
            .path
            .starts_with(&(location_info.prefix.to_string() + ":"))
        {
            location.prefix = location_info.prefix.to_string();
            location.path =
                location
                    .path
                    .replacen(&(location_info.prefix.to_string() + ":"), "", 1);
            for credential in location_info.credentials {
                location.credentials.push(EnvValue {
                    name: credential.to_string(),
                    value: env::var(credential).unwrap_or_default(),
                })
            }
            break;
        }
    }
    Ok(location)
}

#[tauri::command]
pub fn open_file_or_url(path: String) -> Result<(), String> {
    open::that(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn open_repository(
    location: Location,
    app_state: tauri::State<SharedAppState>,
) -> Result<(), String> {
    app_state.update_location(location)
}

#[tauri::command(async)]
pub fn get_snapshots(app_state: tauri::State<'_, SharedAppState>) -> Result<Vec<Snapshot>, String> {
    // unwrap app state
    let state = app_state.get()?;
    // run command
    let command_output = state
        .restic
        .run(state.location, vec!["snapshots", "--json"])
        .map_err(|err| err.to_string())?;
    let snapshots =
        serde_json::from_str::<Vec<Snapshot>>(&command_output).map_err(|err| err.to_string())?;
    // update snapshot cache
    let mut snapshot_cache = HashMap::new();
    snapshots.iter().for_each(|v| {
        snapshot_cache.insert(v.id.clone(), v.clone());
    });
    app_state.update_snapshot_cache(snapshot_cache)?;
    // return snapshots
    Ok(snapshots)
}

#[tauri::command(async)]
pub fn get_files(
    snapshot_id: String,
    path: String,
    app_state: tauri::State<'_, SharedAppState>,
) -> Result<Vec<File>, String> {
    // unwrap app state
    let state = app_state.get()?;
    // run command
    let command_output = state
        .restic
        .run(state.location, vec!["ls", &snapshot_id, "--json", &path])
        .map_err(|err| err.to_string())?;
    let mut files = vec![];
    for line in command_output.split('\n').skip(1) {
        if line.is_empty() || !line.starts_with('{') {
            // Skip first/blank/malformed lines
            continue;
        }
        let file = serde_json::from_str::<File>(line).map_err(|err| err.to_string())?;
        files.push(file);
    }
    Ok(files)
}

#[tauri::command(async)]
pub fn dump_file(
    snapshot_id: String,
    file: File,
    app_state: tauri::State<'_, SharedAppState>,
    app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state
        .snapshot_cache
        .get(&snapshot_id)
        .ok_or(format!("Can't resolve snapshot with id {snapshot_id}"))?;
    // ask for target dir
    let folder = FileDialogBuilder::new()
        .set_title("Please select a target directory")
        .set_parent(&app_window)
        .pick_folder();
    if folder.is_none() {
        // user cancelled dialog
        return Ok("".to_string());
    }
    let target_folder = folder.unwrap();
    let target_file_name = if file.type_ == "dir" {
        path::Path::new(&target_folder).join(file.name + ".zip")
    } else {
        path::Path::new(&target_folder).join(file.name)
    };
    // confirm overwriting
    if target_file_name.exists() {
        let confirmed = ask(
            Some(&app_window),
            "Overwrite existing file?",
            format!(
                "The target file '{}' already exists.\n
Are you sure that you want to overwrite the existing file?",
                target_file_name.display()
            ),
        );
        if !confirmed {
            return Err(format!(
                "target file '{}' already exists",
                target_file_name.display()
            ));
        }
        fs::remove_file(target_file_name.clone())
            .map_err(|err| format!("Failed to remove target file: {err}"))?;
    }
    let target_file = fs::File::create(target_file_name.clone())
        .map_err(|err| format!("Failed to create target file: {err}"))?;
    state
        .restic
        .run_redirected(
            state.location,
            vec!["dump", "-a", "zip", &snapshot_id, &file.path],
            target_file,
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn dump_file_to_temp(
    snapshot_id: String,
    file: File,
    app_state: tauri::State<'_, SharedAppState>,
    _app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state
        .snapshot_cache
        .get(&snapshot_id)
        .ok_or(format!("Can't resolve snapshot with id {snapshot_id}"))?;
    let target_folder = env::temp_dir();
    let target_file_name = if file.type_ == "dir" {
        path::Path::new(&target_folder).join(file.name + ".zip")
    } else {
        path::Path::new(&target_folder).join(file.name)
    };
    let target_file = fs::File::create(target_file_name.clone())
        .map_err(|err| format!("Failed to create target file: {err}"))?;
    state
        .restic
        .run_redirected(
            state.location,
            vec!["dump", "-a", "zip", &snapshot_id, &file.path],
            target_file,
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn restore_file(
    snapshot_id: String,
    file: File,
    app_state: tauri::State<'_, SharedAppState>,
    app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state
        .snapshot_cache
        .get(&snapshot_id)
        .ok_or(format!("Can't resolve snapshot with id {snapshot_id}"))?;
    // ask for target dir
    let folder = FileDialogBuilder::new()
        .set_title("Please select a target directory")
        .set_parent(&app_window)
        .pick_folder();
    if folder.is_none() {
        // user cancelled dialog
        return Ok("".to_string());
    }
    let target_folder = folder.unwrap();
    let target_file_name = path::Path::new(&target_folder).join(file.name);
    if target_file_name.exists() {
        // confirm overwriting
        let confirmed = ask(
            Some(&app_window),
            "Overwrite existing directory or file?",
            format!(
                "The target directory or file '{}' already exists.\n
Are you sure that you want to overwrite the existing file(s)?",
                target_file_name.display()
            ),
        );
        if !confirmed {
            return Err(format!(
                "target file or directory '{}' already exists",
                target_file_name.display()
            ));
        }
    }
    // run restore command
    state
        .restic
        .run(
            state.location,
            vec![
                "restore",
                &snapshot_id,
                "--target",
                &target_file_name.to_string_lossy(),
                "--include",
                &file.path,
            ],
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}
