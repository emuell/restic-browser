// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::RwLock;

use anyhow::anyhow;
use simplelog::*;
use tauri::Manager;
use which::which;

// -------------------------------------------------------------------------------------------------

mod app;
mod restic;

// -------------------------------------------------------------------------------------------------

fn main() {
    // create new app
    tauri::Builder::default()
        .setup(|app| {
            // create term logger
            let mut loggers: Vec<Box<dyn SharedLogger>> = vec![TermLogger::new(
                LevelFilter::Warn,
                Config::default(),
                TerminalMode::Mixed,
                ColorChoice::Auto,
            )];
            // try creating a file log as well, but don't panic
            match (|| -> Result<Box<WriteLogger<std::fs::File>>, Box<dyn std::error::Error>> {
                let log_path = app
                    .path_resolver()
                    .app_log_dir()
                    .ok_or_else(|| anyhow!("Failed to resolve log directory"))?;
                std::fs::create_dir_all(log_path.as_path())?;
                let mut log_file_path = log_path;
                log_file_path.push("App.log");
                Ok(WriteLogger::new(
                    LevelFilter::Info,
                    Config::default(),
                    std::fs::File::create(log_file_path.as_path())?,
                ))
            })() {
                Err(err) => eprintln!("Failed to create log file: {err}"),
                Ok(logger) => loggers.push(logger),
            }
            // initialize
            CombinedLogger::init(loggers)
                .unwrap_or_else(|err| eprintln!("Failed to create logger: {err}"));

            // create new appstate and find restic in path
            let app_state;
            if let Ok(restic_path) = which("restic") {
                app_state = app::AppState::new(restic_path.to_str().unwrap());
                log::info!("Found restic binary at {}", restic_path.to_string_lossy());
                eprintln!();
            } else {
                log::warn!("Failed to resolve restic binary");
                app_state = app::AppState::default();
            }
            app.manage(app::SharedAppState(RwLock::new(app_state)));

            log::info!("Starting application...");
            Ok(())
        })
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .invoke_handler(tauri::generate_handler![
            app::default_repo_location,
            app::open_file_or_url,
            app::open_repository,
            app::get_files,
            app::get_snapshots,
            app::dump_file,
            app::dump_file_to_temp,
            app::restore_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
