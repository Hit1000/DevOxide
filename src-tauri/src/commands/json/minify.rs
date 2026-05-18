use serde_json::Value;

#[tauri::command]
pub fn minify_json(input: String) -> Result<String, String> {
    let parsed: Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    serde_json::to_string(&parsed).map_err(|e| e.to_string())
}
