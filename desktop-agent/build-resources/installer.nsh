; ============================================================
; ActionClip — Custom NSIS Installer Script
; Modern wizard with full options
;
; Bilingual (English default, Hebrew via the language selector - see
; "installerLanguages"/"displayLanguageSelector" in package.json). Every
; user-facing string here goes through LangString so it actually follows
; whichever language the user picks in the selector.
;
; Language IDs: 1033 = English, 1037 = Hebrew
; (Using numeric IDs because ${LANG_*} constants are not available
;  at include-time when displayLanguageSelector is true.)
; ============================================================

!ifndef BUILD_UNINSTALLER

  ; ── Bilingual strings ──────────────────────────────────────
  LangString WelcomeTitle 1033 "Welcome to the ActionClip $(^Version) Setup Wizard"
  LangString WelcomeTitle 1037 "ברוכים הבאים ל-ActionClip $(^Version)"

  LangString WelcomeText 1033 "This wizard will guide you through installing ActionClip — the smart clipboard agent.$\r$\n$\r$\nActionClip runs quietly in the System Tray and watches your clipboard: copy a phone number and it offers a one-click WhatsApp message, copy a tracking number and it opens the carrier's tracking page, copy an address and it offers Maps/Waze, copy a link and it offers to open it. Everything you copy is also kept in a searchable clipboard history (like Windows' own Win+V), all stored locally on this PC.$\r$\n$\r$\nIt's recommended to close all open applications before continuing.$\r$\n$\r$\nClick Next to continue."
  LangString WelcomeText 1037 "אשף זה ידריך אותך בהתקנת ActionClip — סוכן לוח ההעתקה החכם.$\r$\n$\r$\nActionClip רץ בשקט במגש המערכת ועוקב אחרי מה שאתה מעתיק: מספר טלפון מקבל הצעה לשליחת הודעת WhatsApp בלחיצה אחת, מספר מעקב פותח את דף המעקב של חברת השילוח, כתובת מקבלת הצעה לניווט ב-Maps/Waze, וקישור מקבל הצעה לפתיחה. כל מה שהעתקת נשמר גם בהיסטוריית לוח העתקה ניתנת לחיפוש (בדומה ל-Win+V של Windows), הכול נשמר מקומית על המחשב הזה.$\r$\n$\r$\nמומלץ לסגור את כל האפליקציות הפתוחות לפני שתמשיך.$\r$\n$\r$\nלחץ הבא כדי להמשיך."

  LangString FinishTitle 1033 "Setup completed successfully!"
  LangString FinishTitle 1037 "ההתקנה הושלמה בהצלחה!"

  LangString FinishText 1033 "ActionClip has been installed successfully.$\r$\n$\r$\nYou can open it from the System Tray, in the bottom-right corner.$\r$\n$\r$\nClick Finish to close this wizard."
  LangString FinishText 1037 "ActionClip הותקן בהצלחה.$\r$\n$\r$\nניתן לפתוח אותו ממגש המערכת (System Tray) בפינה הימנית התחתונה.$\r$\n$\r$\nלחץ סיום להשלמת ההתקנה."

  LangString FinishRunText 1033 "Launch ActionClip now"
  LangString FinishRunText 1037 "הפעל את ActionClip עכשיו"

  LangString UpdatedMsg 1033 "ActionClip updated successfully from version $ExistingVersion to ${VERSION}"
  LangString UpdatedMsg 1037 "ActionClip עודכן בהצלחה מגרסה $ExistingVersion לגרסה ${VERSION}"

  LangString InstalledMsg 1033 "ActionClip ${VERSION} installed successfully to $INSTDIR"
  LangString InstalledMsg 1037 "ActionClip ${VERSION} הותקן בהצלחה ב-$INSTDIR"

  LangString UninstallComment 1033 "Smart clipboard agent — phone, address, tracking, links"
  LangString UninstallComment 1037 "סוכן לוח ההעתקה החכם — טלפון, כתובת, מעקב, קישורים"

  ; NOTE: electron-builder's base template already calls CHECK_APP_RUNNING
  ; automatically for every NSIS installer, which detects a running
  ; ActionClip.exe, offers to close it, and retries. No custom check needed.

  ; ── Variables ──────────────────────────────────────────────
  !macro customHeader
    Var UpdateMode
    Var ExistingVersion
    Var AddDesktopShortcut
    Var AddStartupLaunch
  !macroend

  ; ── Detect existing installation ────────────────────────────
  !macro customInit
    ; Check for existing install (HKLM first, then HKCU).
    ; ${UNINSTALL_APP_KEY} is electron-builder's real Add/Remove Programs key
    ; (a GUID derived from appId). This used to read "${APP_ID}_is1" - an
    ; Inno Setup naming convention electron-builder never writes - so an
    ; existing install was never detected and UpdateMode was always "0".
    ReadRegStr $ExistingVersion HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
    ${If} $ExistingVersion == ""
      ReadRegStr $ExistingVersion HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" "DisplayVersion"
    ${EndIf}

    ${If} $ExistingVersion != ""
      StrCpy $UpdateMode "1"
    ${Else}
      StrCpy $UpdateMode "0"
    ${EndIf}

    ; Default checkbox values
    StrCpy $AddDesktopShortcut "1"
    StrCpy $AddStartupLaunch "0"
  !macroend

  ; ── Shared cross-product brand-color button styling ──────────
  ; STANDARDS.md §21 — unified installer palette (IObit-style): OptiGuard,
  ; Playnest, ActionClip and SnapCap all use the same accent blue in their
  ; installer wizard so the four tools read as one company's suite. This
  ; replaces ActionClip's own former brand indigo (#595CD9) in the installer
  ; only — the running app itself is untouched.
  ;
  ; MUI2 has no supported hook to reshape/recolor a standard Next/Back/
  ; Cancel button — the theme engine (uxtheme) draws them. The one real
  ; technique: switch a specific button handle off Windows visual-style
  ; theming (uxtheme::SetWindowTheme, via NSIS's bundled System plugin),
  ; which makes SetCtlColors actually take effect. Real, visible result:
  ; the Next/primary button loses the native rounded Windows chrome and
  ; renders flat/classic in the brand color — not a shaped custom bitmap
  ; button. Cancel is left native/themed on purpose.
  ;
  ; Shared accent #2F6FED against white button text is 4.9:1 — passes
  ; WCAG AA for normal text (per STANDARDS.md §21.1, already audited there).
  Function ColorPrimaryButton
    GetDlgItem $0 $HWNDPARENT 1 ; Next / Install / Finish
    System::Call 'uxtheme::SetWindowTheme(i r0, w "", w "") i .r1'
    SetCtlColors $0 0xFFFFFF 0x2F6FED
  FunctionEnd

  ; ── Welcome page customization ─────────────────────────────
  !macro customWelcomePage
    !define MUI_WELCOMEPAGE_TITLE "$(WelcomeTitle)"
    !define MUI_WELCOMEPAGE_TEXT "$(WelcomeText)"
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW ColorPrimaryButton
    !insertmacro MUI_PAGE_WELCOME
  !macroend

  ; ── Finish page: add extra checkboxes ──────────────────────
  !macro customFinishPage
    !define MUI_FINISHPAGE_TITLE "$(FinishTitle)"
    !define MUI_FINISHPAGE_TEXT "$(FinishText)$\r$\n$\r$\n© 2024–2026 ActionClip. All rights reserved."
    ; ${APP_EXECUTABLE_FILENAME} = ActionClip.exe. (${APP_FILENAME} is
    ; electron-builder's install-DIRECTORY name, not the exe.)
    !define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    !define MUI_FINISHPAGE_RUN_TEXT "$(FinishRunText)"
    !define MUI_FINISHPAGE_SHOWREADME ""
    !define MUI_FINISHPAGE_SHOWREADME_NOTCHECKED
    !define MUI_PAGE_CUSTOMFUNCTION_SHOW ColorPrimaryButton
    !insertmacro MUI_PAGE_FINISH
  !macroend

  ; ── Post-install tasks ──────────────────────────────────────
  !macro customInstall
    ; Write version to registry for future update detection
    WriteRegStr SHCTX "Software\ActionClip" "Version" "${VERSION}"
    WriteRegStr SHCTX "Software\ActionClip" "InstallDir" "$INSTDIR"

    ; Extra Add/Remove Programs metadata, written to electron-builder's REAL
    ; uninstall key (${UNINSTALL_APP_KEY}; it already writes DisplayIcon and
    ; Publisher there itself), which its own uninstaller removes. Previously
    ; all of this went to "Uninstall\${APP_ID}_is1" - a key nothing read or
    ; deleted, so every install left it behind as registry residue (§11.5).
    DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" ; legacy key from <= 2.7.4

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" \
      "HelpLink" "https://actionclip.app"

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" \
      "URLInfoAbout" "https://actionclip.app"

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${UNINSTALL_APP_KEY}" \
      "Comments" "$(UninstallComment)"

    ; Add Windows Firewall inbound rule so Windows doesn't show a "blocked
    ; features" dialog on first launch (§11.8). Silent — no error if netsh
    ; fails (non-fatal for clipboard agent; only affects network channels).
    ; Delete-then-add: "add rule" never de-duplicates, so every update used to
    ; stack one more identical "ActionClip" rule. The program path must be the
    ; real exe - the old rule used ${APP_FILENAME} (the install directory
    ; name), pointed at a non-existent file and never matched the app.
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="ActionClip"'
    Pop $0
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="ActionClip" dir=in action=allow program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes profile=any description="ActionClip clipboard agent"'
    Pop $0

    ${If} $UpdateMode == "1"
      DetailPrint "$(UpdatedMsg)"
    ${Else}
      DetailPrint "$(InstalledMsg)"
    ${EndIf}
  !macroend

!endif

; ── Uninstall: clean registry and firewall rule ───────────────────
; Deliberately OUTSIDE the `!ifndef BUILD_UNINSTALLER` block above.
; electron-builder compiles the uninstaller in a separate makensis pass with
; BUILD_UNINSTALLER defined (its templates/nsis/installer.nsi only includes
; uninstaller.nsh - the only caller of customUnInstall - in that pass). While
; this macro lived inside the block it was never defined in the pass that
; actually builds the uninstaller, so uninstalling never removed
; HKxx\Software\ActionClip or the firewall rule.
LangString UninstalledMsg 1033 "ActionClip removed. Settings were kept in AppData."
LangString UninstalledMsg 1037 "הוסר ActionClip. הגדרות נשמרו ב-AppData."

; Uninstall-time data prompt (STANDARDS.md uninstall-UX). Defaults to NOT
; deleting: MB_DEFBUTTON2 makes "No" the pre-selected/focused button, so
; pressing Enter without reading keeps the user's data - matching
; deleteAppDataOnUninstall: false in package.json.
LangString UninstallConfirmText 1033 "Do you also want to delete your ActionClip settings, templates, clipboard history and send history? This cannot be undone.$\r$\n$\r$\nChoose No to keep your data (recommended if you plan to reinstall)."
LangString UninstallConfirmText 1037 "למחוק גם את ההגדרות, תבניות ההודעה, היסטוריית ההעתקות והיסטוריית השליחות של ActionClip? לא ניתן לבטל פעולה זו.$\r$\n$\r$\nבחר לא כדי לשמור על הנתונים (מומלץ אם מתכננים להתקין מחדש)."

LangString UninstalledDataDeletedMsg 1033 "ActionClip removed. Settings and history were deleted."
LangString UninstalledDataDeletedMsg 1037 "הוסר ActionClip. ההגדרות וההיסטוריה נמחקו."

!macro customUnInstall
  DeleteRegKey SHCTX "Software\ActionClip"
  ; Legacy uninstall-metadata key written by versions up to 2.7.4.
  DeleteRegKey SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1"
  ; Remove firewall rule(s) added during install
  nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="ActionClip"'
  Pop $0

  ; Ask whether to also delete user data (settings/templates/history), kept
  ; in %APPDATA%\ActionClip via electron-store. Default answer is No.
  MessageBox MB_YESNO|MB_ICONQUESTION|MB_DEFBUTTON2 "$(UninstallConfirmText)" IDYES deleteUserData IDNO keepUserData
  deleteUserData:
    RMDir /r "$APPDATA\ActionClip"
    DetailPrint "$(UninstalledDataDeletedMsg)"
    Goto uninstallDataDone
  keepUserData:
    ; AppData settings preserved so user keeps config on reinstall
    DetailPrint "$(UninstalledMsg)"
  uninstallDataDone:
!macroend
