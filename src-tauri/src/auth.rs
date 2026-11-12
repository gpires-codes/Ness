use std::io;

use tauri::State;

pub struct AuthState {
    token: String,
}

impl AuthState {
    pub fn generate() -> io::Result<Self> {
        let mut bytes = [0_u8; 32];
        getrandom::fill(&mut bytes).map_err(|error| io::Error::other(error.to_string()))?;
        let token = bytes.iter().map(|byte| format!("{byte:02x}")).collect();
        Ok(Self { token })
    }

    #[cfg(debug_assertions)]
    pub fn token(&self) -> &str {
        &self.token
    }
}

#[tauri::command]
pub fn get_api_token(state: State<'_, AuthState>) -> String {
    state.token.clone()
}
