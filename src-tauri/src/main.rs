// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::HashMap,
    env, fs,
    path::{self, PathBuf},
    process,
};

use anyhow::anyhow;
use simplelog::*;

use which::which;
#[cfg(target_os = "macos")]
use which::which_in;

use tauri::Manager;
use tauri_plugin_window_state::StateFlags;

// -------------------------------------------------------------------------------------------------

mod app;
mod restic;

// -------------------------------------------------------------------------------------------------

fn initialize_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
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
    CombinedLogger::init(loggers).unwrap_or_else(|err| eprintln!("Failed to create logger: {err}"));

    // common bin directories on macOS
    #[cfg(target_os = "macos")]
    let common_path = format!(
        "/usr/local/bin:/opt/local/bin:/opt/homebrew/bin:{}/bin",
        env::var("HOME").unwrap_or("~".into())
    );

    // get restic from args or find restic in path
    let mut restic_path = None;
    let mut rclone_path = None;
    match app.get_cli_matches() {
        Ok(matches) => {
            if let Some(arg) = matches.args.get("restic") {
                restic_path = arg.value.as_str().map(PathBuf::from);
                if let Some(ref path) = restic_path {
                    log::info!("Got restic as arg {}", path.to_string_lossy());
                }
            }
            if let Some(arg) = matches.args.get("rclone") {
                rclone_path = arg.value.as_str().map(PathBuf::from);
                if let Some(ref path) = rclone_path {
                    log::info!("Got rclone as arg {}", path.to_string_lossy());
                }
            }
        }
        Err(err) => log::error!("{}", err.to_string()),
    }
    if restic_path.is_none() {
        if let Ok(restic) = which(restic::RESTIC_EXECTUABLE_NAME) {
            restic_path = Some(restic.clone());
            log::info!(
                "Found restic binary in PATH at '{}'",
                restic.to_string_lossy()
            );
        }
        #[cfg(target_os = "macos")]
        if restic_path.is_none() {
            if let Ok(restic) = which_in(
                restic::RESTIC_EXECTUABLE_NAME,
                Some(common_path.clone()),
                env::current_dir().unwrap_or("/".into()),
            ) {
                restic_path = Some(restic.clone());
                log::info!(
                    "Found restic binary in common PATH at '{}'",
                    restic.to_string_lossy()
                );
            }
        }
        if restic_path.is_none() {
            log::warn!("Failed to resolve restic binary");
        }
    }

    #[cfg(target_os = "macos")]
    // on macOS, try to resolve rclone path in common PATH if it can't be found in path
    if rclone_path.is_none() && which(restic::RCLONE_EXECTUABLE_NAME).is_err() {
        if let Ok(rclone) = which_in(
            restic::RCLONE_EXECTUABLE_NAME,
            Some(common_path),
            env::current_dir().unwrap_or("/".into()),
        ) {
            rclone_path = Some(rclone.clone());
            log::info!(
                "Found rclone binary in common PATH at '{}'",
                rclone.to_string_lossy()
            );
        }
    }

    // get default restic location from args or env
    let mut location;
    if let Ok(matches) = app.get_cli_matches() {
        location = restic::Location::new_from_args(
            matches
                .args
                .into_iter()
                .map(|(k, v)| (k, v.value.as_str().map(String::from)))
                .collect::<HashMap<_, _>>(),
        );
        if location.path.is_empty() {
            location = restic::Location::new_from_env();
        }
    } else {
        location = restic::Location::new_from_env();
    }

    // create temp dir for previews
    let mut temp_dir = path::Path::new(&env::temp_dir())
        .join(app.package_info().name.clone() + "_" + &process::id().to_string());
    if !temp_dir.exists() {
        if let Err(err) = fs::create_dir_all(temp_dir.clone()) {
            log::warn!("Failed to create temp app directory: {err}");
            temp_dir = env::temp_dir();
        }
    }

    // create new app state
    app.manage(app::SharedAppState::new(app::AppState::new(
        restic::Program::new(restic_path.unwrap_or_default(), rclone_path),
        location,
        temp_dir,
    )));

    log::info!("Starting application...");
    Ok(())
}

// -------------------------------------------------------------------------------------------------

fn finalize_app(app: tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Closing application...");
    // remove previews temp dir
    let state = app.state::<app::SharedAppState>().get()?;
    fs::remove_dir_all(state.temp_dir())?;
    Ok(())
}

// -------------------------------------------------------------------------------------------------

#[tauri::command]
fn show_app(app_window: tauri::Window) -> Result<(), String> {
    // app is initially hidden until this is called to avoid screen flickering
    // see src/hooks.ts, which invokes this on DOMContentLoaded
    app_window.show().map_err(|err| err.to_string())?;
    Ok(())
}

// -------------------------------------------------------------------------------------------------

fn main() {
    // create new app
    let app = tauri::Builder::default()
        .setup(initialize_app)
        .on_window_event(|event| {
            if let tauri::WindowEvent::Destroyed = event.event() {
                let app = event.window().app_handle();
                finalize_app(app).unwrap_or_else(|err| {
                    log::info!("Finalizing application failed with error: {err}");
                });
            }
        })
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // don't restore visibility: window is initially hidden - see show_window
                .with_state_flags(StateFlags::all() & StateFlags::VISIBLE.complement())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            show_app,
            app::supported_repo_location_types,
            app::default_repo_location,
            app::open_file_or_url,
            app::verify_restic_path,
            app::open_repository,
            app::get_files,
            app::get_snapshots,
            app::dump_file,
            app::dump_file_to_temp,
            app::restore_file
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    // show argument help / version only
    let mut do_run = true;
    if let Ok(matches) = app.get_cli_matches() {
        if let Some(arg) = matches.args.get("help") {
            print!("{}", arg.value.as_str().unwrap());
            do_run = false;
        } else if matches.args.get("version").is_some() {
            let package = app.config().package.clone();
            println!(
                "{} v{}",
                package.product_name.unwrap_or("Restic Browser".to_string()),
                package.version.unwrap_or("[Unknown version]".to_string())
            );
            do_run = false;
        }
    }

    // run the app
    if do_run {
        app.run(|_, _| {});
    }
}
