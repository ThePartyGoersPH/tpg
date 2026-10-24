@echo off
echo ============================================================
echo RBAC Migration Runner
echo ============================================================
echo.
echo This will run the RBAC migration using MySQL command line.
echo Make sure MySQL bin folder is in your PATH.
echo.
set DB_NAME=tpg
set DB_USER=root
echo.
echo Running Part 1: Table rebuild and permissions...
mysql -u %DB_USER% -p %DB_NAME% < rbac_rebuild_safe.sql
if %errorlevel% neq 0 (
    echo ERROR: Part 1 failed. Check the error above.
    pause
    exit /b 1
)
echo Part 1 completed successfully!
echo.
echo Running Part 2: User role updates...
mysql -u %DB_USER% -p %DB_NAME% < rbac_rebuild_part2.sql
if %errorlevel% neq 0 (
    echo ERROR: Part 2 failed. Check the error above.
    pause
    exit /b 1
)
echo.
echo ============================================================
echo MIGRATION COMPLETE!
echo ============================================================
pause
