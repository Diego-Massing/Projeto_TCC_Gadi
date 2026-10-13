@echo off
rem Chamado pelo Agendador de Tarefas do Windows (tarefa "Frota KM New Rastreamento").
rem Grava o resultado da última execução em ultima-execucao.log, na mesma pasta.
cd /d "%~dp0"
node coletar.mjs > ultima-execucao.log 2>&1
