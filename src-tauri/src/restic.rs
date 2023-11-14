use std::{collections::HashMap, env, fs};

use shlex::Shlex;

use crate::command::new_command;

// -------------------------------------------------------------------------------------------------

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
#[serde(rename_all = "lowercase")]
pub enum LocationType {
    Local,
    SFtp,
    Rest,
    RClone,
    AmazonS3,
    MSAzure,
    Backblaze,
    GoogleCloudStorage,
}

#[derive(serde::Serialize, serde::Deserialize, Debug, Clone)]
pub struct LocationTypeInfo {
    #[serde(rename = "type")]
    pub location_type: LocationType,
    pub prefix: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    pub credentials: Vec<String>,
}

impl LocationTypeInfo {
    pub fn new(
        location_type: LocationType,
        prefix: &str,
        display_name: &str,
        credentials: Vec<&str>,
    ) -> LocationTypeInfo {
        LocationTypeInfo {
            location_type,
            prefix: prefix.to_string(),
            display_name: display_name.to_string(),
            credentials: credentials.iter().map(|c| c.to_string()).collect(),
        }
    }
}

pub fn supported_location_types() -> Vec<LocationTypeInfo> {
    vec![
        LocationTypeInfo::new(LocationType::Local, "", "Local Path", vec![]),
        LocationTypeInfo::new(LocationType::SFtp, "sftp", "SFTP", vec![]),
        LocationTypeInfo::new(LocationType::Rest, "rest", "REST Server", vec![]),
        LocationTypeInfo::new(LocationType::RClone, "rclone", "RCLONE", vec![]),
        LocationTypeInfo::new(
            LocationType::AmazonS3,
            "s3",
            "Amazon S3",
            vec!["AWS_ACCESS_KEY_ID", "AWS_SECRET_ACCESS_KEY"],
        ),
        LocationTypeInfo::new(
            LocationType::MSAzure,
            "azure",
            "Azure Blob Storage",
            vec!["AZURE_ACCOUNT_NAME", "AZURE_ACCOUNT_KEY"],
        ),
        LocationTypeInfo::new(
            LocationType::Backblaze,
            "b2",
            "Backblaze B2",
            vec!["B2_ACCOUNT_ID", "B2_ACCOUNT_KEY"],
        ),
        LocationTypeInfo::new(
            LocationType::GoogleCloudStorage,
            "gs",
            "Google Cloud Storage",
            vec!["GOOGLE_ACCESS_TOKEN"],
        ),
    ]
}

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
    #[serde(rename = "insecureTls")]
    pub insecure_tls: bool,
    pub password: String,
}

impl Location {
    // create a new Location from the given set of optional restic arguments
    // see tauri.conf.json for the expected args
    pub fn new_from_args(args: HashMap<String, Option<String>>) -> Location {
        // filter out empty args
        let args = args
            .into_iter()
            .map(|(k, v)| (k, v.unwrap_or_default()))
            .filter(|(_, v)| !v.is_empty())
            .collect::<HashMap<_, _>>();
        // get repo from file or directly
        let path = if let Some(repository_file) = args.get("repository-file") {
            let content = fs::read_to_string(repository_file).unwrap_or(String::new());
            content.trim_end().to_string()
        } else {
            args.get("repository")
                .or(args.get("repo"))
                .cloned()
                .unwrap_or_default()
        };
        // get password from file, command or directly
        let password = if let Some(password_file) = args.get("password-file") {
            let content = fs::read_to_string(password_file).unwrap_or(String::new());
            content.trim_end().to_string()
        } else if let Some(password_command) = args.get("password-command") {
            let mut program_and_args = Shlex::new(password_command);
            if let Ok(output) =
                new_command(&program_and_args.by_ref().next().unwrap_or_default().into())
                    .args(program_and_args.by_ref().collect::<Vec<_>>())
                    .output()
            {
                let stdout = std::str::from_utf8(&output.stdout).unwrap_or("");
                stdout.trim_end().to_string()
            } else {
                "".to_string()
            }
        } else {
            args.get("password")
                .or(args.get("pass"))
                .cloned()
                .unwrap_or_default()
        };

        // get insecure_tls option, when set
        let insecure_tls = args.contains_key("insecure-tls");
        // build basic location
        let mut location = Location {
            path,
            password,
            credentials: vec![],
            prefix: "".to_string(),
            insecure_tls,
        };
        if location.path.is_empty() {
            // skip reading other location info when no repo is present
            return location;
        }
        // set prefix from path and fill in credentials from env
        location.prefix = "".to_string();
        for location_info in supported_location_types() {
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
        location
    }

    // create a new Location from restic specific environemnt values.
    pub fn new_from_env() -> Location {
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
