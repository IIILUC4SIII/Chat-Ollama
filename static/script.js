// static/script.js (VERSÃO CORRIGIDA)

document.addEventListener('DOMContentLoaded', () => {
    const modelSelect = document.getElementById('model-select');
    const deleteModelBtn = document.getElementById('delete-model-btn');
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const promptInput = document.getElementById('prompt-input');
    const chatMessages = document.getElementById('chat-messages');
    const fileInput = document.getElementById('file-input');
    const imagePreviewContainer = document.getElementById('image-preview-container');

    let uploadedImages = [];

    // Carrega os modelos disponíveis ao iniciar
    async function loadModels() {
        try {
            const response = await fetch('/api/models');
            const data = await response.json();
            modelSelect.innerHTML = '';
            if (data.models && data.models.length > 0) {
                data.models.forEach(model => {
                    const option = document.createElement('option');
                    option.value = model.name;
                    option.textContent = model.name;
                    modelSelect.appendChild(option);
                });
            } else {
                 addMessage('Nenhum modelo encontrado. Baixe um modelo com "ollama pull <nome_do_modelo>" no terminal.', 'model');
            }
        } catch (error) {
            console.error('Erro ao carregar modelos:', error);
            addMessage('Erro ao carregar modelos. Verifique se o Ollama está em execução.', 'model');
        }
    }

    // Adiciona uma mensagem na tela
    function addMessage(text, sender, element = null) {
        if (!element) {
            const messageElement = document.createElement('div');
            messageElement.classList.add('message', sender);
            
            // Simples detecção de bloco de código para estilização
            if (text.includes("```")) {
                const parts = text.split("```");
                parts.forEach((part, index) => {
                    if (index % 2 === 1) { // Bloco de código
                        const pre = document.createElement('pre');
                        const code = document.createElement('code');
                        const codeContent = part.startsWith('\n') ? part.substring(1) : part;
                        code.textContent = codeContent;
                        pre.appendChild(code);
                        messageElement.appendChild(pre);
                    } else { // Texto normal
                        const span = document.createElement('span');
                        span.textContent = part;
                        messageElement.appendChild(span);
                    }
                });

            } else {
                 const span = document.createElement('span');
                 span.textContent = text;
                 messageElement.appendChild(span);
            }

            chatMessages.appendChild(messageElement);
            chatMessages.scrollTop = chatMessages.scrollHeight;
            return messageElement.querySelector('span:last-child') || messageElement;
        } else {
            element.textContent += text;
        }
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Envio do prompt para o backend
    async function handleSend() {
        const prompt = promptInput.value.trim();
        const model = modelSelect.value;
        if (!prompt || !model) return;

        addMessage(prompt, 'user');
        promptInput.value = '';
        promptInput.style.height = '50px';
        imagePreviewContainer.innerHTML = '';

        const modelMessageElement = addMessage('', 'model');

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model, prompt, images: uploadedImages }),
            });

            uploadedImages = [];

            if (!response.ok) {
                throw new Error(`Erro na API: ${response.statusText}`);
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let firstChunk = true;

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                chunk.split('\n').forEach(line => {
                    if (line) {
                        try {
                            const parsed = JSON.parse(line);
                            let content = '';
                            
                            // *** AQUI ESTÁ A CORREÇÃO PRINCIPAL ***
                            // Verifica os formatos mais comuns de resposta e de erro
                            if (parsed.response) {
                                content = parsed.response;
                            } else if (parsed.message && parsed.message.content) {
                                content = parsed.message.content;
                            } else if (parsed.error) {
                                content = `\n\nERRO: ${parsed.error}`;
                                console.error("Erro do Ollama:", parsed.error);
                            }

                            if (firstChunk) {
                                modelMessageElement.textContent = content;
                                firstChunk = false;
                            } else {
                                modelMessageElement.textContent += content;
                            }

                            chatMessages.scrollTop = chatMessages.scrollHeight;
                        } catch (e) {
                            console.error("Erro ao processar JSON do stream:", e, "Linha:", line);
                        }
                    }
                });
            }
        } catch (error) {
            console.error('Erro ao enviar mensagem:', error);
            modelMessageElement.textContent = `Erro: ${error.message}`;
        }
    }
    
    // ... (O resto do código permanece o mesmo) ...

    fileInput.addEventListener('change', () => {
        imagePreviewContainer.innerHTML = '';
        uploadedImages = [];
        Array.from(fileInput.files).forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                img.classList.add('img-preview');
                imagePreviewContainer.appendChild(img);
                uploadedImages.push(e.target.result.split(',')[1]);
            };
            reader.readAsDataURL(file);
        });
    });

    deleteModelBtn.addEventListener('click', async () => {
        const modelToDelete = modelSelect.value;
        if (!modelToDelete || !confirm(`Tem certeza que deseja deletar o modelo ${modelToDelete}?`)) return;
        try {
            await fetch('/api/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: modelToDelete }),
            });
            await loadModels();
        } catch (error) {
            console.error('Erro ao deletar modelo:', error);
        }
    });
    
    newChatBtn.addEventListener('click', () => {
        chatMessages.innerHTML = `
            <div class="message welcome">
                <p>Selecione um modelo e inicie a conversa.</p>
            </div>`;
    });

    promptInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    sendBtn.addEventListener('click', handleSend);
    loadModels();
});