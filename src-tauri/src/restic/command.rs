use std::{
    borrow::Cow,
    collections::HashMap,
    ffi::{OsStr, OsString},
    fs,
    path::PathBuf,
    process::{Command, Output, Stdio},
};

use semver::Version;

use scopeguard::defer;

use crate::restic::Location;

// -------------------------------------------------------------------------------------------------

/// Command group handling
mod group;

use group::{
    add_command_to_group, process_was_terminated, remove_command_from_group,
    terminate_all_commands_in_group,
};

// -------------------------------------------------------------------------------------------------

/// Create new Command and configure it to hide the CMD window on Windows.
pub fn new_command(program: &PathBuf) -> Command {
    #[cfg(target_os = "windows")]
    use std::os::windows::process::CommandExt;

    #[allow(unused_mut)]
    let mut command = Command::new(program);
    #[cfg(target_os = "windows")]
    command.creation_flags(0x0800_0000); // CREATE_NO_WINDOW
    command
}

// -------------------------------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub const RESTIC_EXECTUABLE_NAME: &str = "restic.exe";
#[cfg(target_os = "windows")]
#[allow(dead_code)]
pub const RCLONE_EXECTUABLE_NAME: &str = "rclone.exe";

#[cfg(not(target_os = "windows"))]
pub const RESTIC_EXECTUABLE_NAME: &str = "restic";
#[cfg(not(target_os = "windows"))]
#[allow(dead_code)]
pub const RCLONE_EXECTUABLE_NAME: &str = "rclone";

// -------------------------------------------------------------------------------------------------

/// Restic command executable wrapper.
#[derive(Debug, Default, Clone)]
pub struct Program {
    restic_version: Option<Version>, // restic version
    restic_path: PathBuf,            // path to the restic executable
    rclone_path: Option<PathBuf>,    // optional path to rclone executable
}

impl Program {
    /// Create a new Restic program with the given path and optional path to rclone.
    pub fn new(restic_path: PathBuf, rclone_path: Option<PathBuf>) -> Self {
        let restic_version = Self::query_restic_version(&restic_path);
        Self {
            restic_version,
            restic_path,
            rclone_path,
        }
    }

    /// Restic program's versiion (major, minor, rev).
    pub fn restic_version(&self) -> &Option<Version> {
        &self.restic_version
    }

    /// Path to the restic executable.
    pub fn restic_path(&self) -> &PathBuf {
        &self.restic_path
    }

    /// Optional path to the rclone executable.
    pub fn rclone_path(&self) -> &Option<PathBuf> {
        &self.rclone_path
    }

    /// Run a restic command for the given location with the given args.
    /// when param `command_group` is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run<C: Into<Option<&'static str>>>(
        &self,
        location: &Location,
        args: &[&str],
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
        let args = self.args(args, location);
        let envs = self.envs(location);
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
            Err(Self::handle_run_error(&args, &output))
        }
    }

    /// Run a restic command for the given location with the given args and redirect
    /// stdout to the given target file.
    /// when @param `command_group` is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run_redirected<C: Into<Option<&'static str>>>(
        &self,
        location: &Location,
        args: &[&str],
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
        let args = self.args(args, location);
        let envs = self.envs(location);
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
            Err(Self::handle_run_error(&args, &output))
        }
    }

    // Create restic specific args for the given base args and location.
    fn args<'a>(&self, args: &'a [&'a str], location: &Location) -> Vec<Cow<'a, OsStr>> {
        let mut args = args
            .iter()
            .copied()
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
            // ensure that only RESTIC_REPOSITORY is set: restic else may use the repo file
            envs.insert("RESTIC_REPOSITORY_FILE".to_string(), "".to_string());
        }
        if !location.password.is_empty() {
            envs.insert("RESTIC_PASSWORD".to_string(), location.password.clone());
            envs.insert("RESTIC_PASSWORD_FILE".to_string(), "".to_string());
        }
        for credential in location.credentials.clone() {
            envs.insert(credential.name, credential.value);
        }
        envs
    }

    /// Log and return error from a restic run command.
    fn handle_run_error<S: AsRef<OsStr> + std::fmt::Debug>(args: &[S], output: &Output) -> String {
        // guess if this is a command which got aborted
        if process_was_terminated(&output.status) {
            log::info!("Restic '{:?}' command got aborted", args);
            return "Command got aborted".to_string();
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
    fn query_restic_version(path: &PathBuf) -> Option<Version> {
        if !path.exists() {
            return None;
        }
        // get version from restic binary
        match new_command(path).arg("version").output() {
            Ok(output) => {
                if output.status.success() {
                    // "restic x.y.z some other info"
                    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
                    let mut name_and_version = stdout.split(' ');
                    if let Some(version_str) = name_and_version.nth(1) {
                        match lenient_semver::parse(version_str) {
                            Ok(version) => return Some(version),
                            Err(err) => log::warn!(
                                "Failed to parse version info from restic binary: {}",
                                err
                            ),
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
        None
    }
}
