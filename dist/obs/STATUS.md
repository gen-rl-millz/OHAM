# OBS Studio plugin — STATUS

**BLOCKED on E6 (TSB-LIVE), by design order.** The plugin is the CAST
half: OBS renders → the OHAM live encoder seals ticks → socket wire →
any receiver tunes in with the order receipt. The live lane
(`oham cast` / `oham tune`, gates preregistered in the private tree at
labs/tsb_live_v1) must land first; the plugin is then a thin OBS output
module feeding it. Nothing to install yet — this directory exists so
the surface has a home and a status. Encoding stays behind the API/
private components per the standing lock.
