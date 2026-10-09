; Open the foundation website only after a successful interactive uninstall.
!macro customHeader
  !ifdef BUILD_UNINSTALLER
    Function un.onUninstSuccess
      IfSilent done
      ${ifNot} ${isUpdated}
        ; Use the interactive user's browser, including all-users installs.
        ${StdUtils.ExecShellAsUser} $0 "https://www.purpledragonfoundationltd.xyz/" "open" ""
      ${endif}
      done:
    FunctionEnd
  !endif
!macroend
