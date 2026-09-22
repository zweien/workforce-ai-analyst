use keyring::Entry;
use tauri::Manager;

const SERVICE: &str = "workforce-ai-analyst";
const ACCOUNT: &str = "llm-api-key";

fn read_key() -> Result<String, String> {
    let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(s),
        Err(keyring::Error::NoEntry) => Err("尚未配置 API Key,请先打开设置完成配置。".to_string()),
        Err(e) => Err(e.to_string()),
    }
}

fn truncate_chars(s: &str, n: usize) -> String {
    if s.chars().count() > n {
        let cut: String = s.chars().take(n).collect();
        format!("{cut}...")
    } else {
        s.to_string()
    }
}

/// Chat-completions call made from Rust so the webview's CORS /
/// Local-Network-Access restrictions never apply (e.g. LAN gateways).
/// The API key stays in the credential store and never enters the frontend.
#[tauri::command]
async fn llm_chat(url: String, model: String, system: String, prompt: String) -> Result<String, String> {
    let key = read_key()?;
    let body = serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": prompt }
        ],
        "temperature": 0.1
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(180))
        .build()
        .map_err(|e| format!("初始化 HTTP 客户端失败: {e}"))?;

    let resp = client
        .post(&url)
        .bearer_auth(key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("无法连接 LLM 服务,请检查网络或服务地址是否正确。({e})"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "LLM 服务返回错误 {}: {}",
            status.as_u16(),
            truncate_chars(&text, 300)
        ));
    }

    let v: serde_json::Value =
        serde_json::from_str(&text).map_err(|_| "LLM 返回了非 JSON 内容。".to_string())?;
    let msg = &v["choices"][0]["message"];
    let content = msg["content"].as_str().unwrap_or("");
    // Reasoning models may leave content empty and put output in reasoning_content.
    let content = if content.trim().is_empty() {
        msg["reasoning_content"].as_str().unwrap_or("")
    } else {
        content
    };
    if content.trim().is_empty() {
        return Err("LLM 返回了空内容,请检查模型名称是否正确。".to_string());
    }
    Ok(content.to_string())
}

/// Store the LLM API key in the OS credential store
/// (Windows Credential Manager / macOS Keychain / libsecret).
#[tauri::command]
fn save_secret(secret: String) -> Result<(), String> {
    let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    entry.set_password(&secret).map_err(|e| e.to_string())
}

/// Returns None when no key has been stored yet.
#[tauri::command]
fn load_secret() -> Result<Option<String>, String> {
    let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn delete_secret() -> Result<(), String> {
    let entry = Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.set_focus();
            }
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_secret,
            load_secret,
            delete_secret,
            llm_chat
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
