@echo off
title Aspire e Learning - Ollama sharing
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0ollama-tunnel.ps1"
pause
