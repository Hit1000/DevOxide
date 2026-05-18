use chrono::{DateTime, TimeZone, Utc, Local};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct TimestampResult {
    pub utc: String,
    pub local: String,
    pub iso8601: String,
    pub unix_seconds: i64,
    pub unix_milliseconds: i64,
}

#[tauri::command]
pub fn convert_timestamp(input: String) -> Result<TimestampResult, String> {
    let input = input.trim();
    if input.is_empty() {
        let dt = Utc::now();
        return Ok(TimestampResult {
            utc: dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
            local: dt.with_timezone(&Local).format("%Y-%m-%d %H:%M:%S %Z").to_string(),
            iso8601: dt.to_rfc3339(),
            unix_seconds: dt.timestamp(),
            unix_milliseconds: dt.timestamp_millis(),
        });
    }
    
    let dt = if let Ok(ts) = input.parse::<i64>() {
        if ts > 1000000000000 {
            Utc.timestamp_millis_opt(ts).single().ok_or("Invalid milliseconds")?
        } else {
            Utc.timestamp_opt(ts, 0).single().ok_or("Invalid seconds")?
        }
    } else if let Ok(dt) = DateTime::parse_from_rfc3339(input) {
        dt.with_timezone(&Utc)
    } else if let Ok(dt) = DateTime::parse_from_rfc2822(input) {
        dt.with_timezone(&Utc)
    } else {
        return Err("Unsupported timestamp format".to_string());
    };

    Ok(TimestampResult {
        utc: dt.format("%Y-%m-%d %H:%M:%S UTC").to_string(),
        local: dt.with_timezone(&Local).format("%Y-%m-%d %H:%M:%S %Z").to_string(),
        iso8601: dt.to_rfc3339(),
        unix_seconds: dt.timestamp(),
        unix_milliseconds: dt.timestamp_millis(),
    })
}
