use std::{collections::HashSet, env, fs, path, sync::RwLock};

use anyhow::anyhow;
use tauri::api::dialog::blocking::{ask, FileDialogBuilder, MessageDialogBuilder};

use crate::restic::*;

// -------------------------------------------------------------------------------------------------

// internal app state
#[derive(Debug, Default, Clone)]
pub struct AppState {
    restic: ResticCommand,
    location: Location,
    snapshot_ids: HashSet<String>,
    temp_dir: String,
}

impl AppState {
    pub fn new(restic: ResticCommand, location: Location, temp_dir: &str) -> Self {
        let snapshot_ids = HashSet::default();
        let temp_dir = temp_dir.to_owned();
        Self {
            restic,
            location,
            snapshot_ids,
            temp_dir,
        }
    }

    pub fn temp_dir(&self) -> &str {
        &self.temp_dir
    }

    pub fn verify_restic_path(&self) -> Result<(), String> {
        if self.restic.path.is_empty() {
            return Err("No restic executable set".to_string());
        } else if !path::Path::new(&self.restic.path).exists() {
            return Err(format!(
                "Restic executable '{}' does not exist or can not be accessed.",
                self.restic.path
            ));
        } else if self.restic.version == [0, 0, 0] {
            return Err(format!(
                "Failed to query restic version. Is '{}' a valid restic application?",
                self.restic.path
            ));
        }
        Ok(())
    }

    pub fn verify_location(&self) -> Result<(), String> {
        if self.location.path.is_empty() {
            return Err("No repository set".to_string());
        }
        Ok(())
    }

    pub fn verify_snapshot(&self, snapshot_id: &str) -> Result<(), String> {
        self.snapshot_ids
            .get(snapshot_id)
            .ok_or(format!("Can't resolve snapshot with id {snapshot_id}"))?;
        Ok(())
    }
}

// send + sync app state as passed to taury
pub struct SharedAppState {
    state: RwLock<AppState>,
}

impl SharedAppState {
    // create a new shared app state from an "unshared" app state
    pub fn new(app_state: AppState) -> Self {
        Self {
            state: RwLock::new(app_state),
        }
    }

    // return a copy of the current app state
    pub fn get(&self) -> Result<AppState, String> {
        let state = self
            .state
            .try_read()
            .map_err(|err| format!("Failed to query app state: {err}"))?;
        Ok(state.clone())
    }

    // update restic property in the shared app state
    fn update_restic(&self, restic: ResticCommand) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to query app state: {err}"))?
            .restic = restic;
        Ok(())
    }

    // update location property in the shared app state
    fn update_location(&self, location: Location) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to query app state: {err}"))?
            .location = location;
        Ok(())
    }

    // update snapshot_ids property in the shared app state
    fn update_snapshot_ids(&self, snapshot_ids: HashSet<String>) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to query app state: {err}"))?
            .snapshot_ids = snapshot_ids;
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
    // read default location from env
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

// -------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn verify_restic_path(
    app_state: tauri::State<SharedAppState>,
    _app_window: tauri::Window,
) -> Result<(), String> {
    // verify that restic binary is set
    let state = app_state.get()?;
    if state.restic.path.is_empty() {
        // aks user to reolve restic path
        MessageDialogBuilder::new(
            "Restic Binary Missing",
            "Failed to find restic program in your $PATH\n
Please select your installed restic binary manually in the following dialog.",
        )
        .show();
        let restic_path = FileDialogBuilder::new()
            // freezes on Windows .set_parent(&app_window)
            .set_title("Locate restic program")
            .set_file_name(RESTIC_EXECTUABLE_NAME)
            .pick_file();
        log::warn!(
            "Got restic binary path {}",
            restic_path.clone().unwrap_or_default().display()
        );
        if let Some(restic_path) = restic_path {
            app_state.update_restic(ResticCommand::new(restic_path.to_string_lossy().as_ref()))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_repository(
    location: Location,
    app_state: tauri::State<SharedAppState>,
) -> Result<(), String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    // update location in app state
    app_state.update_location(location)
}

#[tauri::command(async)]
pub fn get_snapshots(app_state: tauri::State<SharedAppState>) -> Result<Vec<Snapshot>, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    // run command
    let command_output = state
        .restic
        .run(state.location, vec!["snapshots", "--json"])
        .map_err(|err| err.to_string())?;
    let snapshots =
        serde_json::from_str::<Vec<Snapshot>>(&command_output).map_err(|err| err.to_string())?;
    // update snapshot cache
    let mut snapshot_ids = HashSet::new();
    snapshots.iter().for_each(|v| {
        snapshot_ids.insert(v.id.clone());
    });
    app_state.update_snapshot_ids(snapshot_ids)?;
    // return snapshots
    Ok(snapshots)
}

#[tauri::command(async)]
pub fn get_files(
    snapshot_id: String,
    path: String,
    app_state: tauri::State<SharedAppState>,
) -> Result<Vec<File>, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
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
    app_state: tauri::State<SharedAppState>,
    app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
    // set target dir
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
    // run dump command
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
    app_state: tauri::State<SharedAppState>,
    _app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
    // set target file name
    let target_folder = state.temp_dir();
    let target_file_name = if file.type_ == "dir" {
        path::Path::new(target_folder).join(file.name + ".zip")
    } else {
        path::Path::new(target_folder).join(file.name)
    };
    let target_file = fs::File::create(target_file_name.clone())
        .map_err(|err| format!("Failed to create target file: {err}"))?;
    // run dump command
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
    app_state: tauri::State<SharedAppState>,
    app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
    // set target dir
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
