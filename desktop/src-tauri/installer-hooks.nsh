; Path of Agent - NSIS Installer Hooks
; Ensures clean resource directories on upgrade to prevent stale files
; from previous installations (e.g., old PoB Lua scripts with different
; directory structure) from persisting and causing runtime issues.

!macro NSIS_HOOK_PREINSTALL
  ; Remove old resource directories before copying new files.
  ; Without this, files from previous versions that no longer exist in the
  ; new version will remain and can cause config/calculation mismatches.
  RMDir /r "$INSTDIR\resources\pob"
  RMDir /r "$INSTDIR\resources\data"
!macroend
