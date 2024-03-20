use std::{collections::HashSet, fs, path::PathBuf, sync::RwLock};

use tauri::api::dialog::blocking::{ask, FileDialogBuilder, MessageDialogBuilder};

use crate::restic::{self};

// -------------------------------------------------------------------------------------------------

/// Internal app state.
#[derive(Debug, Default, Clone)]
pub struct AppState {
    restic: restic::Program,
    location: restic::Location,
    snapshot_ids: HashSet<String>,
    temp_dir: PathBuf,
}

impl AppState {
    pub fn new(restic: restic::Program, location: restic::Location, temp_dir: PathBuf) -> Self {
        let snapshot_ids = HashSet::default();
        Self {
            restic,
            location,
            snapshot_ids,
            temp_dir,
        }
    }

    pub fn temp_dir(&self) -> &PathBuf {
        &self.temp_dir
    }

    pub fn verify_restic_path(&self) -> Result<(), String> {
        if self.restic.restic_path().as_os_str().is_empty() {
            return Err("No restic executable set".to_string());
        } else if !self.restic.restic_path().exists() {
            return Err(format!(
                "Restic executable '{}' does not exist or can not be accessed.",
                self.restic.restic_path().to_string_lossy()
            ));
        } else if self.restic.restic_version() == [0, 0, 0] {
            return Err(format!(
                "Failed to query restic version. Is '{}' a valid restic application?",
                self.restic.restic_path().to_string_lossy()
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

// -------------------------------------------------------------------------------------------------

/// Send + sync app state, as held and passed by tauri.
pub struct SharedAppState {
    state: RwLock<AppState>,
}

impl SharedAppState {
    /// Create a new shared app state from an "unshared" app state.
    pub fn new(app_state: AppState) -> Self {
        Self {
            state: RwLock::new(app_state),
        }
    }

    /// return a copy of the current app state.
    pub fn get(&self) -> Result<AppState, String> {
        let state = self
            .state
            .try_read()
            .map_err(|err| format!("Failed to query app state: {err}"))?;
        Ok(state.clone())
    }

    /// update `restic` property in the shared app state.
    fn update_restic(&self, restic: restic::Program) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to update app state: {err}"))?
            .restic = restic;
        Ok(())
    }

    /// update `location` property in the shared app state.
    fn update_location(&self, location: restic::Location) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to update app state: {err}"))?
            .location = location;
        Ok(())
    }

    /// update `snapshot_ids` property in the shared app state.
    fn update_snapshot_ids(&self, snapshot_ids: HashSet<String>) -> Result<(), String> {
        self.state
            .try_write()
            .map_err(|err| format!("Failed to update app state: {err}"))?
            .snapshot_ids = snapshot_ids;
        Ok(())
    }
}

// -------------------------------------------------------------------------------------------------

#[tauri::command]
pub fn open_file_or_url(path: String) -> Result<(), String> {
    open::that(path).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn supported_repo_location_types() -> Result<Vec<restic::LocationTypeInfo>, String> {
    Ok(restic::supported_location_types())
}

#[tauri::command]
pub fn default_repo_location(
    app_state: tauri::State<SharedAppState>,
) -> Result<restic::Location, String> {
    Ok(app_state.get()?.location)
}

#[tauri::command(async)] // NB: async! not on main thread, else the dialogs may freeze
pub fn verify_restic_path(
    app_state: tauri::State<SharedAppState>,
    app_window: tauri::Window,
) -> Result<(), String> {
    // verify that restic binary is set
    let state = app_state.get()?;
    if !state.restic.restic_path().exists() {
        // aks user to resolve restic path
        MessageDialogBuilder::new(
            "Restic Binary Missing",
            "Failed to find restic program in your $PATH\n
Please select your installed restic binary manually in the following dialog.",
        )
        .parent(&app_window)
        .show();
        let restic_path = FileDialogBuilder::new()
            .set_parent(&app_window)
            .set_title("Locate restic program")
            .set_file_name(restic::RESTIC_EXECTUABLE_NAME)
            .pick_file();
        log::info!(
            "Got restic binary path '{}' from user",
            restic_path.clone().unwrap_or_default().display()
        );
        if let Some(restic_path) = restic_path {
            let rclone_path = state.restic.rclone_path().clone();
            app_state.update_restic(restic::Program::new(restic_path, rclone_path))?;
        }
    }
    Ok(())
}

#[tauri::command]
pub fn open_repository(
    location: restic::Location,
    app_state: tauri::State<SharedAppState>,
) -> Result<(), String> {
    log::info!("Opening repository: '{}'...", location.path);
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    // update location in app state
    app_state.update_location(location)
}

#[tauri::command(async)]
pub fn get_snapshots(
    app_state: tauri::State<SharedAppState>,
) -> Result<Vec<restic::Snapshot>, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    // run command
    log::info!("Fetching snapshots from repository...");
    let command_output = state
        .restic
        .run(&state.location, &["snapshots", "--json"], "fetch_snapshots")
        .map_err(|err| err.to_string())?;
    let snapshots = serde_json::from_str::<Vec<restic::Snapshot>>(&command_output)
        .map_err(|err| err.to_string())?;
    // update snapshot cache
    let mut snapshot_ids = HashSet::new();
    for v in &snapshots {
        snapshot_ids.insert(v.id.clone());
    }
    app_state.update_snapshot_ids(snapshot_ids)?;
    // return snapshots
    Ok(snapshots)
}

#[tauri::command(async)]
pub fn get_files(
    snapshot_id: String,
    path: String,
    app_state: tauri::State<SharedAppState>,
) -> Result<Vec<restic::File>, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
    // run command
    log::info!(
        "Fetching files from snapshot '{}' at path '{}'...",
        snapshot_id,
        path
    );
    let command_output = state
        .restic
        .run(
            &state.location,
            &["ls", &snapshot_id, "--json", &path],
            "fetch_files",
        )
        .map_err(|err| err.to_string())?;
    let mut files = vec![];
    for line in command_output.split('\n').skip(1) {
        if line.is_empty() || !line.starts_with('{') {
            // Skip first/blank/malformed lines
            continue;
        }
        let file = serde_json::from_str::<restic::File>(line).map_err(|err| err.to_string())?;
        files.push(file);
    }
    Ok(files)
}

#[tauri::command(async)]
pub fn dump_file(
    snapshot_id: String,
    file: restic::File,
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
        return Ok(String::new());
    }
    let target_folder = folder.unwrap();
    let target_file_name = if file.type_ == "dir" {
        target_folder.join(file.name.clone() + ".zip")
    } else {
        target_folder.join(file.name.clone())
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
    log::info!(
        "Dumping file '{}' from snapshot '{}'...",
        file.name,
        snapshot_id
    );
    let target_file = fs::File::create(target_file_name.clone())
        .map_err(|err| format!("Failed to create target file: {err}"))?;
    state
        .restic
        .run_redirected(
            &state.location,
            &["dump", "-a", "zip", &snapshot_id, &file.path],
            target_file,
            None,
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn dump_file_to_temp(
    snapshot_id: String,
    file: restic::File,
    app_state: tauri::State<SharedAppState>,
    _app_window: tauri::Window,
) -> Result<String, String> {
    // unwrap app state
    let state = app_state.get()?;
    state.verify_restic_path()?;
    state.verify_location()?;
    state.verify_snapshot(&snapshot_id)?;
    // set target file name
    let target_file_name = if file.type_ == "dir" {
        state.temp_dir().join(file.name.clone() + ".zip")
    } else {
        state.temp_dir().join(file.name.clone())
    };
    let target_file = fs::File::create(target_file_name.clone())
        .map_err(|err| format!("Failed to create target file: {err}"))?;
    // run dump command
    log::info!(
        "Previewing file '{}' from snapshot '{}'...",
        file.name,
        snapshot_id
    );
    state
        .restic
        .run_redirected(
            &state.location,
            &["dump", "-a", "zip", &snapshot_id, &file.path],
            target_file,
            None,
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}

#[tauri::command(async)]
pub fn restore_file(
    snapshot_id: String,
    file: restic::File,
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
        return Ok(String::new());
    }
    let target_file_name = folder.unwrap().join(file.name.clone());
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
    log::info!(
        "Restoring file '{}' from snapshot '{}'...",
        file.name,
        snapshot_id
    );
    state
        .restic
        .run(
            &state.location,
            &[
                "restore",
                &snapshot_id,
                "--target",
                &target_file_name.to_string_lossy(),
                "--include",
                &file.path,
            ],
            None,
        )
        .map_err(|err| err.to_string())?;
    Ok(target_file_name.to_string_lossy().to_string())
}
