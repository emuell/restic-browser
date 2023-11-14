// -------------------------------------------------------------------------------------------------

/// A serializable restic file, as dumped by the restic binary via `restic ls --json``  
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

