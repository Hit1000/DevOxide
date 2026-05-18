use serde_json::Value;

#[tauri::command]
pub fn convert_json(input: String, target: String) -> Result<String, String> {
    let parsed: Value = serde_json::from_str(&input).map_err(|e| e.to_string())?;
    match target.as_str() {
        "yaml" => serde_yaml::to_string(&parsed).map_err(|e| e.to_string()),
        "toml" => toml::to_string(&parsed).map_err(|e| e.to_string()),
        "csv" => {
            if let Value::Array(arr) = parsed {
                if arr.is_empty() {
                    return Ok(String::new());
                }
                let mut wtr = csv::Writer::from_writer(vec![]);
                for item in arr {
                    wtr.serialize(item).map_err(|e| e.to_string())?;
                }
                let bytes = wtr.into_inner().map_err(|e| e.to_string())?;
                String::from_utf8(bytes).map_err(|e| e.to_string())
            } else {
                Err("CSV conversion requires an array of objects".into())
            }
        }
        "minified" => serde_json::to_string(&parsed).map_err(|e| e.to_string()),
        _ => Err("Unsupported target format".into()),
    }
}
