use base64::Engine;
use jsonwebtoken::{decode, decode_header, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Serialize, Deserialize)]
pub struct JwtResult {
    pub header: Value,
    pub payload: Value,
    pub valid_signature: Option<bool>,
}

#[tauri::command]
pub fn decode_jwt(token: String, secret: Option<String>) -> Result<JwtResult, String> {
    let header = decode_header(&token).map_err(|e| e.to_string())?;
    let header_val = serde_json::to_value(&header).map_err(|e| e.to_string())?;
    
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".into());
    }
    
    let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(parts[1])
        .map_err(|e| e.to_string())?;
    let payload: Value = serde_json::from_slice(&payload_bytes).map_err(|e| e.to_string())?;

    let valid_signature = if let Some(sec) = secret {
        if sec.is_empty() {
            None
        } else {
            let mut validation = Validation::new(header.alg);
            validation.validate_exp = false;
            validation.validate_nbf = false;
            validation.required_spec_claims.clear();
            let res: Result<jsonwebtoken::TokenData<Value>, _> = decode(
                &token,
                &DecodingKey::from_secret(sec.as_bytes()),
                &validation,
            );
            Some(res.is_ok())
        }
    } else {
        None
    };

    Ok(JwtResult {
        header: header_val,
        payload,
        valid_signature,
    })
}
