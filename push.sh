#!/bin/bash

# Cores para deixar o visual do Termux organizado
VERDE='\033[0;32m'
AMARELO='\033[1;33m'
VERMELHO='\033[0;31m'
NC='\033[0m' # Sem Cor

echo -e "${AMARELO}🚀 Iniciando automação do Git...${NC}"

# 1. Prepara todos os arquivos modificados
echo -e "${VERDE}📦 Rastreando arquivos modificados (git add .)...${NC}"
git add .

# 2. Pausa para você digitar o commit manualmente
echo -e "${AMARELO}✍️ Digite a mensagem do seu Commit (Seu histórico de alterações):${NC}"
echo -n "> "
read -r mensagem_commit

# Validação: Se você der Enter sem digitar nada, o script cria uma mensagem padrão com a data/hora
if [ -z "$mensagem_commit" ]; then
    mensagem_commit="Atualização automática: $(date +'%d/%m/%Y às %H:%M')"
    echo -e "${AMARELO}⚠️ Nenhuma mensagem digitada. Usando padrão: '$mensagem_commit'${NC}"
fi

# 3. Faz o commit com a sua mensagem
git commit -m "$mensagem_commit"

# 4. Envia os dados para o GitHub
echo -e "${VERDE}📤 Enviando alterações para o repositório remoto (git push origin main)...${NC}"
echo -e "${AMARELO}💡 Lembrete: Se o terminal pedir sua senha, cole o seu TOKEN DO GITHUB!${NC}"
echo ""

# Executa o envio e monitora se vai dar erro de histórico
git push origin main

# Se o envio falhar (como o erro de histórico anterior), ele oferece o push forçado na hora
if [ $? -ne 0 ]; then
    echo ""
    echo -e "${VERMELHO}❌ O envio comum falhou.${NC}"
    echo -e "${AMARELO}🤔 Deseja forçar o envio para sincronizar o GitHub com o seu celular? (s/n)${NC}"
    echo -n "> "
    read -r resposta

    if [ "$resposta" = "s" ] || [ "$resposta" = "S" ]; then
        echo -e "${VERMELHO}⚠️ Forçando o envio dos dados (git push origin main --force)...${NC}"
        git push origin main --force
    else
        echo -e "${AMARELO}👍 Envio cancelado. Corrija manualmente se necessário.${NC}"
    fi
fi

echo -e "${VERDE}🎉 Processo finalizado com sucesso!${NC}"
