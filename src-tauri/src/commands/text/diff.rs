use serde::{Deserialize, Serialize};
use similar::{ChangeTag, TextDiff};

#[derive(Serialize, Deserialize)]
pub struct DiffLine {
    pub kind: String,
    pub content: String,
}

#[tauri::command]
pub fn diff_text(left: String, right: String) -> Vec<DiffLine> {
    let diff = TextDiff::from_lines(&left, &right);
    let mut result = Vec::new();
    
    for change in diff.iter_all_changes() {
        let kind = match change.tag() {
            ChangeTag::Delete => "removed",
            ChangeTag::Insert => "added",
            ChangeTag::Equal => "equal",
        };
        result.push(DiffLine {
            kind: kind.to_string(),
            content: change.value().to_string(),
        });
    }
    result
}
