use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct ValidationError {
    pub message: String,
    pub line: usize,
    pub column: usize,
}

#[derive(Serialize, Deserialize)]
pub struct ValidationResult {
    pub valid: bool,
    pub error: Option<ValidationError>,
}

#[tauri::command]
pub fn validate_json(input: String) -> ValidationResult {
    let parsed: Result<Value, _> = serde_json::from_str(&input);
    match parsed {
        Ok(_) => ValidationResult {
            valid: true,
            error: None,
        },
        Err(e) => ValidationResult {
            valid: false,
            error: Some(ValidationError {
                message: e.to_string(),
                line: e.line(),
                column: e.column(),
            }),
        },
    }
}
