mod commands;

use commands::json::{format::*, validate::*, minify::*, convert::*, query::*};
use commands::text::{regex_tool::*, markdown::*, diff::*};
use commands::encoding::{url::*, jwt::*};
use commands::misc::{color::*, hash::*, timestamp::*};
use commands::zip_diff::commands::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            format_json,
            format_tolerant,
            validate_json,
            minify_json,
            convert_json,
            jq_query,
            test_regex,
            render_markdown,
            diff_text,
            url_encode,
            url_decode,
            decode_jwt,
            convert_color,
            generate_hashes,
            convert_timestamp,
            open_diff_session,
            get_file_diff,
            set_hunk_state,
            set_all_hunks,
            preview_file_result,
            export_result,
            close_diff_session,
            save_file_edit,
            clear_file_edit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
