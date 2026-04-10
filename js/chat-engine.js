// ============================================
// Chat Engine — Core Chat Logic
// ============================================

const ChatEngine = {
    currentChatId: null,
    isGenerating: false,
    abortController: null,

    /**
     * Create a new chat
     */
    createChat(providerId = null) {
        const chat = {
            id: Storage.generateId(),
            title: 'สนทนาใหม่',
            providerId: providerId,
            personaId: null,
            systemPrompt: '',
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        Storage.saveChat(chat);
        this.currentChatId = chat.id;
        Storage.setActiveChat(chat.id);
        return chat;
    },

    /**
     * Load an existing chat
     */
    loadChat(chatId) {
        const chat = Storage.getChat(chatId);
        if (chat) {
            this.currentChatId = chatId;
            Storage.setActiveChat(chatId);
        }
        return chat;
    },

    /**
     * Get current chat
     */
    getCurrentChat() {
        if (!this.currentChatId) return null;
        return Storage.getChat(this.currentChatId);
    },

    /**
     * Build message array for API (including system prompt)
     */
    buildMessages(chat) {
        const messages = [];

        // System prompt priority: chat-specific > persona > provider default
        let systemPrompt = '';

        if (chat.systemPrompt) {
            systemPrompt = chat.systemPrompt;
        } else if (chat.personaId) {
            const persona = Storage.getPersonas().find(p => p.id === chat.personaId);
            if (persona) systemPrompt = persona.prompt;
        }

        if (!systemPrompt && chat.providerId) {
            const provider = Storage.getProviders().find(p => p.id === chat.providerId);
            if (provider?.systemPrompt) systemPrompt = provider.systemPrompt;
        }

        if (systemPrompt) {
            messages.push({ role: 'system', content: systemPrompt });
        }

        // Add conversation messages
        for (const msg of chat.messages) {
            messages.push({ role: msg.role, content: msg.content });
        }

        return messages;
    },

    /**
     * Send a user message and get AI response
     */
    async sendMessage(content, options = {}) {
        if (this.isGenerating) return null;

        let chat = this.getCurrentChat();
        if (!chat) {
            chat = this.createChat();
        }

        // Resolve provider
        const providerId = chat.providerId || options.providerId;
        if (!providerId) throw new Error('กรุณาเลือก API ก่อนส่งข้อความ');

        const provider = Storage.getProviders().find(p => p.id === providerId);
        if (!provider) throw new Error('ไม่พบ API ที่เลือก');

        // Update chat provider
        chat.providerId = providerId;

        // Add user message
        const userMsg = {
            id: Storage.generateId(),
            role: 'user',
            content: content,
            timestamp: Date.now(),
        };
        chat.messages.push(userMsg);

        // Auto-title from first message
        if (chat.messages.filter(m => m.role === 'user').length === 1) {
            chat.title = content.substring(0, 40) + (content.length > 40 ? '...' : '');
        }

        chat.updatedAt = Date.now();
        Storage.saveChat(chat);

        // Build API messages
        const apiMessages = this.buildMessages(chat);

        // Prepare AI message placeholder
        const aiMsg = {
            id: Storage.generateId(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        this.isGenerating = true;
        this.abortController = new AbortController();

        const settings = Storage.getSettings();

        try {
            const response = await APIManager.sendMessage(provider, apiMessages, {
                stream: settings.streaming,
                onChunk: (delta, fullText) => {
                    aiMsg.content = fullText;
                    if (options.onChunk) options.onChunk(delta, fullText, aiMsg.id);
                },
                onDone: (fullText) => {
                    aiMsg.content = fullText;
                },
                signal: this.abortController.signal,
            });

            // If non-streaming, set content from response
            if (!settings.streaming) {
                aiMsg.content = response;
            }

            aiMsg.timestamp = Date.now();
            chat.messages.push(aiMsg);
            chat.updatedAt = Date.now();
            Storage.saveChat(chat);

            if (options.onDone) options.onDone(aiMsg);

            return aiMsg;
        } catch (err) {
            // Remove user message if AI failed
            // Actually keep user message, just report error
            if (options.onError) options.onError(err);
            throw err;
        } finally {
            this.isGenerating = false;
            this.abortController = null;
        }
    },

    /**
     * Regenerate last AI response
     */
    async regenerateLastResponse(options = {}) {
        const chat = this.getCurrentChat();
        if (!chat || chat.messages.length === 0) return null;

        // Remove last assistant message
        const lastMsg = chat.messages[chat.messages.length - 1];
        if (lastMsg.role === 'assistant') {
            chat.messages.pop();
            Storage.saveChat(chat);
        }

        // Find the last user message
        const lastUserMsg = [...chat.messages].reverse().find(m => m.role === 'user');
        if (!lastUserMsg) return null;

        // Re-send with existing messages (don't add user msg again)
        const provider = Storage.getProviders().find(p => p.id === chat.providerId);
        if (!provider) throw new Error('ไม่พบ API');

        const apiMessages = this.buildMessages(chat);

        const aiMsg = {
            id: Storage.generateId(),
            role: 'assistant',
            content: '',
            timestamp: Date.now(),
        };

        this.isGenerating = true;
        const settings = Storage.getSettings();

        try {
            const response = await APIManager.sendMessage(provider, apiMessages, {
                stream: settings.streaming,
                onChunk: (delta, fullText) => {
                    aiMsg.content = fullText;
                    if (options.onChunk) options.onChunk(delta, fullText, aiMsg.id);
                },
                onDone: (fullText) => {
                    aiMsg.content = fullText;
                },
            });

            if (!settings.streaming) {
                aiMsg.content = response;
            }

            aiMsg.timestamp = Date.now();
            chat.messages.push(aiMsg);
            chat.updatedAt = Date.now();
            Storage.saveChat(chat);

            if (options.onDone) options.onDone(aiMsg);
            return aiMsg;
        } catch (err) {
            if (options.onError) options.onError(err);
            throw err;
        } finally {
            this.isGenerating = false;
        }
    },

    /**
     * Edit a message and re-generate from that point
     */
    async editMessage(messageId, newContent, options = {}) {
        const chat = this.getCurrentChat();
        if (!chat) return;

        const idx = chat.messages.findIndex(m => m.id === messageId);
        if (idx < 0) return;

        // Update message content
        chat.messages[idx].content = newContent;

        // Remove all messages after this one
        chat.messages = chat.messages.slice(0, idx + 1);
        Storage.saveChat(chat);

        // If it was a user message, regenerate AI response
        if (chat.messages[idx].role === 'user') {
            const provider = Storage.getProviders().find(p => p.id === chat.providerId);
            if (!provider) return;

            const apiMessages = this.buildMessages(chat);
            const aiMsg = {
                id: Storage.generateId(),
                role: 'assistant',
                content: '',
                timestamp: Date.now(),
            };

            this.isGenerating = true;
            const settings = Storage.getSettings();

            try {
                const response = await APIManager.sendMessage(provider, apiMessages, {
                    stream: settings.streaming,
                    onChunk: (delta, fullText) => {
                        aiMsg.content = fullText;
                        if (options.onChunk) options.onChunk(delta, fullText, aiMsg.id);
                    },
                    onDone: (fullText) => { aiMsg.content = fullText; },
                });

                if (!settings.streaming) aiMsg.content = response;

                aiMsg.timestamp = Date.now();
                chat.messages.push(aiMsg);
                chat.updatedAt = Date.now();
                Storage.saveChat(chat);

                if (options.onDone) options.onDone(aiMsg);
                return aiMsg;
            } catch (err) {
                if (options.onError) options.onError(err);
                throw err;
            } finally {
                this.isGenerating = false;
            }
        }
    },

    /**
     * Delete a specific message
     */
    deleteMessage(messageId) {
        const chat = this.getCurrentChat();
        if (!chat) return;

        chat.messages = chat.messages.filter(m => m.id !== messageId);
        chat.updatedAt = Date.now();
        Storage.saveChat(chat);
    },

    /**
     * Stop generation
     */
    stopGeneration() {
        if (this.abortController) {
            this.abortController.abort();
        }
        this.isGenerating = false;
    },

    /**
     * Export chat as JSON
     */
    exportChat(chatId) {
        const chat = Storage.getChat(chatId || this.currentChatId);
        if (!chat) return null;

        const exportData = {
            ...chat,
            exportedAt: new Date().toISOString(),
            appVersion: '1.0.0',
        };

        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${chat.title.replace(/[^a-zA-Z0-9ก-๙]/g, '_')}-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
};
