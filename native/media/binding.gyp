{
  "variables": {
    "piper_root%": "<!(node -p \"process.env.BOBAI_PIPER_ROOT || ''\")",
    "whisper_root%": "<!(node -p \"process.env.BOBAI_WHISPER_ROOT || ''\")"
  },
  "targets": [
    {
      "target_name": "bobai_media",
      "sources": ["bobai_media.cc"],
      "include_dirs": ["<(piper_root)/include", "<(whisper_root)/include"],
      "defines": ["NAPI_VERSION=8"],
      "conditions": [
        ["OS==\"win\"", {
          "libraries": ["<(piper_root)/lib/piper.lib", "<(whisper_root)/lib/whisper.lib"],
          "msvs_settings": {"VCCLCompilerTool": {"ExceptionHandling": 1}}
        }],
        ["OS!='win'", {
          "libraries": ["-L<(piper_root)/lib", "-lpiper", "-L<(whisper_root)/lib", "-lwhisper", "-pthread"]
        }]
      ]
    }
  ]
}
