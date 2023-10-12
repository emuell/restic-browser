use anyhow::anyhow;
use std::{collections::HashMap, fs, sync::RwLock};

use crate::restic::*;

// -------------------------------------------------------------------------------------------------

#[derive(Debug, Default)]
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
    // unwrap restic app and location from shared app state
    fn get_repository(&self) -> Result<(ResticCommand, Location), String> {
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
        Ok((state.restic.clone(), state.location.clone()))
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
    if let Ok(repository_file) = std::env::var("RESTIC_REPOSITORY_FILE") {
        let content = fs::read_to_string(repository_file.clone());
        if let Ok(content) = content {
            return Ok(content.trim().replace('\n', ""));
        } else {
            return Err(anyhow!("{repository_file} does not exist"));
        }
    }
    if let Ok(repository) = std::env::var("RESTIC_REPOSITORY") {
        Ok(repository)
    } else {
        Err(anyhow!("No repository set"))
    }
}

// defaultRepoPassword determines the default restic repository password from the environment.
fn default_repo_password() -> anyhow::Result<String> {
    if let Ok(password_file) = std::env::var("RESTIC_PASSWORD_FILE") {
        let content = fs::read_to_string(password_file.clone());
        if let Ok(content) = content {
            return Ok(content.trim().replace('\n', ""));
        } else {
            return Err(anyhow!("{password_file} does not exist"));
        }
    }
    if let Ok(repository) = std::env::var("RESTIC_PASSWORD") {
        Ok(repository)
    } else {
        Err(anyhow!("No repository password set"))
    }
}

// -------------------------------------------------------------------------------------------------

#[tauri::command()]
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
    location.prefix = "".into();
    for location_info in location_infos() {
        if location
            .path
            .starts_with((location_info.prefix.to_string() + ":").as_str())
        {
            location.prefix = location_info.prefix.into();
            location.path =
                location
                    .path
                    .replacen((location_info.prefix.to_string() + ":").as_str(), "", 1);
            for credential in location_info.credentials {
                location.credentials.push(EnvValue {
                    name: credential.to_string(),
                    value: std::env::var(credential).unwrap_or_default(),
                })
            }
            break;
        }
    }
    Ok(location)
}

#[tauri::command()]
pub fn open_file_or_url(path: String) -> Result<(), String> {
    open::that(path).map_err(|err| err.to_string())
}

#[tauri::command(async)]
pub fn open_repository(
    location: Location,
    app_state: tauri::State<SharedAppState>,
) -> Result<(), String> {
    app_state.update_location(location)
}

#[tauri::command(async)]
pub fn get_snapshots(app_state: tauri::State<SharedAppState>) -> Result<Vec<Snapshot>, String> {
    // get restic and location info from global app_state
    let (restic, location) = app_state.get_repository()?;
    // run command
    let command_output = restic
        .run(location, vec!["snapshots", "--json"])
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
    app_state: tauri::State<SharedAppState>,
) -> Result<Vec<File>, String> {
    // get restic and location info from global app_state
    let (restic, location) = app_state.get_repository()?;
    // run command
    let command_output = restic
        .run(location, vec!["ls", &snapshot_id, "--json", &path])
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
    _snapshot_id: String,
    _file: File,
    _app_state: tauri::State<SharedAppState>,
) -> Result<String, String> {
    Err("Not yet implemented".to_string())
}

#[tauri::command(async)]
pub fn dump_file_to_temp(
    _snapshot_id: String,
    _file: File,
    _app_state: tauri::State<SharedAppState>,
) -> Result<String, String> {
    Err("Not yet implemented".to_string())
}

#[tauri::command(async)]
pub fn restore_file(
    _snapshot_id: String,
    _file: File,
    _app_state: tauri::State<SharedAppState>,
) -> Result<String, String> {
    Err("Not yet implemented".to_string())
}
