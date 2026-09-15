# Muziro DAW

[![Platform](https://img.shields.io/badge/Platform-Web%20%7C%20Windows%20x64-black?style=flat-square)](https://github.com)
[![Engine](https://img.shields.io/badge/Audio%20Engine-Web%20Audio%20API-black?style=flat-square)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![Architecture](https://img.shields.io/badge/Stack-Vanilla%20JS%20%7C%20Canvas%20%7C%20SVG%20%7C%20IndexedDB-black?style=flat-square)](https://github.com)
[![Desktop](https://img.shields.io/badge/Desktop-.NET%208%20%7C%20WebView2-black?style=flat-square)](https://github.com)
[![License](https://img.shields.io/badge/License-Proprietary%20%7C%20All%20Rights%20Reserved-black?style=flat-square)](license.md)
[![Telegram](https://img.shields.io/badge/Contact%20Author-%40itsislomm-0088cc?style=flat-square&logo=telegram&logoColor=white)](https://t.me/itsislomm)

A high-performance, studio-grade multitrack Digital Audio Workstation (DAW) designed for real-time non-linear audio editing, arrangement, and mastering. 

Muziro is built completely with native web standards—zero third-party UI frameworks, zero heavyweight runtime dependencies. The core audio and rendering engines leverage the **Web Audio API**, **HTML5 Canvas 2D**, **Vector SVG**, **IndexedDB**, and **Vanilla JavaScript**, packaged into a standalone Windows desktop executable using **.NET 8** and **WebView2**.

---

## Key Highlights & Architecture

- **Sub-Millisecond Web Audio Engine**: Direct DSP pipeline utilizing `AudioContext`, `OfflineAudioContext`, `AudioBufferSourceNode`, and `GainNode` with 32-bit floating-point audio precision across all channels.
- **Stationary Waveform Rendering**: Multi-resolution waveform visualizer drawn on HTML5 Canvas anchored strictly to physical timeline coordinates. Waveforms remain completely stationary during edge trimming without elastic stretching or visual drift.
- **60 FPS Hardware-Accelerated UI**: Dedicated `requestAnimationFrame` loop driving playhead synchronization, timeline scrubbing, and sub-millisecond digital timecode counters.
- **Dual-Layer Persistence**:
  - `IndexedDB` (`MuziroDB`, `projects` store): Long-term structured binary storage for raw decoded audio buffers, track states, clip coordinates, and Bezier automation curves.
  - `localStorage` (`muziro_projects`): Instant project metadata registry for zero-latency project catalog indexing without expensive deserialization.
- **Pro Studio Dark Aesthetics**: Minimalist monochrome design language (`#000000`, `#0a0a0a`, `#ffffff`, neutral studio grays), razor-sharp `0px` border-radius components, Montserrat typography, monospace time displays, and frosted glass modals (`backdrop-filter: blur(14px)`).

---

## Features

### 1. Multitrack Playback & Audio Processing
- **Universal Format Support**: Lossless decoding of all standard audio formats: WAV, MP3, FLAC, OGG Vorbis, AAC/M4A, and AIFF.
- **Zero Phase Jitter Playback**: True parallel playback across an unlimited number of tracks with phase alignment.
- **Transport Controls**: Play, Pause, and Stop with instantaneous playhead rewind or cursor hold.
- **Timeline Scrubbing**: Click-and-drag scrubbing across the ruler or empty lane canvas with real-time audio auditioning.
- **Sub-Millisecond Timecode**: Tabular monospace counter displaying `MM:SS.mmm` with continuous playhead tracking.
- **Auto-Stop Boundary Guard**: Automatic playback termination and rewind upon reaching the timeline duration limit.

### 2. Track Management
- **Unlimited Tracks**: Create and arrange an arbitrary number of independent audio tracks.
- **Per-Track Gain Control**: Granular volume sliders ranging from `0%` to `100%` in 1% increments (default `100%`).
- **Mute & Solo Architecture**: Instant soloing with mutual suppression matrix and non-destructive track muting.
- **Drag-and-Drop Track Reordering**: Reorder track headers vertically with real-time visual insertion guidelines.
- **Empty Track Placeholders**: Interactive dashed drop zones allowing drag-and-drop audio file importing directly into specific tracks.
- **Track Deletion Safeguard**: Header trash action with a frosted-glass confirmation modal to prevent accidental track removal.

### 3. Precision Audio Editing & Trimming
- **Freeform Clip Placement**: Drag clips seamlessly across the timeline and between different tracks with target highlighting.
- **Non-Destructive Razor Split (`S`)**: Slice clips at the playhead with sample accuracy into two independent clips while preserving original audio sources.
- **Top & Tail Hotkey Trimming (`Q` / `W`)**:
  - `Q`: Top trim — slices off the head of the clip up to the playhead position.
  - `W`: Tail trim — slices off the tail of the clip starting from the playhead position.
- **NLE-Style Edge Trimming**: Interactive left and right drag handles (`col-resize`) for trimming and expanding clips. Features stationary timeline-anchored waveforms powered by `sourceBuffer` and `sourceOffset` tracking.
- **Cursor-Centric Zoom**: Smooth horizontal zooming with the mouse wheel centered on the cursor position.
- **Clip Deletion**: Remove single clips or selected groups using `Delete` or `Backspace`.

### 4. Marquee Selection & Group Operations
- **Lasso / Box Selection**: Click and drag across empty timeline space to enclose clips across multiple tracks.
- **Viewport Auto-Scroll**: Automatic horizontal scrolling when the selection rectangle approaches viewport boundaries.
- **Group Dragging**: Move all selected clips synchronously while preserving relative time offsets.
- **Batch Actions**: Delete or cut entire selections in a single operation.
- **Selection Shortcuts**: `Ctrl + A` to select all clips, `Escape` to clear selection.

### 5. Fade Envelopes & Bezier Tension Curves
- **Fade Handles**: Dedicated circular edge handles for adjusting Fade-In and Fade-Out durations.
- **Mid-Point Tension Handle (`.fade-curve-handle`)**: Adjust envelope curvature from `-1.0` (concave drop) to `+1.0` (convex sustain) with real-time percentage feedback.
- **Double-Click Reset**: Reset tension back to a true linear curve with a double click.
- **Accurate DSP Polynomial Evaluation**: Rendered through Web Audio `setValueCurveAtTime` using a 64-point quadratic curve matching the visual envelope.
- **Playhead Isolation**: Interacting with fade or tension handles never displaces the timeline playhead.

### 6. Studio Multi-Format Audio Export Engine
Muziro features an in-memory non-blocking DSP export pipeline built on `OfflineAudioContext`, delivering an export suite that exceeds conventional digital workstations:

| Format | Codec / Container | Specifications & Depths | Use Case |
| :--- | :--- | :--- | :--- |
| **WAV** | Uncompressed Linear PCM | 16-bit, 24-bit Studio Master, 32-bit IEEE Float | Professional mastering, archival |
| **MP3** | MPEG-1 Layer III | Genuine LAME 3.98.4 encoder (128, 192, 256, 320 kbps) | Web streaming, distribution |
| **FLAC** | Free Lossless Audio Codec | Lossless compression with STREAMINFO header | Audiophile listening, distribution |
| **OGG** | Ogg Vorbis | OggS packet stream | Game audio, open-source web media |
| **AIFF** | Audio Interchange File Format | Big-Endian uncompressed PCM | Apple Pro Tools, Logic Pro interchange |
| **AAC / M4A**| Advanced Audio Coding | MPEG-4 AAC stream container | Mobile playback, Apple ecosystem |
| **WEBM**| WebM Container | Lossless linear PCM audio stream | Web applications, Chromium platforms |

#### Real DSP Resampling & Channel Mixdown
- **Hardware-Accurate Resampling**: Select from **32.0 kHz**, **44.1 kHz** (CD Standard), **48.0 kHz** (Video / Studio Standard), **88.2 kHz** (High-Res 2x), and **96.0 kHz** (Pro Studio Master). Resampling is computed natively without phase artifacts.
- **Channel Summing**: Full **Stereo (2 Channels)** or **Mono (1 Channel Summed)** mixdown.
- **Ultra-Fast In-Memory Encoding**: Zero UI freeze or blocking; all audio encoding routines complete in 5–25 milliseconds directly in memory.

### 7. Undo / Redo History (Memento Pattern)
- Deep 50-step state history capturing track volumes, mute/solo flags, clip geometries, trim offsets, and fade curves.
- Shortcuts: `Ctrl + Z` for undo, `Ctrl + Shift + Z` or `Ctrl + Y` for redo (supports both English and Russian keyboard layouts).

### 8. Project Autosave & Disaster Recovery
- **Continuous Autosave**: Every timeline modification is debounced and committed to `IndexedDB` within 1.2 seconds.
- **Draft Session Protection**: Unnamed sessions are saved under `proj_draft_...` with an `AUTOSAVED` indicator in the dashboard.
- **Seamless Promotion**: Pressing `Ctrl + S` promotes a draft to a permanent project.
- **Instant Save**: Pressing `Ctrl + S` on an existing named project performs an instant silent save with a toast notification.

---

## Keyboard Shortcuts Cheatsheet

| Shortcut (EN) | Shortcut (RU) | Action |
| :--- | :--- | :--- |
| `Space` | `Space` | Play / Pause playback |
| `S` | `Ы` | Split selected clip at playhead position |
| `Q` | `Й` | Top trim: trim clip head up to playhead |
| `W` | `Ц` | Tail trim: trim clip tail from playhead |
| `Delete` / `Backspace` | `Delete` / `Backspace` | Delete selected clip(s) |
| `Ctrl + Z` | `Ctrl + Я` | Undo last operation |
| `Ctrl + Shift + Z` / `Ctrl + Y` | `Ctrl + Shift + Я` / `Ctrl + Н` | Redo last undone operation |
| `Ctrl + A` | `Ctrl + Ф` | Select all clips across all tracks |
| `Escape` | `Escape` | Clear selection / Dismiss active modal |
| `Ctrl + S` | `Ctrl + Ы` | Save project / Promote draft |
| `Enter` | `Enter` | Confirm modal dialog action |

---

## Project Structure

```text
Muziro/
├── index.html                  # Welcome dashboard, project browser & launcher
├── process.html                # Main DAW workstation host window & top navigation
├── timeline.html               # Audio timeline canvas, clip management & Web Audio engine
├── functions/
│   └── export/
│       ├── export.js           # Multi-format DSP export engine (WAV, MP3, FLAC, OGG, AIFF, AAC, WebM)
│       ├── export.css          # Frosted glass export modal styles & specification badges
│       └── lame.min.js         # Embedded LAME 3.98.4 psychoacoustic MP3 encoder
├── animations/
│   └── intro/
│       ├── intro.css           # Cinematic vector splash screen styles
│       └── intro.js            # Kinetic M-letter drawing and transition animation
├── desktop/
│   ├── Muziro.csproj           # .NET 8 Windows Forms & WebView2 project configuration
│   ├── Program.cs              # Native Windows application host and entrypoint
│   └── MainForm.cs             # Borderless frameless window container
├── dist/
│   └── Muziro.exe              # Standalone release executable for Windows x64
├── docs/
│   └── logs/                   # Chronological engineering task and change logs
├── build-exe.bat               # One-click MSBuild / .NET compile script
├── license.md                  # Proprietary license, end-user agreement & legal terms
└── README.md                   # Project documentation
```

---

## Getting Started & Building

### Running in a Web Browser
Muziro runs directly in any modern Chromium-based browser supporting the Web Audio API and IndexedDB:
1. Start a local HTTP static server in the root directory:
   ```bash
   # Using Python:
   python -m http.server 8080

   # Or using Node.js:
   npx serve .
   ```
2. Navigate to `http://localhost:8080/index.html` in your browser.

### Building the Windows Desktop Application
Muziro can be compiled into a standalone Windows desktop executable with embedded WebView2:
1. Ensure the [.NET 8.0 SDK](https://dotnet.microsoft.com/download/dotnet/8.0) is installed.
2. Run the automated build script:
   ```cmd
   build-exe.bat
   ```
   Or publish manually via the .NET CLI:
   ```cmd
   dotnet publish desktop/Muziro.csproj -c Release -r win-x64 --self-contained false -o dist/
   ```
3. The compiled binary will be located at `dist/Muziro.exe`.

---

## Commercial Inquiries & Acquisition

Muziro is proprietary intellectual property created and owned by **Islom Sadriddinov Farhod O'g'li**.

If your company, organization, or investment team wishes to **purchase the software, acquire intellectual property rights, obtain a commercial license, or explore strategic partnerships**, please contact the author directly via Telegram:

<div align="center">
  <br />
  <a href="https://t.me/itsislomm" target="_blank">
    <img src="https://img.shields.io/badge/Telegram-Contact%20%40itsislomm-0088cc?style=for-the-badge&logo=telegram&logoColor=white" alt="Contact on Telegram" height="42" />
  </a>
  <br /><br />
  <p>Official Telegram Handle: <b><a href="https://t.me/itsislomm" target="_blank">@itsislomm</a></b></p>
</div>

---

## License & Intellectual Property

**Copyright © 2026 Islom Sadriddinov Farhod O'g'li. All Rights Reserved.**

This software is **proprietary and strictly protected**. Individuals are granted permission to run and use this application solely as an end user for personal, educational, or creative music and audio production.

### Strict Prohibitions for Companies & Third Parties:
- **No Commercial Appropriation**: No corporation, company, startup, or organization is permitted to take, copy, fork, adapt, bundle, distribute, or incorporate the Muziro source code, architecture, algorithms, or visual designs into any products, services, or commercial software.
- **No Resale or Sublicensing**: Selling, leasing, renting, hosting (SaaS/cloud), or commercial redistribution without prior written agreement is strictly prohibited.
- **Brand & Trademark Protection**: The "Muziro" name, brand, logos, and visual identity are the exclusive intellectual property of Islom Sadriddinov Farhod O'g'li.

For full legal terms and conditions, refer to [license.md](license.md).  
For commercial licensing, acquisition, or buyout inquiries, contact [@itsislomm](https://t.me/itsislomm) on Telegram.
