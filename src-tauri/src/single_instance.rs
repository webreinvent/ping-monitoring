//! Robust single-instance guard for Windows.
//!
//! `tauri-plugin-single-instance` has a fall-through on Windows: when the
//! named mutex already exists but `FindWindowW` cannot locate the primary
//! instance's hidden event-target window (a startup race, a slow first boot,
//! or repeated launches while the app is still coming up), the second
//! instance does NOT exit. It falls through into the full app setup — showing
//! a main window and starting a fresh set of `ping` probes. Every such
//! duplicate adds another visible window and another batch of `ping`
//! processes, which is what produces the "many stacked windows + system
//! hang" symptom.
//!
//! This guard runs **before** the plugin and ALWAYS exits a detected
//! duplicate, closing that gap. On non-Windows platforms it is a no-op: the
//! plugin's Unix-domain-socket mechanism is reliable there (a failed connect
//! is an error, not a silent fall-through).

#[cfg(target_os = "windows")]
mod windows {
    use windows_sys::Win32::{
        Foundation::{GetLastError, ERROR_ALREADY_EXISTS},
        System::{
            DataExchange::COPYDATASTRUCT,
            Threading::CreateMutexW,
        },
        UI::WindowsAndMessaging::{FindWindowW, SendMessageW, WM_COPYDATA},
    };

    /// Matches `tauri-plugin-single-instance`'s copy-data id, so the primary
    /// instance's hidden event-target window routes the message to its
    /// callback (which surfaces the main window).
    const COPYDATA_ID: usize = 1542;

    fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    /// Returns `true` if this process is the primary instance and should
    /// continue; `false` if a duplicate was detected (the caller must exit).
    ///
    /// `identifier` is the Tauri app identifier (from `tauri.conf.json`). It
    /// is used to (a) name this guard's own mutex and (b) locate the plugin's
    /// event-target window so the primary can be asked to show its window.
    pub fn ensure_single_instance(identifier: &str) -> bool {
        let mutex_name = wide(&format!("{identifier}-lnpm-guard"));
        let _handle = unsafe { CreateMutexW(std::ptr::null_mut(), 1, mutex_name.as_ptr()) };
        // `_handle` is intentionally never closed: the OS releases it on
        // process exit, which keeps the named mutex alive for the lifetime of
        // this process (so a later launch is correctly seen as a duplicate).

        if unsafe { GetLastError() } == ERROR_ALREADY_EXISTS {
            // A primary instance is already running. Ask it (via the plugin's
            // hidden event-target window) to surface its main window, then
            // exit. This is best-effort: if the window is not (yet) found we
            // still exit — the primary shows its own window on startup, and
            // the tray icon is always available.
            let class = wide(&format!("{identifier}-sic"));
            let name = wide(&format!("{identifier}-siw"));
            let hwnd = unsafe { FindWindowW(class.as_ptr(), name.as_ptr()) };
            if !hwnd.is_null() {
                let cwd = std::env::current_dir()
                    .map(|p| p.to_string_lossy().into_owned())
                    .unwrap_or_default();
                let payload = format!("{cwd}|\0");
                let bytes = payload.as_bytes();
                let cds = COPYDATASTRUCT {
                    dwData: COPYDATA_ID,
                    cbData: bytes.len() as u32,
                    lpData: bytes.as_ptr() as *mut _,
                };
                unsafe { SendMessageW(hwnd, WM_COPYDATA, 0, &cds as *const _ as _) };
            }
            false
        } else {
            true
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod windows {
    /// Non-Windows: the single-instance plugin's Unix-socket mechanism is
    /// reliable, so this guard is a no-op.
    pub fn ensure_single_instance(_identifier: &str) -> bool {
        true
    }
}

pub use self::windows::ensure_single_instance;
