use std::collections::HashMap;
use std::fs;
use std::io::{Read, BufReader};
use std::path::{Path, PathBuf};
use std::time::SystemTime;

use ignore::gitignore::{Gitignore, GitignoreBuilder};
use parking_lot::Mutex;
use similar::{ChangeTag, TextDiff};
use tempfile::TempDir;
use uuid::Uuid;
use walkdir::WalkDir;
use xxhash_rust::xxh3::xxh3_64;
use zip::ZipArchive;

use super::types::*;


// ── Global session store ──────────────────────────────────────────────────────

struct SessionData {
    old_dir: PathBuf,
    new_dir: PathBuf,
    _old_temp: Option<TempDir>,
    _new_temp: Option<TempDir>,
    file_tree: Vec<FileNode>,
    diff_cache: HashMap<String, FileDiff>,
    hunk_states: HashMap<String, HashMap<String, (HunkState, Option<String>)>>,
    file_edits: HashMap<String, String>,
    old_label: String,
    new_label: String,
}

struct CachedZip {
    temp: TempDir,
    base: PathBuf,
    modified: SystemTime,
    size: u64,
}

static SESSIONS: once_cell::sync::Lazy<Mutex<HashMap<String, SessionData>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

static ZIP_CACHE: once_cell::sync::Lazy<Mutex<HashMap<String, CachedZip>>> =
    once_cell::sync::Lazy::new(|| Mutex::new(HashMap::new()));

// ── Helpers ───────────────────────────────────────────────────────────────────

fn is_binary(path: &Path) -> bool {
    if let Ok(mut f) = fs::File::open(path) {
        let mut buf = [0u8; 8192];
        if let Ok(n) = f.read(&mut buf) {
            return buf[..n].contains(&0);
        }
    }
    false
}

fn hash_file(path: &Path) -> Option<String> {
    let data = fs::read(path).ok()?;
    Some(format!("{:016x}", xxh3_64(&data)))
}

fn build_ignore_matcher(patterns: &[String]) -> Gitignore {
    let mut builder = GitignoreBuilder::new("/");
    for pattern in patterns {
        let trimmed = pattern.trim();
        if trimmed.is_empty() {
            continue;
        }
        let _ = builder.add_line(None, trimmed);
    }
    builder.build().unwrap_or_else(|_| Gitignore::empty())
}

fn extract_zip(zip_path: &Path) -> Result<(TempDir, PathBuf), String> {
    let file = fs::File::open(zip_path).map_err(|e| format!("Cannot open zip: {e}"))?;
    let mut archive = ZipArchive::new(BufReader::new(file))
        .map_err(|e| format!("Invalid zip: {e}"))?;

    let tmp = TempDir::new().map_err(|e| format!("Cannot create temp dir: {e}"))?;
    let base = tmp.path().to_path_buf();

    for i in 0..archive.len() {
        let mut entry = archive.by_index(i).map_err(|e| format!("Zip entry error: {e}"))?;
        let name = entry.name().to_string();

        // Security: reject path traversal
        if name.contains("..") {
            return Err(format!("Security error: path traversal in zip entry '{name}'"));
        }

        // Encrypted check
        if entry.is_file() && entry.size() > 0 && entry.compressed_size() > 0 {
            // zip crate returns an error on read for encrypted entries, we'll catch below
        }

        let out_path = base.join(&name);
        if entry.is_dir() {
            fs::create_dir_all(&out_path).ok();
        } else {
            if let Some(parent) = out_path.parent() {
                fs::create_dir_all(parent).ok();
            }
            let mut out = fs::File::create(&out_path)
                .map_err(|e| format!("Cannot create file '{name}': {e}"))?;
            std::io::copy(&mut entry, &mut out)
                .map_err(|e| format!("Cannot extract '{name}': {e} (possibly encrypted)"))?;
        }
    }

    Ok((tmp, base))
}

