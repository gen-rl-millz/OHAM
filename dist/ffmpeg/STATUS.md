# ffmpeg integration — STATUS

**BLOCKED on the encoder lift + an owner decision, by design.** An
ffmpeg output format (`-f oham out.tsb`) requires linking encoder code
into ffmpeg — which ships source. The standing lock keeps the encoder
private, so the shippable form is either (a) a pipe adapter (ffmpeg
decodes anything → y4m pipe → `oham seal --api`), which works TODAY:
    ffmpeg -i input.mp4 -f yuv4mpegpipe - | oham seal -o out.tsb --api $OHAM_API --y4m /dev/stdin -- <flags>
or (b) a real libavformat muxer, which is an owner call on what source
ships. Until that call, (a) is the documented path.
