# Unity / Unreal packages — STATUS

**BLOCKED on E10 (progressive units) + the live lane, by design order.**
The wedge is real already: windowed ultra-high-MP reads = streaming
megatextures with no pyramid files (the C ABI's evs_frame_region /
evs_ref_window_rgba — a texture tile is a window read). The package
shape: a native plugin linking liboham (the C ABI face) + a
TextureStreamer component. Lands after E10 gives deadline-shaped
fetches. This directory is the surface's home and status.