fn extract_zip_cached(zip_path: &Path) -> Result<PathBuf, String> {
    let metadata = fs::metadata(zip_path).map_err(|e| format!("Cannot stat zip: {e}"))?;
    let modified = metadata.modified().unwrap_or(SystemTime::UNIX_EPOCH);
    let size = metadata.len();
    let key = zip_path.to_string_lossy().to_string();

    if let Some(cached) = ZIP_CACHE.lock().get(&key) {
        if cached.modified == modified && cached.size == size {
            return Ok(cached.base.clone());
        }
    }

    let (temp, base) = extract_zip(zip_path)?;
    ZIP_CACHE.lock().insert(key, CachedZip {
        temp,
        base: base.clone(),
        modified,
        size,
    });

    Ok(base)
}

fn walk_tree(root: &Path, matcher: &Gitignore) -> Vec<(String, PathBuf)> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let rel = match path.strip_prefix(root) {
            Ok(rel) => rel,
            Err(_) => continue,
        };

        let is_dir = entry.file_type().is_dir();
        if matcher.matched(rel, is_dir).is_ignore() {
            continue;
        }

        if entry.file_type().is_file() {
            let rel_str = rel.to_string_lossy().replace('\\', "/");
            files.push((rel_str, path.to_path_buf()));
        }
    }
    files.sort_by(|a, b| a.0.cmp(&b.0));
    files
}

fn compute_hunks(old_text: &str, new_text: &str) -> Vec<Hunk> {
    let diff = TextDiff::from_lines(old_text, new_text);
    let mut hunks = Vec::new();

    for group in diff.grouped_ops(3) {
        let mut old_lines = Vec::new();
        let mut new_lines = Vec::new();
        let mut old_start = 0;
        let mut new_start = 0;
        let mut first = true;

        for op in &group {
            if first {
                old_start = op.old_range().start + 1;
                new_start = op.new_range().start + 1;
                first = false;
            }
            for change in diff.iter_changes(op) {
                match change.tag() {
                    ChangeTag::Equal => {
                        old_lines.push(change.value().to_string());
                        new_lines.push(change.value().to_string());
                    }
                    ChangeTag::Delete => {
                        old_lines.push(change.value().to_string());
                    }
                    ChangeTag::Insert => {
                        new_lines.push(change.value().to_string());
                    }
                }
            }
        }

        hunks.push(Hunk {
            hunk_id: Uuid::new_v4().to_string(),
            old_start,
            old_lines,
            new_start,
            new_lines,
            state: HunkState::Accepted,
            edited_content: None,
            is_exception: false,
        });
    }

    hunks
}

fn hunk_for_line(hunks: &[Hunk], old_line_no: Option<usize>, new_line_no: Option<usize>) -> Option<String> {
    for hunk in hunks {
        let old_start = hunk.old_start;
        let old_end = hunk.old_start.saturating_add(hunk.old_lines.len().saturating_sub(1));
        let new_start = hunk.new_start;
        let new_end = hunk.new_start.saturating_add(hunk.new_lines.len().saturating_sub(1));

        if let Some(old_no) = old_line_no {
            if old_no >= old_start && old_no <= old_end {
                return Some(hunk.hunk_id.clone());
            }
        } else if let Some(new_no) = new_line_no {
            if new_no >= new_start && new_no <= new_end {
                return Some(hunk.hunk_id.clone());
            }
        }
    }
    None
}

fn compute_diff_lines(old_text: &str, new_text: &str, hunks: &[Hunk]) -> Vec<DiffLine> {
    let diff = TextDiff::from_lines(old_text, new_text);
    let mut lines = Vec::new();

    for change in diff.iter_all_changes() {
        let kind = match change.tag() {
            ChangeTag::Equal => LineKind::Equal,
            ChangeTag::Insert => LineKind::Added,
            ChangeTag::Delete => LineKind::Removed,
        };

        let old_line_no = change.old_index().map(|i| i + 1);
        let new_line_no = change.new_index().map(|i| i + 1);
        let content = change.value().trim_end_matches('\n').to_string();
        let hunk_id = hunk_for_line(hunks, old_line_no, new_line_no).unwrap_or_default();

        lines.push(DiffLine {
            kind,
            old_line_no,
            new_line_no,
            content,
            hunk_id,
        });
    }

    lines
}

