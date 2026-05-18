use csscolorparser::Color;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
pub struct ColorResult {
    pub hex: String,
    pub rgb: String,
    pub hsl: String,
    pub rgba: String,
}

#[tauri::command]
pub fn convert_color(input: String) -> Result<ColorResult, String> {
    let color = input.parse::<Color>().map_err(|e| e.to_string())?;
    
    let rgba = color.to_rgba8();
    let rgba_str = format!("rgba({}, {}, {}, {})", rgba[0], rgba[1], rgba[2], color.a);
    let hex = color.to_hex_string();
    let rgb = format!("rgb({}, {}, {})", rgba[0], rgba[1], rgba[2]);
    
    // HSL approximation (csscolorparser doesn't have direct HSL output, we can calculate it)
    let r = rgba[0] as f32 / 255.0;
    let g = rgba[1] as f32 / 255.0;
    let b = rgba[2] as f32 / 255.0;
    
    let max = r.max(g).max(b);
    let min = r.min(g).min(b);
    let d = max - min;
    
    let mut h = 0.0;
    if d != 0.0 {
        if max == r {
            h = 60.0 * (((g - b) / d) % 6.0);
        } else if max == g {
            h = 60.0 * (((b - r) / d) + 2.0);
        } else {
            h = 60.0 * (((r - g) / d) + 4.0);
        }
    }
    if h < 0.0 {
        h += 360.0;
    }
    
    let l = (max + min) / 2.0;
    let s = if d == 0.0 { 0.0 } else { d / (1.0 - (2.0 * l - 1.0).abs()) };
    
    let hsl = format!("hsl({:.1}, {:.1}%, {:.1}%)", h, s * 100.0, l * 100.0);

    Ok(ColorResult {
        hex,
        rgb,
        hsl,
        rgba: rgba_str,
    })
}
