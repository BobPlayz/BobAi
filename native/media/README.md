# BobAI native media runtime

BobVoice, BobWhisper, and BobMedia are exposed through one Node-API addon instead of spawning `piper`, `whisper-cli`, `ffmpeg`, or shell commands. The addon links the Piper C API and whisper.cpp C API directly into the BobAI process. Node-API is used so the JavaScript layer does not depend on V8 internals.

The current native media core accepts PCM16 WAV for BobWhisper and BobMedia probing. Piper synthesis returns a PCM16 WAV buffer directly. Broader container/codec conversion is intentionally a separate native-media extension point and is not silently implemented with a child process.

Build requirements are target-machine requirements because the repository does not check large third-party native binaries or voice/ASR model weights into Git. Build Piper's `libpiper` and whisper.cpp as native libraries, set `BOBAI_PIPER_ROOT` and `BOBAI_WHISPER_ROOT` to their install/build roots, then run node-gyp against this directory. On Windows, Visual C++ Build Tools and Python are required by node-gyp.

Piper's current C/C++ library provides a direct `piper_create` / `piper_synthesize_start` / `piper_synthesize_next` API, and whisper.cpp provides a direct C API for PCM inference. BobAI calls those APIs in-process. The API layer therefore no longer needs executable paths or shell commands for these engines.

The native addon is a deployment artifact. It is not built by the normal TypeScript CI job because CI does not have the target machine's native libraries or model weights.
