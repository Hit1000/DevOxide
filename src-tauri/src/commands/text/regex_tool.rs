use regex::RegexBuilder;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct MatchGroup {
    pub value: Option<String>,
}

#[derive(Serialize, Deserialize)]
pub struct RegexMatch {
    pub start: usize,
    pub end: usize,
    pub groups: Vec<MatchGroup>,
}

#[derive(Serialize, Deserialize)]
pub struct RegexResult {
    pub matches: Vec<RegexMatch>,
    pub error: Option<String>,
}

#[tauri::command]
pub fn test_regex(pattern: String, input: String, flags: String) -> RegexResult {
    let mut builder = RegexBuilder::new(&pattern);
    builder.case_insensitive(flags.contains('i'));
    builder.multi_line(flags.contains('m'));
    builder.dot_matches_new_line(flags.contains('s'));

    match builder.build() {
        Ok(re) => {
            let mut matches = Vec::new();
            if flags.contains('g') {
                for cap in re.captures_iter(&input) {
                    let mat = cap.get(0).unwrap();
                    let mut groups = Vec::new();
                    for i in 0..cap.len() {
                        groups.push(MatchGroup {
                            value: cap.get(i).map(|m| m.as_str().to_string()),
                        });
                    }
                    matches.push(RegexMatch {
                        start: mat.start(),
                        end: mat.end(),
                        groups,
                    });
                }
            } else {
                if let Some(cap) = re.captures(&input) {
                    let mat = cap.get(0).unwrap();
                    let mut groups = Vec::new();
                    for i in 0..cap.len() {
                        groups.push(MatchGroup {
                            value: cap.get(i).map(|m| m.as_str().to_string()),
                        });
                    }
                    matches.push(RegexMatch {
                        start: mat.start(),
                        end: mat.end(),
                        groups,
                    });
                }
            }
            RegexResult { matches, error: None }
        }
        Err(e) => RegexResult {
            matches: vec![],
            error: Some(e.to_string()),
        },
    }
}
