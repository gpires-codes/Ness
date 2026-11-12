mod api_process;
mod auth;

use std::io;

use tauri::{Manager, RunEvent};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::Builder::new().build());
    }

    let app = builder
        .invoke_handler(tauri::generate_handler![auth::get_api_token])
        .setup(|app| {
            let auth_state = auth::AuthState::generate()?;
            #[cfg(debug_assertions)]
            let api_state = api_process::start(auth_state.token())?;
            #[cfg(not(debug_assertions))]
            let api_state = api_process::ApiProcess::empty();

            if !app.manage(auth_state) || !app.manage(api_state) {
                return Err(
                    io::Error::other("Ness application state was already registered").into(),
                );
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|app_handle, event| {
        if matches!(event, RunEvent::Exit) {
            api_process::stop(&app_handle.state::<api_process::ApiProcess>());
        }
    });
}
