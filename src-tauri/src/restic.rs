use std::{collections::HashMap, fs, process::Command};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

// -------------------------------------------------------------------------------------------------

#[cfg(target_os = "windows")]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic.exe";
#[cfg(not(target_os = "windows"))]
pub static RESTIC_EXECTUABLE_NAME: &str = "restic";

// -------------------------------------------------------------------------------------------------

#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
pub struct EnvValue {
    pub name: String,
    pub value: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
pub struct Location {
    pub prefix: String,
    pub path: String,
    pub credentials: Vec<EnvValue>,
    pub password: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
pub struct File {
    pub name: String,
    #[serde(rename = "type")]
    pub type_: String,
    pub path: String,
    #[serde(default)]
    pub uid: i64,
    #[serde(default)]
    pub gid: i64,
    #[serde(default)]
    pub size: i64,
    #[serde(default)]
    pub mode: i64,
    #[serde(default)]
    pub mtime: String,
    #[serde(default)]
    pub atime: String,
    #[serde(default)]
    pub ctime: String,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
pub struct Snapshot {
    pub id: String,
    pub short_id: String,
    #[serde(default)]
    pub time: String,
    #[serde(default)]
    pub paths: Vec<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub hostname: String,
    #[serde(default)]
    pub username: String,
}

// -------------------------------------------------------------------------------------------------

#[derive(Debug, Default, Clone)]
pub struct ResticCommand {
    pub version: [i32; 3], // major, minor, rev
    pub path: String,      // path to the restic executable
}

impl ResticCommand {
    pub fn new(path: &str) -> Self {
        let version = ResticCommand::query_version(path);
        let path = path.to_string();
        Self { version, path }
    }

    // run a restic command for the given location with the given args
    pub fn run(&self, location: Location, args: Vec<&str>) -> Result<String, String> {
        let envs = Self::environment_values(location);
        let output = Self::new_command(&self.path)
            .envs(envs)
            .args(args.clone())
            .output()
            .map_err(|err| err.to_string())?;
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

    // run a restic command for the given location with the given args and redirect
    // stdout to the given target file
    pub fn run_redirected(
        &self,
        location: Location,
        args: Vec<&str>,
        file: fs::File,
    ) -> Result<(), String> {
        let envs = Self::environment_values(location);
        let output = Self::new_command(&self.path)
            .envs(envs)
            .args(args.clone())
            .stdout(std::process::Stdio::from(file))
            .output()
            .map_err(|err| err.to_string())?;
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

    // create new Command and configure it to hide command window on Windows
    fn new_command(program: &str) -> Command {
        #[allow(unused_mut)]
        let mut command = Command::new(program);
        #[cfg(target_os = "windows")]
        command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        command
    }

    // run restic command to query its version
    fn query_version(path: &str) -> [i32; 3] {
        // get version from restic binary
        let mut version = [0, 0, 0];
        match Self::new_command(path).arg("version").output() {
            Ok(output) => {
                if output.status.success() {
                    // "restic x.y.z some other info"
                    let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
                    let mut name_version = stdout.split(' ');
                    if let Some(version_str) = name_version.nth(1) {
                        let mut splits = version_str
                            .split('.')
                            .map(|str| str.parse::<i32>().unwrap_or(0));
                        version[0] = splits.next().unwrap_or(0);
                        version[1] = splits.next().unwrap_or(0);
                        version[2] = splits.next().unwrap_or(0);
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

    // create restic specific environment variables for the given location
    fn environment_values(location: Location) -> HashMap<String, String> {
        let mut envs = HashMap::new();
        if !location.path.is_empty() {
            if !location.prefix.is_empty() {
                envs.insert(
                    "RESTIC_REPOSITORY".to_string(),
                    location.prefix + ":" + &location.path,
                );
            } else {
                envs.insert("RESTIC_REPOSITORY".to_string(), location.path);
            }
        }
        if !location.password.is_empty() {
            envs.insert("RESTIC_PASSWORD".to_string(), location.password);
        }
        for credential in location.credentials {
            envs.insert(credential.name, credential.value);
        }
        envs
    }
}
