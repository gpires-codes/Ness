use std::{process::Child, sync::Mutex};

#[cfg(debug_assertions)]
use std::{
    error::Error,
    io,
    net::{SocketAddr, TcpStream},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
    time::{Duration, Instant},
};

pub struct ApiProcess {
    child: Mutex<Option<Child>>,
}

impl ApiProcess {
    fn new(child: Option<Child>) -> Self {
        Self {
            child: Mutex::new(child),
        }
    }

    #[cfg(not(debug_assertions))]
    pub fn empty() -> Self {
        Self::new(None)
    }
}

#[cfg(debug_assertions)]
pub fn start(token: &str) -> Result<ApiProcess, Box<dyn Error>> {
    let api_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("ness-api");
    if !api_dir.is_dir() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            format!("Ness API directory not found: {}", api_dir.display()),
        )
        .into());
    }

    let python = Command::new("uv")
        .args(["run", "--directory"])
        .arg(&api_dir)
        .args(["python", "-c", "import sys; print(sys.executable)"])
        .output()
        .map_err(|error| {
            io::Error::new(
                error.kind(),
                format!("Could not find the Ness API Python environment with `uv`: {error}"),
            )
        })?;
    if !python.status.success() {
        return Err(io::Error::other(format!(
            "`uv` could not prepare the Ness API environment: {}",
            String::from_utf8_lossy(&python.stderr).trim()
        ))
        .into());
    }

    let python_path = String::from_utf8(python.stdout)
        .map_err(|error| io::Error::new(io::ErrorKind::InvalidData, error))?;
    let python_path = Path::new(python_path.trim());
    if !python_path.is_file() {
        return Err(io::Error::new(
            io::ErrorKind::NotFound,
            "The Ness API Python executable was not found",
        )
        .into());
    }

    let mut child = Command::new(python_path)
        .args(["-m", "ness_api.main"])
        .current_dir(&api_dir)
        .env("NESS_TOKEN", token)
        .env("NESS_PORT", "8000")
        .env("NESS_DEV", "0")
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
        .map_err(|error| {
            io::Error::new(
                error.kind(),
                format!(
                    "Could not start Ness API with '{}': {error}",
                    python_path.display()
                ),
            )
        })?;

    if let Err(error) = wait_for_api(&mut child) {
        match child.try_wait() {
            Ok(Some(_)) => {}
            Ok(None) => {
                if let Err(kill_error) = child.kill() {
                    eprintln!("Could not stop Ness API after startup failure: {kill_error}");
                }
                if let Err(wait_error) = child.wait() {
                    eprintln!("Could not wait for Ness API to stop: {wait_error}");
                }
            }
            Err(wait_error) => {
                eprintln!("Could not check Ness API after startup failure: {wait_error}")
            }
        }
        return Err(error.into());
    }

    Ok(ApiProcess::new(Some(child)))
}

#[cfg(debug_assertions)]
fn wait_for_api(child: &mut Child) -> io::Result<()> {
    let address = SocketAddr::from(([127, 0, 0, 1], 8000));
    let deadline = Instant::now() + Duration::from_secs(15);

    loop {
        if let Some(status) = child.try_wait()? {
            return Err(io::Error::other(format!(
                "Ness API exited during startup with status {status}"
            )));
        }

        if TcpStream::connect_timeout(&address, Duration::from_millis(100)).is_ok() {
            thread::sleep(Duration::from_millis(200));
            if let Some(status) = child.try_wait()? {
                return Err(io::Error::other(format!(
                    "Ness API exited during startup with status {status}"
                )));
            }
            return Ok(());
        }

        if Instant::now() >= deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "Ness API did not start listening within 15 seconds",
            ));
        }

        thread::sleep(Duration::from_millis(100));
    }
}

pub fn stop(state: &ApiProcess) {
    let mut child = match state.child.lock() {
        Ok(child) => child,
        Err(error) => {
            eprintln!("Could not access Ness API process during shutdown: {error}");
            return;
        }
    };

    if let Some(mut child) = child.take() {
        match child.try_wait() {
            Ok(Some(_)) => {}
            Ok(None) => {
                if let Err(error) = child.kill() {
                    eprintln!("Could not stop Ness API process: {error}");
                }
                if let Err(error) = child.wait() {
                    eprintln!("Could not wait for Ness API process to stop: {error}");
                }
            }
            Err(error) => eprintln!("Could not check Ness API process: {error}"),
        }
    }
}
