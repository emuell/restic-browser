use std::{
    borrow::Cow,
    collections::HashMap,
    ffi::{OsStr, OsString},
    fs,
    path::PathBuf,
    process::{Command, Output, Stdio},
    sync::RwLock,
};

use lazy_static::lazy_static;
use scopeguard::defer;

use crate::restic::*;

// -------------------------------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic.exe";
#[cfg(target_os = "windows")]
#[allow(dead_code)]
pub static RCLONE_EXECTUABLE_NAME: &str = "rclone.exe";

#[cfg(not(target_os = "windows"))]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic";
#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
pub static RCLONE_EXECTUABLE_NAME: &str = "rclone";

/// Exit code a process gets killed with via kill_process_with_id.
#[cfg(target_os = "windows")]
const COMMAND_TERMINATED_EXIT_CODE: u32 = 288;

// -------------------------------------------------------------------------------------------------

/// Tries to gracefully terminate a process with the provided process ID.
#[cfg(target_os = "windows")]
fn terminate_process_with_id(pid: u32) -> Result<(), String> {
    use windows_sys::Win32::{
        Foundation::{CloseHandle, GetLastError, BOOL, FALSE, HANDLE, WIN32_ERROR},
        System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE},
    };
    log::info!("Killing process with PID {}", pid);

    unsafe {
        // Open the process handle with intent to terminate
        let handle: HANDLE = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
        if handle == 0 {
            let error: WIN32_ERROR = GetLastError();
            return Err(format!(
                "Failed to obtain handle to process {}: {:#x}",
                pid, error
            ));
        }
        // Terminate the process
        let result: BOOL = TerminateProcess(handle, COMMAND_TERMINATED_EXIT_CODE);
        // Close the handle now that its no longer needed
        CloseHandle(handle);
        if result == FALSE {
            let error: WIN32_ERROR = GetLastError();
            return Err(format!("Failed to terminate process {}: {:#x}", pid, error));
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn terminate_process_with_id(pid: u32) -> Result<(), String> {
    use nix::{
        sys::signal::{self, Signal},
        unistd::Pid,
    };
    log::info!("Killing process with PID {}", pid);
    signal::kill(Pid::from_raw(pid as i32), Signal::SIGTERM).map_err(|err| err.to_string())
}

// -------------------------------------------------------------------------------------------------

lazy_static! {
    /// Currently running restic command processes mapped by command group names.
    static ref RUNNING_RESTIC_COMMANDS: RwLock<HashMap<String, Vec<u32>>> =
        RwLock::new(HashMap::new());
}

/// Kill all running commands from the given command group.
fn terminate_all_commands_in_group(command_group: &str) -> Result<(), String> {
    let running_child_ids = {
        if let Some(child_ids) = RUNNING_RESTIC_COMMANDS
            .write()
            .map_err(|err| err.to_string())?
            .get_mut(command_group)
        {
            std::mem::take(child_ids)
        } else {
            vec![]
        }
    };
    if !running_child_ids.is_empty() {
        log::debug!(
            "Terminating {} processes in group '{}'...",
            running_child_ids.len(),
            command_group
        );
        for child_id in running_child_ids {
            if let Err(err) = terminate_process_with_id(child_id) {
                log::warn!("Failed to kill command with PID {}: {}", child_id, err);
            }
        }
    }
    Ok(())
}

/// Register the given child it with a command group.
fn add_command_to_group(command_group: &str, child_id: u32) -> Result<(), String> {
    log::debug!("Process in group '{command_group}' with PID '{child_id}' started...");
    let mut running_child_ids = RUNNING_RESTIC_COMMANDS
        .write()
        .map_err(|err| err.to_string())?;
    if let Some(child_ids) = running_child_ids.get_mut(command_group) {
        child_ids.push(child_id);
    } else {
        running_child_ids.insert(command_group.to_string(), vec![child_id]);
    }
    Ok(())
}

// Unregister the given child from a command group.
fn remove_command_from_group(command_group: &str, child_id: u32) -> Result<(), String> {
    log::debug!("Process in group '{command_group}' with PID '{child_id}' finished");
    let mut running_child_ids = RUNNING_RESTIC_COMMANDS
        .write()
        .map_err(|err| err.to_string())?;
    if let Some(commands) = running_child_ids.get_mut(command_group) {
        commands.retain(|id| *id != child_id);
    }
    Ok(())
}

// -------------------------------------------------------------------------------------------------

/// Create new Command and configure it to hide the CMD window on Windows.
pub fn new_command(program: &PathBuf) -> Command {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x08000000); // CREATE_NO_WINDOW
    command
}

// -------------------------------------------------------------------------------------------------

/// Restic command executable wrapper.
#[derive(Debug, Default, Clone)]
pub struct Program {
    pub version: [i32; 3],            // restic version [major, minor, rev]
    pub restic_path: PathBuf,         // path to the restic executable
    pub rclone_path: Option<PathBuf>, // optional path to rclone executable
}

impl Program {
    /// Create a new Restic program with the given path.
    pub fn new(restic_path: PathBuf, rclone_path: Option<PathBuf>) -> Self {
        Self {
            version: Self::version(&restic_path),
            restic_path,
            rclone_path,
        }
    }

    /// Run a restic command for the given location with the given args.
    /// when @param command_group is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run<C: Into<Option<&'static str>>>(
        &self,
        location: Location,
        args: Vec<&str>,
        command_group: C,
    ) -> Result<String, String> {
        // kill all other running restic commands in the same group
        let command_group = command_group.into();
        if let Some(command_group) = command_group {
            if let Err(err) = terminate_all_commands_in_group(command_group) {
                log::error!("Failed to kill process childs: {err}");
            }
        }
        // start a new restic command
        let args = self.args(args, &location);
        let envs = self.envs(&location);
        let child = new_command(&self.restic_path)
            .envs(envs)
            .args(args.clone())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;
        // register child id with command group
        let child_id = child.id();
        if let Some(command_group) = command_group {
            if let Err(err) = add_command_to_group(command_group, child_id) {
                log::error!("Failed to add process child: {err}");
            }
        }
        // unregister child id with command group
        defer! {
            if let Some(command_group) = command_group {
                if let Err(err) = remove_command_from_group(command_group, child_id) {
                    log::error!("Failed to remove process child: {err}");
                }
            }
        }
        // wait until command finished and collect output
        let output = child.wait_with_output().map_err(|err| err.to_string())?;
        if output.status.success() {
            let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
            Ok(stdout.to_string())
        } else {
            Err(Self::handle_run_error(args, output))
        }
    }

    /// Run a restic command for the given location with the given args and redirect
    /// stdout to the given target file.
    /// when @param command_group is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run_redirected<C: Into<Option<&'static str>>>(
        &self,
        location: Location,
        args: Vec<&str>,
        file: fs::File,
        command_group: C,
    ) -> Result<(), String> {
        // kill all other running restic commands in the same group
        let command_group = command_group.into();
        if let Some(command_group) = command_group {
            if let Err(err) = terminate_all_commands_in_group(command_group) {
                log::error!("Failed to kill process childs: {err}");
            }
        }
        // start a new restic command
        let args = self.args(args, &location);
        let envs = self.envs(&location);
        let child = new_command(&self.restic_path)
            .envs(envs)
            .args(args.clone())
            .stdout(std::process::Stdio::from(file))
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;
        // register child id with command group
        let child_id = child.id();
        if let Some(command_group) = command_group {
            if let Err(err) = add_command_to_group(command_group, child_id) {
                log::error!("Failed to add process child: {err}");
            }
        }
        // unregister child id with command group
        defer! {
            if let Some(command_group) = command_group {
                if let Err(err) = remove_command_from_group(command_group, child_id) {
                    log::error!("Failed to remove process child: {err}");
                }
            }
        }
        // wait until command finished and collect output
        let output = child.wait_with_output().map_err(|err| err.to_string())?;
        if output.status.success() {
            Ok(())
        } else {
            Err(Self::handle_run_error(args, output))
        }
    }

    /// Log and return error from a restic run command.
    fn handle_run_error<S: AsRef<OsStr> + std::fmt::Debug>(args: Vec<S>, output: Output) -> String {
        // guess if this is a command which got aborted
        #[cfg(target_os = "windows")]
        if output
            .status
            .code()
            .is_some_and(|code| code as u32 == COMMAND_TERMINATED_EXIT_CODE)
        {
            log::info!("Restic '{:?}' command got aborted", args);
            return "Command got aborted".to_string();
        }
        #[cfg(not(target_os = "windows"))]
        {
            use nix::libc::SIGTERM;
            use std::os::unix::process::ExitStatusExt;

            if output
                .status
                .signal()
                .is_some_and(|status| status == SIGTERM)
            {
                log::info!("Restic '{:?}' command got aborted", args);
                return "Command got aborted".to_string();
            }
        }
        // else log and return stderr as it is
        let stderr = std::str::from_utf8(&output.stderr).unwrap_or("");
        log::warn!(
            "Restic '{:?}' command failed with status {}:\n{}",
            args,
            output.status,
            stderr
        );
        stderr.to_string()
    }

    /// Run restic command to query its version number.
    fn version(path: &PathBuf) -> [i32; 3] {
        let mut version = [0, 0, 0];
        if !path.exists() {
            return version;
        }
        // get version from restic binary
        match new_command(path).arg("version").output() {
            Ok(output) => {
                if output.status.success() {
                    // "restic x.y.z some other info"
                    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
                    let mut name_and_version = stdout.split(' ');
                    if let Some(version_str) = name_and_version.nth(1) {
                        for (v, s) in version.iter_mut().zip(version_str.split('.')) {
                            *v = s.parse::<i32>().unwrap_or(0);
                        }
                    }
                } else {
                    let stderr = std::str::from_utf8(&output.stderr).unwrap_or("");
                    log::warn!("Failed to read version info from restic binary: {}", stderr);
                }
            }
            Err(err) => {
                log::warn!("Failed to read version info from restic binary: {err}");
            }
        }
        version
    }

    // Create restic specific args for the given base args and location.
    fn args<'a>(&self, args: Vec<&'a str>, location: &Location) -> Vec<Cow<'a, OsStr>> {
        let mut args = args
            .into_iter()
            .map(|s| Cow::Borrowed(OsStr::new(s)))
            .collect::<Vec<_>>();
        if location.prefix.starts_with("rclone") {
            if let Some(rclone_path) = &self.rclone_path {
                args.push(Cow::Borrowed(OsStr::new("--option")));
                args.push(Cow::Owned(OsString::from(format!(
                    "rclone.program={}",
                    &rclone_path.to_str().unwrap_or("[invalid path]")
                ))));
            }
        }
        if location.insecure_tls {
            args.push(Cow::Borrowed(OsStr::new("--insecure-tls")));
        }
        args
    }

    // Create restic specific environment variables for the given location
    fn envs(&self, location: &Location) -> HashMap<String, String> {
        let mut envs = HashMap::new();
        if !location.path.is_empty() {
            if !location.prefix.is_empty() {
                envs.insert(
                    "RESTIC_REPOSITORY".to_string(),
                    location.prefix.clone() + ":" + &location.path,
                );
            } else {
                envs.insert("RESTIC_REPOSITORY".to_string(), location.path.clone());
            }
        }
        if !location.password.is_empty() {
            envs.insert("RESTIC_PASSWORD".to_string(), location.password.clone());
        }
        for credential in location.credentials.clone() {
            envs.insert(credential.name, credential.value);
        }
        envs
    }
}
