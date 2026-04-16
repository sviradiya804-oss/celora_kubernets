@echo off
(for /f "delims=" %%F in ('dir /s /b') do (
    echo %%F | findstr /v /i "\\node_modules\\ \\node_modules$ \\node_modules\" | findstr /v /i "\\.git\\ \\.git$ \\.git\"
)) > output.txt