fn build_result_lines(old_text: &str, hunks: &[Hunk], states: &HashMap<String, (HunkState, Option<String>)>) -> Vec<ResultLine> {
    let mut result = Vec::new();
    let old_lines: Vec<&str> = old_text.lines().collect();
    let mut old_pos = 0usize;

    for hunk in hunks {
        let hunk_old_start = hunk.old_start.saturating_sub(1);
        while old_pos < hunk_old_start && old_pos < old_lines.len() {
            result.push(ResultLine {
                kind: ResultLineKind::Equal,
                content: old_lines[old_pos].to_string(),
                hunk_id: None,
            });
            old_pos += 1;
        }

        let (state, edited) = states.get(&hunk.hunk_id)
            .cloned()
            .unwrap_or((hunk.state.clone(), hunk.edited_content.clone()));

        match state {
            HunkState::Accepted => {
                for line in &hunk.new_lines {
                    result.push(ResultLine {
                        kind: ResultLineKind::Accepted,
                        content: line.trim_end_matches('\n').to_string(),
                        hunk_id: Some(hunk.hunk_id.clone()),
                    });
                }
            }
            HunkState::Rejected => {
                for line in &hunk.old_lines {
                    result.push(ResultLine {
                        kind: ResultLineKind::Rejected,
                        content: line.trim_end_matches('\n').to_string(),
                        hunk_id: Some(hunk.hunk_id.clone()),
                    });
                }
            }
            HunkState::Edited => {
                if let Some(content) = edited {
                    for line in content.lines() {
                        result.push(ResultLine {
                            kind: ResultLineKind::Edited,
                            content: line.to_string(),
                            hunk_id: Some(hunk.hunk_id.clone()),
                        });
                    }
                }
            }
        }

        old_pos = hunk.old_start.saturating_sub(1) + hunk.old_lines.len();
    }

    while old_pos < old_lines.len() {
        result.push(ResultLine {
            kind: ResultLineKind::Equal,
            content: old_lines[old_pos].to_string(),
            hunk_id: None,
        });
        old_pos += 1;
    }

    result
}

fn reconstruct_file(old_text: &str, hunks: &[Hunk], states: &HashMap<String, (HunkState, Option<String>)>) -> String {
    let old_lines: Vec<&str> = old_text.lines().collect();
    let mut result = String::new();
    let mut old_pos = 0;

    // We need to replay based on the actual diff ops, but for simplicity
    // we'll use the hunk data directly
    for hunk in hunks {
        let (state, edited) = states.get(&hunk.hunk_id)
            .cloned()
            .unwrap_or((hunk.state.clone(), hunk.edited_content.clone()));

        // Add any lines before this hunk from old content
        let hunk_old_start = hunk.old_start.saturating_sub(1);
        while old_pos < hunk_old_start && old_pos < old_lines.len() {
            result.push_str(old_lines[old_pos]);
            result.push('\n');
            old_pos += 1;
        }

        match state {
            HunkState::Accepted => {
                for line in &hunk.new_lines {
                    result.push_str(line);
                    if !line.ends_with('\n') { result.push('\n'); }
                }
            }
            HunkState::Rejected => {
                for line in &hunk.old_lines {
                    result.push_str(line);
                    if !line.ends_with('\n') { result.push('\n'); }
                }
            }
            HunkState::Edited => {
                if let Some(content) = &edited {
                    result.push_str(content);
                    if !content.ends_with('\n') { result.push('\n'); }
                }
            }
        }

        // Skip past the old lines consumed by this hunk
        old_pos = hunk.old_start.saturating_sub(1) + hunk.old_lines.len();
    }

    // Add remaining old lines
    while old_pos < old_lines.len() {
        result.push_str(old_lines[old_pos]);
        result.push('\n');
        old_pos += 1;
    }

    result
}

