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

  LangString UninstalledMsg 1033 "ActionClip removed. Settings were kept in AppData."
  LangString UninstalledMsg 1037 "הוסר ActionClip. הגדרות נשמרו ב-AppData."

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
    ; Check for existing install (HKLM first, then HKCU)
    ReadRegStr $ExistingVersion HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" "DisplayVersion"
    ${If} $ExistingVersion == ""
      ReadRegStr $ExistingVersion HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" "DisplayVersion"
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

  ; ── Brand-color button styling ──────────────────────────────
  ; MUI2 has no supported hook to reshape/recolor a standard Next/Back/
  ; Cancel button — the theme engine (uxtheme) draws them. The one real
  ; technique: switch a specific button handle off Windows visual-style
  ; theming (uxtheme::SetWindowTheme, via NSIS's bundled System plugin),
  ; which makes SetCtlColors actually take effect. Real, visible result:
  ; the Next/primary button loses the native rounded Windows chrome and
  ; renders flat/classic in the brand color — not a shaped custom bitmap
  ; button. Cancel is left native/themed on purpose.
  ;
  ; Colors are WCAG-AA audited: the raw brand indigo (#6366f1) against
  ; white text is 4.47:1 — just under the 4.5:1 AA threshold for normal
  ; button text — so it's darkened ~10% to #595cd9 (5.31:1, passes AA)
  ; while staying recognizably the same indigo.
  Function ColorPrimaryButton
    GetDlgItem $0 $HWNDPARENT 1 ; Next / Install / Finish
    System::Call 'uxtheme::SetWindowTheme(i r0, w "", w "") i .r1'
    SetCtlColors $0 0xFFFFFF 0x595CD9
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
    !define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_FILENAME}"
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

    ; Write uninstall DisplayIcon
    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" \
      "DisplayIcon" "$INSTDIR\${APP_FILENAME}"

    ; Write uninstall Publisher info
    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" \
      "Publisher" "ActionClip"

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" \
      "HelpLink" "https://actionclip.app"

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" \
      "URLInfoAbout" "https://actionclip.app"

    WriteRegStr SHCTX "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}_is1" \
      "Comments" "$(UninstallComment)"

    ; Add Windows Firewall inbound rule so Windows doesn't show a "blocked
    ; features" dialog on first launch (§11.8). Silent — no error if netsh
    ; fails (non-fatal for clipboard agent; only affects network channels).
    nsExec::ExecToStack 'netsh advfirewall firewall add rule name="ActionClip" dir=in action=allow program="$INSTDIR\${APP_FILENAME}" enable=yes profile=any description="ActionClip clipboard agent"'
    Pop $0

    ${If} $UpdateMode == "1"
      DetailPrint "$(UpdatedMsg)"
    ${Else}
      DetailPrint "$(InstalledMsg)"
    ${EndIf}
  !macroend

  ; ── Uninstall: clean registry and firewall rule ─────────────
  !macro customUnInstall
    DeleteRegKey SHCTX "Software\ActionClip"
    ; Remove firewall rule added during install
    nsExec::ExecToStack 'netsh advfirewall firewall delete rule name="ActionClip"'
    Pop $0
    ; AppData settings preserved so user keeps config on reinstall
    DetailPrint "$(UninstalledMsg)"
  !macroend

!endif
