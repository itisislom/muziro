// Muziro Studio AudioWorklet PCM Recorder
// Captures pristine 32-bit uncompressed floating point PCM audio (Linear PCM, 0% compression)
// Identical to BandLab / Pro Tools audio engine
class MuziroPCMWorkletProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._isRecording = true;
    this.port.onmessage = (e) => {
      if (e.data && e.data.action === 'STOP') {
        this._isRecording = false;
      }
    };
  }

  process(inputs) {
    if (!this._isRecording) return false;
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const numChannels = input.length;
    const channelData = new Array(numChannels);
    for (let c = 0; c < numChannels; c++) {
      channelData[c] = new Float32Array(input[c]);
    }

    this.port.postMessage({
      action: 'DATA',
      channels: channelData
    });

    return true;
  }
}

registerProcessor('muziro-pcm-recorder-processor', MuziroPCMWorkletProcessor);
