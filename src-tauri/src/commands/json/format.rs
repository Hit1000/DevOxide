use serde_json::Value;
use serde::{Deserialize, Serialize};

#[tauri::command]
pub fn format_json(input: String, indent: u8) -> Result<String, String> {
    let parsed: Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    let indent_str = if indent == 0 { "\t".to_string() } else { " ".repeat(indent as usize) };
    let formatter = serde_json::ser::PrettyFormatter::with_indent(indent_str.as_bytes());
    let mut buf = Vec::new();
    let mut ser = serde_json::Serializer::with_formatter(&mut buf, formatter);
    serde::Serialize::serialize(&parsed, &mut ser).map_err(|e| e.to_string())?;
    Ok(String::from_utf8(buf).map_err(|e| e.to_string())?)
}

#[derive(Serialize, Deserialize)]
pub struct TolerantResult {
    pub output: String,
    pub had_errors: bool,
    pub error_hints: Vec<String>,
}

#[tauri::command]
pub fn format_tolerant(input: String) -> TolerantResult {
    let parsed: Result<Value, _> = json5::from_str(&input);
    match parsed {
        Ok(value) => {
            let output = serde_json::to_string_pretty(&value).unwrap_or_else(|_| input.clone());
            TolerantResult {
                output,
                had_errors: false,
                error_hints: vec![],
            }
        }
        Err(e) => {
            TolerantResult {
                output: input.clone(),
                had_errors: true,
                error_hints: vec![e.to_string()],
            }
        }
    }
}
