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
pub struct Location {
    pub prefix: String,
    pub path: String,
    pub credentials: Vec<EnvValue>,
    #[serde(rename = "insecureTls")]
    pub insecure_tls: bool,
    pub password: String,
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
                .unwrap_or("".to_string())
                .trim_end()
                .to_string()
        } else {
            args.get("repository")
                .or(args.get("repo"))
                .cloned()
                .unwrap_or("".to_string())
        };
        // get password from file, command or directly
        let password = if let Some(password_file) = args.get("password-file") {
            fs::read_to_string(password_file)
                .unwrap_or(String::new())
                .trim_end()
                .to_string()
        } else if let Some(password_command) = args.get("password-command") {
            let mut program_and_args = Shlex::new(password_command);
            let program = program_and_args.next().unwrap_or("".to_string());
            let args = program_and_args.collect::<Vec<_>>();
            if let Ok(output) = new_command(&program.into()).args(args).output() {
                std::str::from_utf8(&output.stdout)
                    .unwrap_or("")
                    .trim_end()
                    .to_string()
            } else {
                "".to_string()
            }
        } else {
            args.get("password")
                .or(args.get("pass"))
                .cloned()
                .unwrap_or("".to_string())
        };
        // get insecure_tls option, when set
        let insecure_tls = args.contains_key("insecure-tls");
        // build basic location
        let mut location = Self {
            path,
            password,
            credentials: vec![],
            prefix: "".to_string(),
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
        self.prefix = "".to_string();
        for location_info in supported_location_types() {
            if self
                .path
                .starts_with(&(location_info.prefix.to_string() + ":"))
            {
                self.prefix = location_info.prefix.to_string();
                self.path = self
                    .path
                    .replacen(&(location_info.prefix.to_string() + ":"), "", 0);
                for credential in location_info.credentials {
                    self.credentials.push(EnvValue {
                        name: credential.to_string(),
                        value: env::var(credential).unwrap_or_default(),
                    })
                }
                break;
            }
        }
    }
}