// ── Public API ────────────────────────────────────────────────────────────────

pub fn open_session(old_path: &str, new_path: &str, ignore_patterns: Vec<String>) -> Result<SessionResult, String> {
    let old_p = PathBuf::from(old_path);
    let new_p = PathBuf::from(new_path);

    let (old_temp, old_dir, old_label) = if old_p.extension().map(|e| e == "zip").unwrap_or(false) {
        let dir = extract_zip_cached(&old_p)?;
        let label = old_p.file_name().unwrap_or_default().to_string_lossy().to_string();
        (None, dir, label)
    } else if old_p.is_dir() {
        let label = old_p.file_name().unwrap_or_default().to_string_lossy().to_string();
        (None, old_p, label)
    } else {
        return Err("Old source must be a .zip file or folder".into());
    };

    let (new_temp, new_dir, new_label) = if new_p.extension().map(|e| e == "zip").unwrap_or(false) {
        let dir = extract_zip_cached(&new_p)?;
        let label = new_p.file_name().unwrap_or_default().to_string_lossy().to_string();
        (None, dir, label)
    } else if new_p.is_dir() {
        let label = new_p.file_name().unwrap_or_default().to_string_lossy().to_string();
        (None, new_p, label)
    } else {
        return Err("New source must be a .zip file or folder".into());
    };

    let matcher = build_ignore_matcher(&ignore_patterns);
    let old_files = walk_tree(&old_dir, &matcher);
    let new_files = walk_tree(&new_dir, &matcher);

    let mut old_map: HashMap<String, PathBuf> = HashMap::new();
    let mut old_hashes: HashMap<String, String> = HashMap::new();
    for (rel, path) in &old_files {
        old_map.insert(rel.clone(), path.clone());
        if let Some(h) = hash_file(path) { old_hashes.insert(rel.clone(), h); }
    }

    let mut new_map: HashMap<String, PathBuf> = HashMap::new();
    let mut new_hashes: HashMap<String, String> = HashMap::new();
    for (rel, path) in &new_files {
        new_map.insert(rel.clone(), path.clone());
        if let Some(h) = hash_file(path) { new_hashes.insert(rel.clone(), h); }
    }

    let mut all_paths: Vec<String> = old_map.keys().chain(new_map.keys()).cloned().collect();
    all_paths.sort();
    all_paths.dedup();

    let mut tree = Vec::new();
    let (mut added, mut removed, mut modified, mut identical, mut binary_count) = (0, 0, 0, 0, 0);

    for rel in &all_paths {
        let in_old = old_map.contains_key(rel);
        let in_new = new_map.contains_key(rel);
        let oh = old_hashes.get(rel).cloned();
        let nh = new_hashes.get(rel).cloned();

        let old_size = old_map.get(rel).and_then(|p| fs::metadata(p).ok()).map(|m| m.len()).unwrap_or(0);
        let new_size = new_map.get(rel).and_then(|p| fs::metadata(p).ok()).map(|m| m.len()).unwrap_or(0);

        let (status, is_bin) = if !in_old && in_new {
            added += 1;
            (FileStatus::Added, false)
        } else if in_old && !in_new {
            removed += 1;
            (FileStatus::Removed, false)
        } else if oh == nh {
            identical += 1;
            (FileStatus::Identical, false)
        } else {
            let bin = new_map.get(rel).map(|p| is_binary(p)).unwrap_or(false)
                || old_map.get(rel).map(|p| is_binary(p)).unwrap_or(false);
            if bin {
                binary_count += 1;
                (FileStatus::Binary, true)
            } else {
                modified += 1;
                (FileStatus::Modified, false)
            }
        };

        tree.push(FileNode {
            relative_path: rel.clone(),
            status,
            old_hash: oh,
            new_hash: nh,
            is_binary: is_bin,
            old_size,
            new_size,
        });
    }

    let session_id = Uuid::new_v4().to_string();

    let data = SessionData {
        old_dir: old_dir,
        new_dir: new_dir,
        _old_temp: old_temp,
        _new_temp: new_temp,
        file_tree: tree.clone(),
        diff_cache: HashMap::new(),
        hunk_states: HashMap::new(),
        file_edits: HashMap::new(),
        old_label: old_label.clone(),
        new_label: new_label.clone(),
    };

    SESSIONS.lock().insert(session_id.clone(), data);

    Ok(SessionResult {
        session_id,
        file_tree: tree,
        added_count: added,
        removed_count: removed,
        modified_count: modified,
        identical_count: identical,
        binary_count: binary_count,
        old_label,
        new_label,
    })
}

