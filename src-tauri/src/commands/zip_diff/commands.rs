use super::session;
use super::types::*;

#[tauri::command]
pub async fn open_diff_session(
    old_source: String,
    new_source: String,
    ignore_patterns: Vec<String>,
) -> Result<SessionResult, String> {
    // Run blocking IO on a separate thread
    tokio::task::spawn_blocking(move || {
        session::open_session(&old_source, &new_source, ignore_patterns)
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}

#[tauri::command]
pub async fn get_file_diff(
    session_id: String,
    relative_path: String,
) -> Result<FileDiff, String> {
    tokio::task::spawn_blocking(move || {
        session::get_diff(&session_id, &relative_path)
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}

#[tauri::command]
pub async fn set_hunk_state(
    session_id: String,
    relative_path: String,
    hunk_id: String,
    state: String,
    edited_content: Option<String>,
) -> Result<(), String> {
    session::set_hunk(&session_id, &relative_path, &hunk_id, &state, edited_content)
}

#[tauri::command]
pub async fn set_all_hunks(
    session_id: String,
    relative_path: String,
    state: String,
) -> Result<(), String> {
    session::set_all(&session_id, &relative_path, &state)
}

#[tauri::command]
pub async fn preview_file_result(
    session_id: String,
    relative_path: String,
) -> Result<String, String> {
    session::preview_result(&session_id, &relative_path)
}

#[tauri::command]
pub async fn export_result(
    session_id: String,
    selected_paths: Vec<String>,
    export_mode: String,
    output_path: String,
) -> Result<ExportSummary, String> {
    tokio::task::spawn_blocking(move || {
        session::export(&session_id, selected_paths, &export_mode, &output_path)
    })
    .await
    .map_err(|e| format!("Task error: {e}"))?
}

#[tauri::command]
pub async fn close_diff_session(session_id: String) -> Result<(), String> {
    session::close_session(&session_id)
}

#[tauri::command]
pub async fn save_file_edit(
    session_id: String,
    relative_path: String,
    content: String,
) -> Result<(), String> {
    session::save_file_edit(&session_id, &relative_path, content)
}

#[tauri::command]
pub async fn clear_file_edit(
    session_id: String,
    relative_path: String,
) -> Result<(), String> {
    session::clear_file_edit(&session_id, &relative_path)
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| format!("Failed to open folder: {e}"))?;
    }
    Ok(())
}
