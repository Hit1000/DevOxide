use md5::{Md5, Digest};
use sha1::Sha1;
use sha2::{Sha256, Sha512};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct HashResult {
    pub md5: String,
    pub sha1: String,
    pub sha256: String,
    pub sha512: String,
}

#[tauri::command]
pub fn generate_hashes(input: String) -> HashResult {
    let md5 = format!("{:x}", Md5::digest(input.as_bytes()));
    let sha1 = format!("{:x}", Sha1::digest(input.as_bytes()));
    let sha256 = format!("{:x}", Sha256::digest(input.as_bytes()));
    let sha512 = format!("{:x}", Sha512::digest(input.as_bytes()));

    HashResult { md5, sha1, sha256, sha512 }
}
