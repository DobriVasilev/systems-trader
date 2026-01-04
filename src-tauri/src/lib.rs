use serde::{Deserialize, Serialize};
use std::thread;
use std::sync::{Arc, Mutex};
use tauri::Emitter;
use reqwest;

#[cfg(target_os = "macos")]
use security_framework::passwords::{set_generic_password, get_generic_password, delete_generic_password};


const SERVICE_NAME: &str = "com.hyperliquid.trader";
const ACCOUNT_NAME: &str = "vault_password";
const BRIDGE_PORT: u16 = 3456;

// ============ Biometric Authentication Result ============
#[derive(Debug, Serialize, Deserialize)]
pub struct BiometricResult {
    success: bool,
    available: bool,
    error: Option<String>,
}

// ============ macOS Touch ID Implementation ============
#[cfg(target_os = "macos")]
#[tauri::command]
fn check_biometric_available() -> BiometricResult {
    use std::process::Command;

    // Check if Touch ID is available by querying system_profiler
    let output = Command::new("bioutil")
        .args(["-r"])
        .output();

    let available = match output {
        Ok(out) => out.status.success(),
        Err(_) => {
            // bioutil not available, try alternative check
            // On Macs with Touch ID, this file exists
            std::path::Path::new("/usr/lib/pam/pam_tid.so.2").exists()
        }
    };

    BiometricResult {
        success: true,
        available,
        error: if available { None } else { Some("Touch ID not available".to_string()) },
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn authenticate_biometric(reason: String) -> BiometricResult {
    use std::process::Command;

    // First check if Touch ID is available
    let check = check_biometric_available();
    if !check.available {
        return BiometricResult {
            success: false,
            available: false,
            error: Some("Touch ID not available on this device".to_string()),
        };
    }

    // Use JXA (JavaScript for Automation) which handles ObjC async better than AppleScript
    let jxa_code = format!(
        r#"
ObjC.import('LocalAuthentication');
ObjC.import('Foundation');

var context = $.LAContext.alloc.init;
var error = Ref();

if (!context.canEvaluatePolicyError($.LAPolicyDeviceOwnerAuthenticationWithBiometrics, error)) {{
    'unavailable';
}} else {{
    var result = 'pending';
    context.evaluatePolicyLocalizedReasonReply(
        $.LAPolicyDeviceOwnerAuthenticationWithBiometrics,
        "{}",
        function(success, authError) {{
            result = success ? 'success' : 'failed';
        }}
    );
    // Wait for callback (JXA handles this synchronously for ObjC callbacks)
    delay(0.1);
    var timeout = 60;
    while (result === 'pending' && timeout > 0) {{
        delay(0.5);
        timeout -= 0.5;
    }}
    result;
}}
"#,
        reason.replace("\"", "\\\"").replace("'", "\\'")
    );

    let output = Command::new("osascript")
        .args(["-l", "JavaScript", "-e", &jxa_code])
        .output();

    match output {
        Ok(out) => {
            let result = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

            if result == "success" {
                BiometricResult {
                    success: true,
                    available: true,
                    error: None,
                }
            } else if result == "unavailable" {
                BiometricResult {
                    success: false,
                    available: false,
                    error: Some("Touch ID not available".to_string()),
                }
            } else {
                let error_msg = if !stderr.is_empty() {
                    format!("Touch ID error: {}", stderr)
                } else if result == "failed" {
                    "Touch ID cancelled or failed".to_string()
                } else {
                    format!("Touch ID returned: {}", result)
                };
                BiometricResult {
                    success: false,
                    available: true,
                    error: Some(error_msg),
                }
            }
        }
        Err(e) => BiometricResult {
            success: false,
            available: true,
            error: Some(format!("Failed to run authentication: {}", e)),
        },
    }
}

// ============ Windows Hello Implementation ============
#[cfg(target_os = "windows")]
#[tauri::command]
fn check_biometric_available() -> BiometricResult {
    use std::process::Command;

    // Check if Windows Hello is available using PowerShell
    let output = Command::new("powershell")
        .args(["-Command", r#"
            Add-Type -AssemblyName System.Runtime.WindowsRuntime
            $null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
            $result = [Windows.Security.Credentials.UI.UserConsentVerifier]::CheckAvailabilityAsync().GetAwaiter().GetResult()
            if ($result -eq 'Available') { 'available' } else { 'unavailable' }
        "#])
        .output();

    match output {
        Ok(out) => {
            let result = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
            BiometricResult {
                success: true,
                available: result.contains("available"),
                error: if result.contains("available") { None } else { Some("Windows Hello not configured".to_string()) },
            }
        }
        Err(_) => BiometricResult {
            success: true,
            available: false,
            error: Some("Could not check Windows Hello availability".to_string()),
        },
    }
}

#[cfg(target_os = "windows")]
#[tauri::command]
fn authenticate_biometric(reason: String) -> BiometricResult {
    use std::process::Command;

    // Use Windows Hello for authentication
    let script = format!(r#"
        Add-Type -AssemblyName System.Runtime.WindowsRuntime
        $null = [Windows.Security.Credentials.UI.UserConsentVerifier,Windows.Security.Credentials.UI,ContentType=WindowsRuntime]
        $result = [Windows.Security.Credentials.UI.UserConsentVerifier]::RequestVerificationAsync("{}").GetAwaiter().GetResult()
        if ($result -eq 'Verified') {{ 'success' }} else {{ 'failed' }}
    "#, reason.replace("\"", "`\""));

    let output = Command::new("powershell")
        .args(["-Command", &script])
        .output();

    match output {
        Ok(out) => {
            let result = String::from_utf8_lossy(&out.stdout).trim().to_lowercase();
            let stderr = String::from_utf8_lossy(&out.stderr).trim().to_string();

            if result.contains("success") {
                BiometricResult {
                    success: true,
                    available: true,
                    error: None,
                }
            } else {
                BiometricResult {
                    success: false,
                    available: true,
                    error: Some(if !stderr.is_empty() { stderr } else { "Authentication failed or cancelled".to_string() }),
                }
            }
        }
        Err(e) => BiometricResult {
            success: false,
            available: true,
            error: Some(format!("Failed to run Windows Hello: {}", e)),
        },
    }
}

// ============ Linux Implementation (using polkit/pkexec) ============
#[cfg(target_os = "linux")]
#[tauri::command]
fn check_biometric_available() -> BiometricResult {
    use std::process::Command;

    // Check if pkexec (polkit) is available - standard on most Linux distros
    let output = Command::new("which")
        .arg("pkexec")
        .output();

    let available = output.map(|o| o.status.success()).unwrap_or(false);

    BiometricResult {
        success: true,
        available,
        error: if available { None } else { Some("System authentication not available".to_string()) },
    }
}

#[cfg(target_os = "linux")]
#[tauri::command]
fn authenticate_biometric(reason: String) -> BiometricResult {
    use std::process::Command;

    // Use zenity or kdialog for password prompt with system auth
    // Try zenity first (GTK), then kdialog (KDE)
    let zenity_result = Command::new("zenity")
        .args(["--password", "--title", &reason])
        .output();

    if let Ok(output) = zenity_result {
        if output.status.success() {
            // User entered password - verify with sudo -v
            let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let verify = Command::new("sh")
                .args(["-c", &format!("echo '{}' | sudo -S -v 2>/dev/null", password)])
                .output();

            if verify.map(|v| v.status.success()).unwrap_or(false) {
                return BiometricResult {
                    success: true,
                    available: true,
                    error: None,
                };
            }
        }
    }

    // Try kdialog as fallback
    let kdialog_result = Command::new("kdialog")
        .args(["--password", &reason])
        .output();

    if let Ok(output) = kdialog_result {
        if output.status.success() {
            let password = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let verify = Command::new("sh")
                .args(["-c", &format!("echo '{}' | sudo -S -v 2>/dev/null", password)])
                .output();

            if verify.map(|v| v.status.success()).unwrap_or(false) {
                return BiometricResult {
                    success: true,
                    available: true,
                    error: None,
                };
            }
        }
    }

    BiometricResult {
        success: false,
        available: true,
        error: Some("Authentication failed or cancelled".to_string()),
    }
}

// Cross-platform secure storage path for Windows/Linux
#[cfg(not(target_os = "macos"))]
fn get_secure_storage_path() -> std::path::PathBuf {
    let mut path = dirs::config_dir().unwrap_or_else(|| std::path::PathBuf::from("."));
    path.push("hyperliquid-trader");
    std::fs::create_dir_all(&path).ok();
    path.push(".vault");
    path
}

// Shared settings state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeSettings {
    pub risk: f64,
    pub leverage: u32,
    pub asset: String,
    pub price: f64,
}

impl Default for BridgeSettings {
    fn default() -> Self {
        BridgeSettings { risk: 1.0, leverage: 25, asset: "BTC".to_string(), price: 0.0 }
    }
}

// Trade result from frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TradeResult {
    pub success: bool,
    pub error: Option<String>,
}

// Pending trade result channel
use std::sync::mpsc::{channel, Sender};
static TRADE_RESULT_SENDER: std::sync::OnceLock<Mutex<Option<Sender<TradeResult>>>> = std::sync::OnceLock::new();

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PositionData {
    direction: String,
    entry: f64,
    #[serde(rename = "stopLoss")]
    stop_loss: f64,
    #[serde(rename = "takeProfit")]
    take_profit: Option<f64>,
    timestamp: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TradeRequest {
    direction: String,
    entry: f64,
    #[serde(rename = "stopLoss")]
    stop_loss: f64,
    #[serde(rename = "takeProfit")]
    take_profit: Option<f64>,
    risk: f64,
    leverage: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeychainResult {
    success: bool,
    error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct KeychainGetResult {
    success: bool,
    password: Option<String>,
    error: Option<String>,
}

// ============ macOS Keychain Implementation ============
#[cfg(target_os = "macos")]
#[tauri::command]
fn keychain_save(password: String) -> KeychainResult {
    let _ = delete_generic_password(SERVICE_NAME, ACCOUNT_NAME);

    match set_generic_password(SERVICE_NAME, ACCOUNT_NAME, password.as_bytes()) {
        Ok(()) => KeychainResult {
            success: true,
            error: None,
        },
        Err(e) => KeychainResult {
            success: false,
            error: Some(format!("Failed to save: {}", e)),
        },
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn keychain_load() -> KeychainGetResult {
    match get_generic_password(SERVICE_NAME, ACCOUNT_NAME) {
        Ok(password_bytes) => {
            match String::from_utf8(password_bytes.to_vec()) {
                Ok(password) => KeychainGetResult {
                    success: true,
                    password: Some(password),
                    error: None,
                },
                Err(e) => KeychainGetResult {
                    success: false,
                    password: None,
                    error: Some(format!("Invalid UTF-8: {}", e)),
                },
            }
        },
        Err(e) => {
            let error_string = e.to_string();
            if error_string.contains("not found") || error_string.contains("-25300") {
                KeychainGetResult {
                    success: false,
                    password: None,
                    error: Some("No password stored".to_string()),
                }
            } else {
                KeychainGetResult {
                    success: false,
                    password: None,
                    error: Some(format!("Failed to load: {}", e)),
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn keychain_delete() -> KeychainResult {
    match delete_generic_password(SERVICE_NAME, ACCOUNT_NAME) {
        Ok(()) => KeychainResult {
            success: true,
            error: None,
        },
        Err(e) => {
            let error_string = e.to_string();
            if error_string.contains("not found") || error_string.contains("-25300") {
                KeychainResult {
                    success: true,
                    error: None,
                }
            } else {
                KeychainResult {
                    success: false,
                    error: Some(format!("Failed to delete: {}", e)),
                }
            }
        }
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn keychain_has_password() -> bool {
    get_generic_password(SERVICE_NAME, ACCOUNT_NAME).is_ok()
}

// ============ Windows/Linux File-based Implementation ============
#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn keychain_save(password: String) -> KeychainResult {
    let path = get_secure_storage_path();
    match std::fs::write(&path, password.as_bytes()) {
        Ok(()) => {
            // Try to set restrictive permissions on Unix-like systems
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                let _ = std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600));
            }
            KeychainResult {
                success: true,
                error: None,
            }
        }
        Err(e) => KeychainResult {
            success: false,
            error: Some(format!("Failed to save: {}", e)),
        },
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn keychain_load() -> KeychainGetResult {
    let path = get_secure_storage_path();
    match std::fs::read_to_string(&path) {
        Ok(password) => KeychainGetResult {
            success: true,
            password: Some(password),
            error: None,
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                KeychainGetResult {
                    success: false,
                    password: None,
                    error: Some("No password stored".to_string()),
                }
            } else {
                KeychainGetResult {
                    success: false,
                    password: None,
                    error: Some(format!("Failed to load: {}", e)),
                }
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn keychain_delete() -> KeychainResult {
    let path = get_secure_storage_path();
    match std::fs::remove_file(&path) {
        Ok(()) => KeychainResult {
            success: true,
            error: None,
        },
        Err(e) => {
            if e.kind() == std::io::ErrorKind::NotFound {
                KeychainResult {
                    success: true,
                    error: None,
                }
            } else {
                KeychainResult {
                    success: false,
                    error: Some(format!("Failed to delete: {}", e)),
                }
            }
        }
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn keychain_has_password() -> bool {
    get_secure_storage_path().exists()
}

/// Update bridge settings from frontend
#[tauri::command]
fn update_bridge_settings(state: tauri::State<Arc<Mutex<BridgeSettings>>>, risk: f64, leverage: u32, asset: String, price: f64) {
    let mut settings = state.lock().unwrap();
    settings.risk = risk;
    settings.leverage = leverage;
    settings.asset = asset;
    settings.price = price;
}

/// Report trade result from frontend back to HTTP server
#[tauri::command]
fn report_trade_result(success: bool, error: Option<String>) {
    let result = TradeResult { success, error };
    if let Some(sender_lock) = TRADE_RESULT_SENDER.get() {
        if let Ok(guard) = sender_lock.lock() {
            if let Some(sender) = guard.as_ref() {
                let _ = sender.send(result);
            }
        }
    }
}

// ============ HTTP Proxy for CORS bypass ============
#[derive(Debug, Serialize, Deserialize)]
pub struct HttpResponse {
    success: bool,
    data: Option<String>,
    error: Option<String>,
    status: u16,
}

/// HTTP GET request - bypasses CORS by making request from Rust
#[tauri::command]
async fn http_get(url: String) -> HttpResponse {
    match reqwest::get(&url).await {
        Ok(response) => {
            let status = response.status().as_u16();
            match response.text().await {
                Ok(text) => HttpResponse {
                    success: status >= 200 && status < 300,
                    data: Some(text),
                    error: None,
                    status,
                },
                Err(e) => HttpResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to read response: {}", e)),
                    status,
                },
            }
        }
        Err(e) => HttpResponse {
            success: false,
            data: None,
            error: Some(format!("Request failed: {}", e)),
            status: 0,
        },
    }
}

/// HTTP POST request - bypasses CORS
#[tauri::command]
async fn http_post(url: String, body: String) -> HttpResponse {
    let client = reqwest::Client::new();
    match client.post(&url)
        .header("Content-Type", "application/json")
        .body(body)
        .send()
        .await {
        Ok(response) => {
            let status = response.status().as_u16();
            match response.text().await {
                Ok(text) => HttpResponse {
                    success: status >= 200 && status < 300,
                    data: Some(text),
                    error: None,
                    status,
                },
                Err(e) => HttpResponse {
                    success: false,
                    data: None,
                    error: Some(format!("Failed to read response: {}", e)),
                    status,
                },
            }
        }
        Err(e) => HttpResponse {
            success: false,
            data: None,
            error: Some(format!("Request failed: {}", e)),
            status: 0,
        },
    }
}

/// Start the TradingView bridge HTTP server
fn start_bridge_server(app_handle: tauri::AppHandle, settings: Arc<Mutex<BridgeSettings>>) {
    thread::spawn(move || {
        let server = match tiny_http::Server::http(format!("127.0.0.1:{}", BRIDGE_PORT)) {
            Ok(s) => s,
            Err(e) => {
                eprintln!("Failed to start bridge server: {}", e);
                return;
            }
        };

        println!("TradingView bridge listening on port {}", BRIDGE_PORT);

        for mut request in server.incoming_requests() {
            let url = request.url().to_string();

            // CORS headers for browser extension
            let cors_headers = vec![
                tiny_http::Header::from_bytes(&b"Access-Control-Allow-Origin"[..], &b"*"[..]).unwrap(),
                tiny_http::Header::from_bytes(&b"Access-Control-Allow-Methods"[..], &b"GET, POST, OPTIONS"[..]).unwrap(),
                tiny_http::Header::from_bytes(&b"Access-Control-Allow-Headers"[..], &b"Content-Type"[..]).unwrap(),
            ];

            // Handle preflight OPTIONS request
            if request.method() == &tiny_http::Method::Options {
                let response = tiny_http::Response::empty(200).with_header(cors_headers[0].clone())
                    .with_header(cors_headers[1].clone())
                    .with_header(cors_headers[2].clone());
                let _ = request.respond(response);
                continue;
            }

            // GET /settings - return current settings
            if url == "/settings" && request.method() == &tiny_http::Method::Get {
                let current_settings = settings.lock().unwrap().clone();
                let json = serde_json::to_string(&current_settings).unwrap_or_else(|_| r#"{"risk":1,"leverage":25}"#.to_string());
                let response = tiny_http::Response::from_string(json)
                    .with_header(cors_headers[0].clone())
                    .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                let _ = request.respond(response);
                continue;
            }

            if url == "/position" && request.method() == &tiny_http::Method::Post {
                // Read body
                let mut body = String::new();
                if request.as_reader().read_to_string(&mut body).is_ok() {
                    println!("Received position data: {}", body);
                    if let Ok(position_data) = serde_json::from_str::<PositionData>(&body) {
                        println!("Parsed position: {:?}", position_data);
                        // Emit event to frontend
                        match app_handle.emit("tradingview-position", position_data) {
                            Ok(_) => println!("Event emitted successfully"),
                            Err(e) => println!("Failed to emit event: {}", e),
                        }
                    } else {
                        println!("Failed to parse position data");
                    }
                }

                let response = tiny_http::Response::from_string("OK")
                    .with_header(cors_headers[0].clone());
                let _ = request.respond(response);
            } else if url == "/position-closed" && request.method() == &tiny_http::Method::Post {
                // Emit close event to frontend
                let _ = app_handle.emit("tradingview-position-closed", ());

                let response = tiny_http::Response::from_string("OK")
                    .with_header(cors_headers[0].clone());
                let _ = request.respond(response);
            } else if url == "/execute-trade" && request.method() == &tiny_http::Method::Post {
                // Execute trade from extension - wait for actual result
                let mut body = String::new();
                if request.as_reader().read_to_string(&mut body).is_ok() {
                    println!("Received trade request: {}", body);
                    if let Ok(trade_request) = serde_json::from_str::<TradeRequest>(&body) {
                        println!("Executing trade: {:?}", trade_request);

                        // Create channel for this trade result
                        let (tx, rx) = channel::<TradeResult>();

                        // Store sender for frontend to use
                        if let Some(sender_lock) = TRADE_RESULT_SENDER.get() {
                            if let Ok(mut guard) = sender_lock.lock() {
                                *guard = Some(tx);
                            }
                        } else {
                            let _ = TRADE_RESULT_SENDER.set(Mutex::new(Some(tx)));
                        }

                        // Emit event to frontend to execute the trade
                        match app_handle.emit("tradingview-execute-trade", trade_request) {
                            Ok(_) => {
                                println!("Trade execution event emitted, waiting for result...");

                                // Wait for result with 60 second timeout (Drift on-chain txs can be slow)
                                use std::time::Duration;
                                match rx.recv_timeout(Duration::from_secs(60)) {
                                    Ok(result) => {
                                        println!("Trade result received: {:?}", result);
                                        let response_body = if result.success {
                                            "{\"success\":true}".to_string()
                                        } else {
                                            let error = result.error.unwrap_or_else(|| "Trade failed".to_string());
                                            // Escape quotes in error message for JSON
                                            let escaped = error.replace("\"", "\\\"");
                                            format!("{{\"success\":false,\"error\":\"{}\"}}", escaped)
                                        };
                                        let response = tiny_http::Response::from_string(response_body)
                                            .with_header(cors_headers[0].clone())
                                            .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                                        let _ = request.respond(response);
                                    }
                                    Err(_) => {
                                        println!("Trade result timeout");
                                        let response = tiny_http::Response::from_string("{\"success\":false,\"error\":\"Trade execution timeout\"}")
                                            .with_status_code(408)
                                            .with_header(cors_headers[0].clone())
                                            .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                                        let _ = request.respond(response);
                                    }
                                }
                            }
                            Err(e) => {
                                println!("Failed to emit trade event: {}", e);
                                let response = tiny_http::Response::from_string(format!("{{\"success\":false,\"error\":\"{}\"}}", e))
                                    .with_status_code(500)
                                    .with_header(cors_headers[0].clone());
                                let _ = request.respond(response);
                            }
                        }
                    } else {
                        println!("Failed to parse trade request");
                        let response = tiny_http::Response::from_string("{\"success\":false,\"error\":\"Invalid request\"}")
                            .with_status_code(400)
                            .with_header(cors_headers[0].clone());
                        let _ = request.respond(response);
                    }
                } else {
                    let response = tiny_http::Response::from_string("{\"success\":false,\"error\":\"Failed to read body\"}")
                        .with_status_code(400)
                        .with_header(cors_headers[0].clone());
                    let _ = request.respond(response);
                }
            } else {
                let response = tiny_http::Response::from_string("Not Found")
                    .with_status_code(404)
                    .with_header(cors_headers[0].clone());
                let _ = request.respond(response);
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Create shared settings state
    let bridge_settings = Arc::new(Mutex::new(BridgeSettings::default()));
    let bridge_settings_clone = bridge_settings.clone();

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .manage(bridge_settings)
        .setup(move |app| {
            // Start the TradingView bridge server with shared settings
            start_bridge_server(app.handle().clone(), bridge_settings_clone.clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            keychain_save,
            keychain_load,
            keychain_delete,
            keychain_has_password,
            update_bridge_settings,
            report_trade_result,
            check_biometric_available,
            authenticate_biometric,
            http_get,
            http_post
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
