use std::{collections::HashMap, process::ExitStatus, sync::RwLock};

use lazy_static::lazy_static;

// -------------------------------------------------------------------------------------------------

/// Exit code a process gets killed with via `kill_process_with_id`.
#[cfg(target_os = "windows")]
const COMMAND_TERMINATED_EXIT_CODE: u32 = 288;

/// Tries to gracefully terminate a process with the provided process ID.
#[cfg(target_os = "windows")]
fn terminate_process_with_id(pid: u32) -> Result<(), String> {
    use windows_sys::{
        core::BOOL,
        Win32::{
            Foundation::{CloseHandle, GetLastError, FALSE, HANDLE, WIN32_ERROR},
            System::Threading::{OpenProcess, TerminateProcess, PROCESS_TERMINATE},
        },
    };
    log::info!("Killing process with PID {pid}");

    unsafe {
        // Open the process handle with intent to terminate
        let handle: HANDLE = OpenProcess(PROCESS_TERMINATE, FALSE, pid);
        if handle.is_null() {
            let error: WIN32_ERROR = GetLastError();
            return Err(format!(
                "Failed to obtain handle to process {pid}: {error:#x}",
            ));
        }
        // Terminate the process
        let result: BOOL = TerminateProcess(handle, COMMAND_TERMINATED_EXIT_CODE);
        // Close the handle now that its no longer needed
        CloseHandle(handle);
        if result == FALSE {
            let error: WIN32_ERROR = GetLastError();
            return Err(format!("Failed to terminate process {pid}: {error:#x}"));
        }
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
fn terminate_process_with_id(pid: u32) -> Result<(), String> {
    use nix::{
        sys::signal::{self, Signal},
        unistd::Pid,
    };
    log::info!("Killing process with PID {}", pid);
    signal::kill(Pid::from_raw(pid as i32), Signal::SIGTERM).map_err(|err| err.to_string())
}

// -------------------------------------------------------------------------------------------------

lazy_static! {
    /// Currently running processes mapped by command group names.
    static ref RUNNING_RESTIC_COMMANDS: RwLock<HashMap<String, Vec<u32>>> =
        RwLock::new(HashMap::new());
}

// test with a command exit code if a command got aborted, probably via `terminate_all_commands_in_group`
pub fn process_was_terminated(status: &ExitStatus) -> bool {
    #[cfg(target_os = "windows")]
    {
        status
            .code()
            .is_some_and(|code| code as u32 == COMMAND_TERMINATED_EXIT_CODE)
    }
    #[cfg(not(target_os = "windows"))]
    {
        use nix::libc::SIGTERM;
        use std::os::unix::process::ExitStatusExt;
        status.signal().is_some_and(|status| status == SIGTERM)
    }
}

/// Kill all running commands from the given command group.
pub fn terminate_all_commands_in_group(command_group: &str) -> Result<(), String> {
    let running_child_ids = {
        if let Some(child_ids) = RUNNING_RESTIC_COMMANDS
            .write()
            .map_err(|err| err.to_string())?
            .get_mut(command_group)
        {
            std::mem::take(child_ids)
        } else {
            vec![]
        }
    };
    if !running_child_ids.is_empty() {
        log::debug!(
            "Terminating {} processes in group '{}'...",
            running_child_ids.len(),
            command_group
        );
        for child_id in running_child_ids {
            if let Err(err) = terminate_process_with_id(child_id) {
                log::warn!("Failed to kill command with PID {}: {}", child_id, err);
            }
        }
    }
    Ok(())
}

/// Register the given child it with a command group.
pub fn add_command_to_group(command_group: &str, child_id: u32) -> Result<(), String> {
    log::debug!("Process in group '{command_group}' with PID '{child_id}' started...");
    let mut running_child_ids = RUNNING_RESTIC_COMMANDS
        .write()
        .map_err(|err| err.to_string())?;
    if let Some(child_ids) = running_child_ids.get_mut(command_group) {
        child_ids.push(child_id);
    } else {
        running_child_ids.insert(command_group.to_string(), vec![child_id]);
    }
    Ok(())
}

// Unregister the given child from a command group.
pub fn remove_command_from_group(command_group: &str, child_id: u32) -> Result<(), String> {
    log::debug!("Process in group '{command_group}' with PID '{child_id}' finished");
    let mut running_child_ids = RUNNING_RESTIC_COMMANDS
        .write()
        .map_err(|err| err.to_string())?;
    if let Some(commands) = running_child_ids.get_mut(command_group) {
        commands.retain(|id| *id != child_id);
    }
    Ok(())
}
