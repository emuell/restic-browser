use std::{collections::HashMap, env, fs};

use shlex::Shlex;

use crate::restic::{new_command, supported_location_types};

// -------------------------------------------------------------------------------------------------

/// A serializable restic location env variable.
#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
pub struct EnvValue {
    pub name: String,
    pub value: String,
}

// -------------------------------------------------------------------------------------------------

/// A serializable restic repository location.
#[derive(serde::Serialize, serde::Deserialize, Debug, Default, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Location {
    pub prefix: String,
    pub path: String,
    pub credentials: Vec<EnvValue>,
    pub allow_empty_password: bool,
    pub password: String,
    pub insecure_tls: bool,
}

impl Location {
    // create a new Location from the given set of optional restic arguments
    // see tauri.conf.json for the expected args
    pub fn new_from_args(args: HashMap<String, Option<String>>) -> Self {
        // normalize args
        let args = args
            .into_iter()
            .map(|(k, v)| (k, v.unwrap_or_default()))
            .filter(|(_, v)| !v.is_empty())
            .collect::<HashMap<_, _>>();
        // get repo from file or directly
        let path = if let Some(repository_file) = args.get("repository-file") {
            fs::read_to_string(repository_file)
                .unwrap_or(String::new())
                .trim()
                .to_string()
        } else {
            args.get("repository")
                .or(args.get("repo"))
                .cloned()
                .unwrap_or(String::new())
        };
        // get password from file, command or directly
        let password = if let Some(password_file) = args.get("password-file") {
            fs::read_to_string(password_file)
                .unwrap_or(String::new())
                .trim()
                .to_string()
        } else if let Some(password_command) = args.get("password-command") {
            let mut program_and_args = Shlex::new(password_command);
            let program = program_and_args.next().unwrap_or_default();
            let args = program_and_args.collect::<Vec<_>>();
            if let Ok(output) = new_command(&program.into()).args(args).output() {
                std::str::from_utf8(&output.stdout)
                    .unwrap_or("")
                    .trim_end()
                    .to_string()
            } else {
                String::new()
            }
        } else {
            args.get("password")
                .or(args.get("pass"))
                .cloned()
                .unwrap_or(String::new())
        };
        let allow_empty_password = false;
        // get insecure_tls option, when set
        let insecure_tls = args.contains_key("insecure-tls");
        // build basic location
        let mut location = Self {
            path,
            credentials: vec![],
            prefix: String::new(),
            allow_empty_password,
            password,
            insecure_tls,
        };
        // set prefix from path, when there's a path set
        if !location.path.is_empty() {
            location.set_prefix_from_path();
        }
        location
    }

    // create a new Location from restic specific environment values.
    pub fn new_from_env() -> Self {
        Self::new_from_args(
            [
                ("repository", "RESTIC_REPOSITORY"),
                ("repository-file", "RESTIC_REPOSITORY_FILE"),
                ("password", "RESTIC_PASSWORD"),
                ("password-file", "RESTIC_PASSWORD_FILE"),
                ("password-command", "RESTIC_PASSWORD_COMMAND"),
            ]
            .into_iter()
            .map(|(k, v)| (String::from(k), env::var(v).ok()))
            .collect::<HashMap<_, _>>(),
        )
    }

    fn set_prefix_from_path(&mut self) {
        self.prefix = String::new();
        for location_info in supported_location_types() {
            if let Some(stripped_path) = self
                .path
                .strip_prefix(&(location_info.prefix.to_string() + ":"))
            {
                self.prefix = location_info.prefix.to_string();
                self.path = stripped_path.trim().to_string();
                for credential in location_info.credentials {
                    self.credentials.push(EnvValue {
                        name: credential.to_string(),
                        value: env::var(credential).unwrap_or_default(),
                    });
                }
                break;
            }
        }
    }
}
