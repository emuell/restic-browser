use std::{
    collections::HashMap,
    fs,
    path::PathBuf,
    process::{Command, Stdio},
};

use crate::restic::*;

// -------------------------------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic.exe";
#[cfg(not(target_os = "windows"))]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic";

// -------------------------------------------------------------------------------------------------

// Create new Command and configure it to hide the CMD window on Windows.
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

#[derive(Debug, Default, Clone)]
pub struct ResticCommand {
    pub version: [i32; 3], // major, minor, rev
    pub path: PathBuf,     // path to the restic executable
}

impl ResticCommand {
    /// Create a new Restic command with the given path.
    pub fn new(path: PathBuf) -> Self {
        Self {
            version: Self::query_version(&path),
            path,
        }
    }

    /// Run a restic command for the given location with the given args.
    /// when @param command_group is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run(
        &self,
        location: Location,
        args: Vec<&str>,
    ) -> Result<String, String> {
        let args = Self::args(args, &location);
        let envs = Self::environment_values(&location);
        let child = new_command(&self.path)
            .envs(envs)
            .args(args.clone())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;
        // wait until command finished and collect output
        let output = child.wait_with_output().map_err(|err| err.to_string())?;
        let stderr = std::str::from_utf8(&output.stderr).unwrap_or("");
        let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
        if output.status.success() {
            Ok(stdout.to_string())
        } else {
            log::warn!(
                "Restic '{:?}' command failed with status {}:\n{}",
                args,
                output.status,
                stderr
            );
            Err(stderr.to_string())
        }
    }

    /// Run a restic command for the given location with the given args and redirect
    /// stdout to the given target file.
    /// when @param command_group is some, all commands in the same group are
    /// killed before starting the new command.
    pub fn run_redirected(
        &self,
        location: Location,
        args: Vec<&str>,
        file: fs::File,
    ) -> Result<(), String> {
        // start a new restic command
        let args = Self::args(args, &location);
        let envs = Self::environment_values(&location);
        let child = new_command(&self.path)
            .envs(envs)
            .args(args.clone())
            .stdout(std::process::Stdio::from(file))
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|err| err.to_string())?;
        // wait until command finished and collect output
        let output = child.wait_with_output().map_err(|err| err.to_string())?;
        let stderr = std::str::from_utf8(&output.stderr).unwrap_or("");
        if output.status.success() {
            Ok(())
        } else {
            log::warn!(
                "Restic '{:?}' command failed with status {}:\n{}",
                args,
                output.status,
                stderr
            );
            Err(stderr.to_string())
        }
    }

    /// Run restic command to query its version number.
    fn query_version(path: &PathBuf) -> [i32; 3] {
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
    fn args<'a>(args: Vec<&'a str>, location: &Location) -> Vec<&'a str> {
        if location.insecure_tls {
            let mut args = args.clone();
            args.push("--insecure-tls");
            args
        } else {
            args
        }
    }

    // Create restic specific environment variables for the given location
    fn environment_values(location: &Location) -> HashMap<String, String> {
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
