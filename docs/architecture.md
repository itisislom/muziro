# Muziro — Web Music Editor

## Технологический стек и фундамент

### 1. Web Audio API
- **Граф аудиоузлов (AudioNode Graph):**
  - Синтез: `OscillatorNode`, кастомные генераторы волн.
  - Обработка и фильтрация: `BiquadFilterNode`, `GainNode`, `StereoPannerNode`, `ConvolverNode`, `DelayNode`.
  - Мониторинг и визуализация: `AnalyserNode` (спектрограммы, осциллографы, пиковые уровни).

### 2. AudioWorklet
- **Низкоуровневая обработка звука в реальном времени:**
  - Работает в выделенном аудио-потоке (`AudioWorkletProcessor`), исключая дропы и глитчи от основного UI-потока.
  - Кастомные DSP-алгоритмы (синтезаторы, сатурация, кастомные фильтры, ревербераторы, секвенсоры).
  - Перспектива WebAssembly (Wasm via C++ / Rust) для тяжелых DSP вычислений и загрузки существующих движков.

### 3. Архитектурные модули
- **Audio Engine (Core):** Инициализация `AudioContext`, мастер-шина, маршрутизация сигналов, управление тактом / BPM / clock.
- **DSP / Worklets:** Пакет кастомных процессоров для изоляции звуковой логики.
- **Track & Pattern Engine:** Таймлайн, дорожки (MIDI / Audio / Automation), стэп-секвенсор.
- **UI & State Management:** Реактивный интерфейс, интеграция с аудио-потоком через `MessagePort` / `SharedArrayBuffer`.