pub fn get_diff(session_id: &str, relative_path: &str) -> Result<FileDiff, String> {
    let mut sessions = SESSIONS.lock();
    let session = sessions.get_mut(session_id).ok_or("Session not found")?;

    if let Some(cached) = session.diff_cache.get(relative_path) {
        return Ok(cached.clone());
    }

    let node = session.file_tree.iter()
        .find(|n| n.relative_path == relative_path)
        .ok_or("File not found in session")?
        .clone();

    let old_path = session.old_dir.join(relative_path);
    let new_path = session.new_dir.join(relative_path);

    let old_content = fs::read_to_string(&old_path).ok();
    let new_content = fs::read_to_string(&new_path).ok();

    let old_text = old_content.as_deref().unwrap_or("");
    let new_text = new_content.as_deref().unwrap_or("");

    let hunks = match &node.status {
        FileStatus::Modified => compute_hunks(old_text, new_text),
        _ => Vec::new(),
    };

    let diff_lines = if node.status == FileStatus::Binary {
        Vec::new()
    } else {
        compute_diff_lines(old_text, new_text, &hunks)
    };

    let result_lines = if let Some(edited) = session.file_edits.get(relative_path) {
        edited.lines().map(|line| ResultLine {
            kind: ResultLineKind::Edited,
            content: line.to_string(),
            hunk_id: None,
        }).collect()
    } else {
        match &node.status {
            FileStatus::Added => new_text.lines().map(|line| ResultLine {
                kind: ResultLineKind::Accepted,
                content: line.to_string(),
                hunk_id: None,
            }).collect(),
            FileStatus::Removed => Vec::new(),
            FileStatus::Modified => {
                let states = session.hunk_states.get(relative_path);
                let empty = HashMap::new();
                let states = states.unwrap_or(&empty);
                build_result_lines(old_text, &hunks, states)
            }
            FileStatus::Identical => old_text.lines().map(|line| ResultLine {
                kind: ResultLineKind::Equal,
                content: line.to_string(),
                hunk_id: None,
            }).collect(),
            FileStatus::Binary => Vec::new(),
        }
    };

    let diff = FileDiff {
        relative_path: relative_path.to_string(),
        status: node.status,
        hunks,
        old_content,
        new_content,
        diff_lines,
        result_lines,
    };

    session.diff_cache.insert(relative_path.to_string(), diff.clone());
    Ok(diff)
}

