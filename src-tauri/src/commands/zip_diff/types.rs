use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FileStatus {
    Added,
    Removed,
    Modified,
    Identical,
    Binary,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum LineKind {
    Equal,
    Added,
    Removed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ResultLineKind {
    Equal,
    Accepted,
    Rejected,
    Edited,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum HunkState {
    Accepted,
    Rejected,
    Edited,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileNode {
    pub relative_path: String,
    pub status: FileStatus,
    pub old_hash: Option<String>,
    pub new_hash: Option<String>,
    pub is_binary: bool,
    pub old_size: u64,
    pub new_size: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub kind: LineKind,
    pub old_line_no: Option<usize>,
    pub new_line_no: Option<usize>,
    pub content: String,
    pub hunk_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResultLine {
    pub kind: ResultLineKind,
    pub content: String,
    pub hunk_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Hunk {
    pub hunk_id: String,
    pub old_start: usize,
    pub old_lines: Vec<String>,
    pub new_start: usize,
    pub new_lines: Vec<String>,
    pub state: HunkState,
    pub edited_content: Option<String>,
    pub is_exception: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub relative_path: String,
    pub status: FileStatus,
    pub hunks: Vec<Hunk>,
    pub old_content: Option<String>,
    pub new_content: Option<String>,
    pub diff_lines: Vec<DiffLine>,
    pub result_lines: Vec<ResultLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SessionResult {
    pub session_id: String,
    pub file_tree: Vec<FileNode>,
    pub added_count: usize,
    pub removed_count: usize,
    pub modified_count: usize,
    pub identical_count: usize,
    pub binary_count: usize,
    pub old_label: String,
    pub new_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportSummary {
    pub files_exported: usize,
    pub hunks_accepted: usize,
    pub hunks_rejected: usize,
    pub hunks_edited: usize,
    pub output_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub stage: String,
    pub current: usize,
    pub total: usize,
    pub current_file: String,
}
