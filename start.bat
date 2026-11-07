@echo off
chcp 65001 >nul
echo ========================================================
echo       مشروع حُرّاس المياه - ابتكري الحل
echo       Water Guardians - تشغيل الخادم المحلي
echo ========================================================
echo.
echo  جاري تشغيل الخادم على الرابط: http://localhost:3000
echo  لوحة الإدارة: http://localhost:3000/admin (محمية بكلمة مرور المشرف الخاصة)
echo.
cd /d "%~dp0"
node server.js
pause
