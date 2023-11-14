// -------------------------------------------------------------------------------------------------

/// A serializable restic repository location type.
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

// -------------------------------------------------------------------------------------------------

/// Additional info for a restic repository location type, as required by the frontend.
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


