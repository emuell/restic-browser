// -------------------------------------------------------------------------------------------------

mod command;
mod file;
mod location;
mod location_type;
mod snapshot;

pub use command::*;
pub use file::*;
pub use location::*;
pub use location_type::*;
pub use snapshot::*;

// -------------------------------------------------------------------------------------------------

/// Currently supported location types by this backend and restic.
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