pub fn set_hunk(session_id: &str, relative_path: &str, hunk_id: &str, state: &str, edited: Option<String>) -> Result<(), String> {
    let mut sessions = SESSIONS.lock();
    let session = sessions.get_mut(session_id).ok_or("Session not found")?;
    session.file_edits.remove(relative_path);

    let hunk_state = match state {
        "accepted" => HunkState::Accepted,
        "rejected" => HunkState::Rejected,
        "edited" => HunkState::Edited,
        _ => return Err("Invalid hunk state".into()),
    };

    session.hunk_states
        .entry(relative_path.to_string())
        .or_default()
        .insert(hunk_id.to_string(), (hunk_state, edited));

    // Also update the cached diff if present
    if let Some(diff) = session.diff_cache.get_mut(relative_path) {
        if let Some(hunk) = diff.hunks.iter_mut().find(|h| h.hunk_id == hunk_id) {
            hunk.state = match state {
                "accepted" => HunkState::Accepted,
                "rejected" => HunkState::Rejected,
                "edited" => HunkState::Edited,
                _ => HunkState::Accepted,
            };
        }
        let old_text = diff.old_content.as_deref().unwrap_or("");
        let states = session.hunk_states.get(relative_path);
        let empty = HashMap::new();
        let states = states.unwrap_or(&empty);
        diff.result_lines = build_result_lines(old_text, &diff.hunks, states);
    }

    Ok(())
}

pub fn set_all(session_id: &str, relative_path: &str, state: &str) -> Result<(), String> {
    let mut sessions = SESSIONS.lock();
    let session = sessions.get_mut(session_id).ok_or("Session not found")?;
    session.file_edits.remove(relative_path);

    let hunk_state = match state {
        "accepted" => HunkState::Accepted,
        "rejected" => HunkState::Rejected,
        _ => return Err("Invalid state for bulk".into()),
    };

    if let Some(diff) = session.diff_cache.get(relative_path) {
        let file_states = session.hunk_states.entry(relative_path.to_string()).or_default();
        for hunk in &diff.hunks {
            file_states.insert(hunk.hunk_id.clone(), (hunk_state.clone(), None));
        }
    }

    if let Some(diff) = session.diff_cache.get_mut(relative_path) {
        for hunk in diff.hunks.iter_mut() {
            hunk.state = hunk_state.clone();
        }
        let old_text = diff.old_content.as_deref().unwrap_or("");
        let states = session.hunk_states.get(relative_path);
        let empty = HashMap::new();
        let states = states.unwrap_or(&empty);
        diff.result_lines = build_result_lines(old_text, &diff.hunks, states);
    }

    Ok(())
}

pub fn preview_result(session_id: &str, relative_path: &str) -> Result<String, String> {
    let sessions = SESSIONS.lock();
    let session = sessions.get(session_id).ok_or("Session not found")?;

    if let Some(edited) = session.file_edits.get(relative_path) {
        return Ok(edited.clone());
    }

    let diff = session.diff_cache.get(relative_path).ok_or("Diff not loaded yet")?;
    let states = session.hunk_states.get(relative_path);
    let empty = HashMap::new();
    let states = states.unwrap_or(&empty);

    match &diff.status {
        FileStatus::Added => Ok(diff.new_content.clone().unwrap_or_default()),
        FileStatus::Removed => Ok(String::new()),
        FileStatus::Modified => {
            let old = diff.old_content.as_deref().unwrap_or("");
            Ok(reconstruct_file(old, &diff.hunks, states))
        }
        FileStatus::Identical => Ok(diff.old_content.clone().unwrap_or_default()),
        FileStatus::Binary => Err("Cannot preview binary file".into()),
    }
}

