Unicode true
RequestExecutionLevel user
!include "MUI2.nsh"
!include "LogicLib.nsh"
!define PRODUCT "PricingPilot Review"
!define PRODUCT_ID "TechPartner.PricingPilot.Review.v1"
Name "${PRODUCT}"
OutFile "${PACKAGE_OUT}"
SetCompressor /SOLID zlib
!ifdef QA_ROOT
  InstallDir "${QA_ROOT}"
!else
  InstallDir "$LOCALAPPDATA\Programs\PricingPilot Review"
!endif
!define MUI_WELCOMEPAGE_TITLE "PricingPilot review installer"
!define MUI_WELCOMEPAGE_TEXT "A local review build for testing, not a cleared commercial release.$\r$\n$\r$\nMicrosoft Edge must already be installed. No Node, Python, API key or account is needed. No browser or paid service is downloaded.$\r$\n$\r$\nKeep full JSON backups. Browser storage is not cloud backup."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!define MUI_FINISHPAGE_TITLE "PricingPilot review files installed"
!define MUI_FINISHPAGE_TEXT "Read SETUP-NOTICE and USER-GUIDE before using business data. This is an unsigned review candidate; clean-machine acceptance and commercial release approval remain pending."
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function .onInit
  ; Fixed application directories avoid installing over arbitrary user folders.
  ; QA_ROOT is validated inside this checkout's ignored output folder at build.
  !ifdef QA_ROOT
    StrCpy $INSTDIR "${QA_ROOT}"
  !else
    StrCpy $INSTDIR "$LOCALAPPDATA\Programs\PricingPilot Review"
  !endif
  IfFileExists "$INSTDIR\*" 0 init_done
  ReadINIStr $0 "$INSTDIR\install-marker.ini" "Install" "Product"
  ${If} $0 != "${PRODUCT_ID}"
    IfSilent +2
    MessageBox MB_OK|MB_ICONSTOP "The target folder already exists without a PricingPilot install marker. No files were changed. Contact TechPartner."
    SetErrorLevel 2
    Abort
  ${EndIf}
  init_done:
FunctionEnd

Section "PricingPilot"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "${STAGE}\PricingPilot.exe"
  File "${SOURCE}\index.html"
  File "${SOURCE}\USER-GUIDE.txt"
  File "${SOURCE}\SETUP-NOTICE.txt"
  File "${STAGE}\NSIS-COPYING.txt"
  SetOutPath "$INSTDIR\css"
  File "${SOURCE}\css\style.css"
  SetOutPath "$INSTDIR\js"
  File "${SOURCE}\js\app.js"
  SetOutPath "$INSTDIR\lib"
  File "${SOURCE}\lib\logic.js"
  File "${SOURCE}\lib\backup.js"
  SetOutPath "$INSTDIR"
  WriteINIStr "$INSTDIR\install-marker.ini" "Install" "Product" "${PRODUCT_ID}"
  WriteUninstaller "$INSTDIR\Uninstall.exe"
  !ifdef QA_ROOT
    CreateDirectory "$INSTDIR\qa-shortcuts"
    CreateShortcut "$INSTDIR\qa-shortcuts\PricingPilot Review.lnk" "$INSTDIR\PricingPilot.exe"
  !else
    CreateShortcut "$DESKTOP\PricingPilot Review.lnk" "$INSTDIR\PricingPilot.exe"
    CreateDirectory "$SMPROGRAMS\PricingPilot Review"
    CreateShortcut "$SMPROGRAMS\PricingPilot Review\PricingPilot Review.lnk" "$INSTDIR\PricingPilot.exe"
    CreateShortcut "$SMPROGRAMS\PricingPilot Review\User guide.lnk" "$INSTDIR\USER-GUIDE.txt"
    CreateShortcut "$SMPROGRAMS\PricingPilot Review\Uninstall.lnk" "$INSTDIR\Uninstall.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "DisplayName" "${PRODUCT}"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "Publisher" "TechPartner"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "UninstallString" '$\"$INSTDIR\Uninstall.exe$\"'
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview" "NoRepair" 1
  !endif
SectionEnd

Function un.onInit
  !ifdef QA_ROOT
    ${If} $INSTDIR != "${QA_ROOT}"
      SetErrorLevel 3
      Abort
    ${EndIf}
  !else
    ${If} $INSTDIR != "$LOCALAPPDATA\Programs\PricingPilot Review"
      SetErrorLevel 3
      Abort
    ${EndIf}
  !endif
  ReadINIStr $0 "$INSTDIR\install-marker.ini" "Install" "Product"
  ${If} $0 != "${PRODUCT_ID}"
    SetErrorLevel 3
    Abort
  ${EndIf}
FunctionEnd

Section "Uninstall"
  SetShellVarContext current
  ; Only known application files. Never recursively delete the install folder,
  ; browser data, user-created backups, customer PDFs or unrelated files.
  Delete "$INSTDIR\PricingPilot.exe"
  Delete "$INSTDIR\index.html"
  Delete "$INSTDIR\USER-GUIDE.txt"
  Delete "$INSTDIR\SETUP-NOTICE.txt"
  Delete "$INSTDIR\NSIS-COPYING.txt"
  Delete "$INSTDIR\css\style.css"
  Delete "$INSTDIR\js\app.js"
  Delete "$INSTDIR\lib\logic.js"
  Delete "$INSTDIR\lib\backup.js"
  Delete "$INSTDIR\install-marker.ini"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR\css"
  RMDir "$INSTDIR\js"
  RMDir "$INSTDIR\lib"
  !ifdef QA_ROOT
    Delete "$INSTDIR\qa-shortcuts\PricingPilot Review.lnk"
    RMDir "$INSTDIR\qa-shortcuts"
  !else
    Delete "$DESKTOP\PricingPilot Review.lnk"
    Delete "$SMPROGRAMS\PricingPilot Review\PricingPilot Review.lnk"
    Delete "$SMPROGRAMS\PricingPilot Review\User guide.lnk"
    Delete "$SMPROGRAMS\PricingPilot Review\Uninstall.lnk"
    RMDir "$SMPROGRAMS\PricingPilot Review"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TechPartnerPricingPilotReview"
  !endif
  RMDir "$INSTDIR"
SectionEnd
