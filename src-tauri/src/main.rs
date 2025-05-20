// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{
    collections::HashMap,
    env, fs,
    io::IsTerminal,
    path::{self, PathBuf},
    process,
};

use simplelog::{
    ColorChoice, CombinedLogger, Config, LevelFilter, SharedLogger, TermLogger, TerminalMode,
    WriteLogger,
};

use which::which;
#[cfg(target_os = "macos")]
use which::which_in;

use tauri::Manager;
use tauri_plugin_cli::CliExt;
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_window_state::StateFlags;

// -------------------------------------------------------------------------------------------------

mod app;
mod restic;

// -------------------------------------------------------------------------------------------------

// Show given message to the user and exit the process
fn show_message_and_exit(app: &tauri::App, message: String, exit_code: i32) -> ! {
    if initialize_console() {
        // dump message to console
        if exit_code == 0 {
            println!("{}", message);
        } else {
            eprintln!("{}", message);
        }
        std::process::exit(exit_code);
    } else {
        // else show a system dialog
        app.app_handle().dialog().message(message).blocking_show();
        std::process::exit(exit_code);
    }
}

// -------------------------------------------------------------------------------------------------

// Try attaching the tauri GUI app to a running console, so we can print into it.
//
// Returns true when running in a terminal, else false.
fn initialize_console() -> bool {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::Console::{AttachConsole, ATTACH_PARENT_PROCESS};
        // NB: if the app is not started from a command line this is expected to fail
        let _ = unsafe { AttachConsole(ATTACH_PARENT_PROCESS) };
    }
    std::io::stdin().is_terminal()
}

// -------------------------------------------------------------------------------------------------

// Try attaching the tauri GUI app to a running console, so we can print into it.
//
// Returns true when running in a terminal, else false.
fn initialize_logger(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // create term logger
    let mut loggers: Vec<Box<dyn SharedLogger>> = vec![TermLogger::new(
        LevelFilter::Warn,
        Config::default(),
        TerminalMode::Mixed,
        ColorChoice::Auto,
    )];
    // try creating a file log as well, but don't panic
    let log_file_result: Result<Box<WriteLogger<std::fs::File>>, Box<dyn std::error::Error>> = {
        let log_path = app.path().app_log_dir()?;
        std::fs::create_dir_all(log_path.as_path())?;
        let mut log_file_path = log_path.clone();
        log_file_path.push("App.log");
        Ok(WriteLogger::new(
            LevelFilter::Info,
            Config::default(),
            std::fs::File::create(log_file_path.as_path())?,
        ))
    };
    match log_file_result {
        Err(err) => eprintln!("Failed to create log file: {err}"),
        Ok(logger) => loggers.push(logger),
    }
    // create combined logger
    CombinedLogger::init(loggers).unwrap_or_else(|err| eprintln!("Failed to create logger: {err}"));
    Ok(())
}

// -------------------------------------------------------------------------------------------------

fn initialize_app(app: &mut tauri::App) -> Result<(), Box<dyn std::error::Error>> {
    // setup term logger
    initialize_logger(app)?;

    // handle help/v arguments (early exit)
    let arg_matches = app.cli().matches()?;
    if let Some(arg) = arg_matches.args.get("help") {
        let message = arg.value.as_str().expect("Invalid help string").to_string();
        log::info!("Dumping arg help and exiting...");
        show_message_and_exit(app, message, 0);
    } else if arg_matches.args.contains_key("version") {
        let message = format!(
            "{} v{}",
            app.config()
                .product_name
                .clone()
                .unwrap_or("Restic Browser".to_string()),
            app.config()
                .version
                .clone()
                .unwrap_or("[Unknown version]".to_string())
        );
        log::info!("Dumping version and exiting...");
        show_message_and_exit(app, message, 0);
    }

    // set PATH environment from shells in GUI apps on Linux and macOS
    if let Err(err) = fix_path_env::fix() {
        log::warn!("Failed to update PATH env: {}", err);
    }

    // get common bin directories on macOS
    #[cfg(target_os = "macos")]
    let common_path = format!(
        "/usr/local/bin:/opt/local/bin:/opt/homebrew/bin:{}/bin",
        env::var("HOME").unwrap_or("~".into())
    );

    // get restic from args or find restic in path
    let mut restic_path = None;
    let mut rclone_path = None;

    if let Some(arg) = arg_matches.args.get("restic") {
        restic_path = arg.value.as_str().map(PathBuf::from);
        if let Some(ref path) = restic_path {
            log::info!("Got restic as arg {}", path.to_string_lossy());
        }
    }
    if let Some(arg) = arg_matches.args.get("rclone") {
        rclone_path = arg.value.as_str().map(PathBuf::from);
        if let Some(ref path) = rclone_path {
            log::info!("Got rclone as arg {}", path.to_string_lossy());
        }
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
    let mut location = restic::Location::new_from_args(
        arg_matches
            .args
            .into_iter()
            .map(|(k, v)| (k, v.value.as_str().map(String::from)))
            .collect::<HashMap<_, _>>(),
    );
    if location.path.is_empty() {
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

fn finalize_app(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    log::info!("Closing application...");
    // remove previews temp dir
    let state = app.state::<app::SharedAppState>().get()?;
    fs::remove_dir_all(state.temp_dir())?;
    Ok(())
}

// -------------------------------------------------------------------------------------------------

#[tauri::command]
fn show_app_window(app_window: tauri::Window) -> Result<(), String> {
    // app is initially hidden until this is called to avoid screen flickering
    // see src/hooks.ts, which invokes this on DOMContentLoaded
    app_window.show().map_err(|err| err.to_string())?;
    Ok(())
}

// -------------------------------------------------------------------------------------------------

fn create_application() -> Result<tauri::App, Box<dyn std::error::Error>> {
    tauri::Builder::default()
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(initialize_app)
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let app = window.app_handle();
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
            show_app_window,
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
        .map_err(Into::<Box<dyn std::error::Error>>::into)
}

// -------------------------------------------------------------------------------------------------

fn main() {
    match create_application() {
        Ok(app) => {
            app.run(|_app, _event| {});
        }
        Err(err) => {
            panic!("{}", err);
        }
    }
}