pub fn export(session_id: &str, selected: Vec<String>, mode: &str, output_path: &str) -> Result<ExportSummary, String> {
    let sessions = SESSIONS.lock();
    let session = sessions.get(session_id).ok_or("Session not found")?;

    let out = PathBuf::from(output_path);

    let mut exported = 0usize;
    let (mut acc, mut rej, mut edited) = (0usize, 0usize, 0usize);
    let mut output_size = 0u64;

    let files_to_export: Vec<&FileNode> = match mode {
        "patch_zip" => session.file_tree.iter()
            .filter(|f| selected.contains(&f.relative_path))
            .filter(|f| f.status != FileStatus::Identical && f.status != FileStatus::Removed)
            .collect(),
        "new_only" => session.file_tree.iter()
            .filter(|f| selected.contains(&f.relative_path))
            .filter(|f| f.status == FileStatus::Added)
            .collect(),
        _ => session.file_tree.iter()
            .filter(|f| selected.contains(&f.relative_path))
            .filter(|f| f.status != FileStatus::Removed)
            .collect(),
    };

    let mut build_content = |node: &FileNode| -> Vec<u8> {
        match &node.status {
            FileStatus::Modified => {
                if let Some(edited) = session.file_edits.get(&node.relative_path) {
                    edited.as_bytes().to_vec()
                } else if let Some(diff) = session.diff_cache.get(&node.relative_path) {
                    let empty = HashMap::new();
                    let states = session.hunk_states.get(&node.relative_path).unwrap_or(&empty);
                    for (_, (s, _)) in states {
                        match s {
                            HunkState::Accepted => acc += 1,
                            HunkState::Rejected => rej += 1,
                            HunkState::Edited => edited += 1,
                        }
                    }
                    let old = diff.old_content.as_deref().unwrap_or("");
                    reconstruct_file(old, &diff.hunks, states).into_bytes()
                } else {
                    fs::read(session.new_dir.join(&node.relative_path)).unwrap_or_default()
                }
            }
            _ => fs::read(session.new_dir.join(&node.relative_path)).unwrap_or_default(),
        }
    };

    if mode == "patch_zip" {
        let file = fs::File::create(&out).map_err(|e| format!("Cannot create output: {e}"))?;
        let mut zip_writer = zip::ZipWriter::new(file);
        let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);

        for node in &files_to_export {
            let content = build_content(node);
            zip_writer.start_file(&node.relative_path, options).map_err(|e| format!("Zip write error: {e}"))?;
            std::io::Write::write_all(&mut zip_writer, &content).map_err(|e| format!("Write error: {e}"))?;
            exported += 1;
        }

        zip_writer.finish().map_err(|e| format!("Zip finish error: {e}"))?;
        output_size = fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    } else {
        if out.exists() && out.is_file() {
            return Err("Output path must be a directory for folder export".into());
        }
        fs::create_dir_all(&out).map_err(|e| format!("Cannot create output directory: {e}"))?;

        for node in &files_to_export {
            let content = build_content(node);
            let file_path = out.join(&node.relative_path);
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent).map_err(|e| format!("Cannot create output folder: {e}"))?;
            }
            fs::write(&file_path, &content).map_err(|e| format!("Write error: {e}"))?;
            output_size += content.len() as u64;
            exported += 1;
        }
    }

    Ok(ExportSummary {
        files_exported: exported,
        hunks_accepted: acc,
        hunks_rejected: rej,
        hunks_edited: edited,
        output_size_bytes: output_size,
    })
}

pub fn close_session(session_id: &str) -> Result<(), String> {
    SESSIONS.lock().remove(session_id);
    Ok(())
}

pub fn save_file_edit(session_id: &str, relative_path: &str, content: String) -> Result<(), String> {
    let mut sessions = SESSIONS.lock();
    let session = sessions.get_mut(session_id).ok_or("Session not found")?;
    session.file_edits.insert(relative_path.to_string(), content.clone());

    if let Some(diff) = session.diff_cache.get_mut(relative_path) {
        diff.result_lines = content.lines().map(|line| ResultLine {
            kind: ResultLineKind::Edited,
            content: line.to_string(),
            hunk_id: None,
        }).collect();
    }

    Ok(())
}

pub fn clear_file_edit(session_id: &str, relative_path: &str) -> Result<(), String> {
    let mut sessions = SESSIONS.lock();
    let session = sessions.get_mut(session_id).ok_or("Session not found")?;
    session.file_edits.remove(relative_path);

    if let Some(diff) = session.diff_cache.get_mut(relative_path) {
        let old_text = diff.old_content.as_deref().unwrap_or("");
        let states = session.hunk_states.get(relative_path);
        let empty = HashMap::new();
        let states = states.unwrap_or(&empty);
        diff.result_lines = build_result_lines(old_text, &diff.hunks, states);
    }

    Ok(())
}
