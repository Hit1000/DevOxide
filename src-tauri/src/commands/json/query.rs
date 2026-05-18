use jaq_interpret::{Ctx, FilterT, ParseCtx, RcIter, Val};
use serde_json::Value;

#[tauri::command]
pub fn jq_query(input: String, filter: String) -> Result<Vec<String>, String> {
    // Parse input JSON into Val
    let input_val: Val = serde_json::from_str::<Value>(&input)
        .map(Val::from)
        .map_err(|e| e.to_string())?;

    // Set up context with core native filters
    let mut defs = ParseCtx::new(Vec::new());
    defs.insert_natives(jaq_core::core());

    // Parse the filter — jaq_parse::parse returns (Option<Main>, Vec<Error>)
    let (f, errs) = jaq_parse::parse(&filter, jaq_parse::main());
    if !errs.is_empty() {
        return Err(format!("Parse error: {:?}", errs));
    }
    let f = match f {
        Some(f) => f,
        None => return Err("Empty filter".into()),
    };

    // Compile
    let f = defs.compile(f);
    if !defs.errs.is_empty() {
        return Err(format!("Compile error: {} issue(s) in filter", defs.errs.len()));
    }

    // Run
    let inputs = RcIter::new(core::iter::empty());
    let mut results = Vec::new();
    for res in f.run((Ctx::new([], &inputs), input_val)) {
        match res {
            Ok(v) => results.push(v.to_string()),
            Err(e) => return Err(e.to_string()),
        }
    }

    Ok(results)
}
