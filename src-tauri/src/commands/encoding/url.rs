use urlencoding::{encode, decode};

#[tauri::command]
pub fn url_encode(input: String) -> String {
    encode(&input).into_owned()
}

#[tauri::command]
pub fn url_decode(input: String) -> Result<String, String> {
    decode(&input).map(|s| s.into_owned()).map_err(|e| e.to_string())
}
