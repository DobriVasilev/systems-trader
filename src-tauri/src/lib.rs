use serde::{Deserialize, Serialize};
use std::thread;
use std::sync::{Arc, Mutex};
use tauri::Emitter;

#[cfg(target_os = "macos")]
use security_framework::passwords::{set_generic_password, get_generic_password, delete_generic_password};

const SERVICE_NAME: &str = "com.hyperliquid.trader";
const ACCOUNT_NAME: &str = "vault_password";
const BRIDGE_PORT: u16 = 3456;

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
                // Execute trade from extension
                let mut body = String::new();
                if request.as_reader().read_to_string(&mut body).is_ok() {
                    println!("Received trade request: {}", body);
                    if let Ok(trade_request) = serde_json::from_str::<TradeRequest>(&body) {
                        println!("Executing trade: {:?}", trade_request);
                        // Emit event to frontend to execute the trade
                        match app_handle.emit("tradingview-execute-trade", trade_request) {
                            Ok(_) => {
                                println!("Trade execution event emitted");
                                let response = tiny_http::Response::from_string("{\"success\":true}")
                                    .with_header(cors_headers[0].clone())
                                    .with_header(tiny_http::Header::from_bytes(&b"Content-Type"[..], &b"application/json"[..]).unwrap());
                                let _ = request.respond(response);
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
            update_bridge_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
