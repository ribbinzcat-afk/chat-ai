// ============================================
// App — Main Application Controller
// ============================================

const App = {
    init() {
        UI.cacheElements();
        this.loadSettings();
        this.bindEvents();
        this.loadInitialState();
        console.log('🚀 AI Chat Studio initialized');
    },

    // ===== Initialization =====
    loadSettings() {
        const settings = Storage.getSettings();
        UI.applyTheme(settings.theme);
        UI.applyFontSize(settings.fontSize);

        UI.elements.settingTheme.value = settings.theme;
        UI.elements.settingFontsize.value = settings.fontSize;
        UI.elements.settingEnterSend.value = String(settings.enterSend);
        UI.elements.settingStreaming.value = String(settings.streaming);
    },

    loadInitialState() {
        UI.renderChatList();
        UI.updateModelSelector();

        const activeChatId = Storage.getActiveChat();
        if (activeChatId) {
            this.openChat(activeChatId);
        }
    },

    // ===== Event Bindings =====
    bindEvents() {
        // New Chat
        UI.elements.btnNewChat.addEventListener('click', () => this.newChat());

        // Send Message
        UI.elements.btnSend.addEventListener('click', () => this.sendMessage());

        // Input handling
        UI.elements.messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            UI.elements.charCount.textContent = UI.elements.messageInput.value.length;
        });

        UI.elements.messageInput.addEventListener('keydown', (e) => {
            const settings = Storage.getSettings();
            if (settings.enterSend) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            } else {
                if (e.key === 'Enter' && e.ctrlKey) {
                    e.preventDefault();
                    this.sendMessage();
                }
            }
        });

        // Model selector
        UI.elements.modelSelector.addEventListener('change', (e) => {
            const chat = ChatEngine.getCurrentChat();
            if (chat) {
                chat.providerId = e.target.value;
                Storage.saveChat(chat);
                UI.updateHeader(chat);
            }
        });

        // Sidebar toggle (mobile)
        UI.elements.btnToggleSidebar.addEventListener('click', () => {
            UI.elements.sidebar.classList.toggle('open');
        });

        // Close sidebar on overlay click (mobile)
        document.addEventListener('click', (e) => {
            if (UI.elements.sidebar.classList.contains('open') &&
                !UI.elements.sidebar.contains(e.target) &&
                e.target !== UI.elements.btnToggleSidebar) {
                UI.elements.sidebar.classList.remove('open');
            }
        });

        // Search chats
        UI.elements.searchChats.addEventListener('input', (e) => {
            UI.renderChatList(e.target.value);
        });

        // Settings modal
        UI.elements.btnSettings.addEventListener('click', () => {
            UI.renderProvidersList();
            UI.openModal('modal-settings');
        });

        // Persona modal
        UI.elements.btnPersonas.addEventListener('click', () => {
            UI.renderPersonasList();
            UI.openModal('modal-persona');
        });

        // Chat settings modal
        UI.elements.btnChatSettings.addEventListener('click', () => {
            this.openChatSettings();
        });

        // Modal close buttons
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => UI.closeAllModals());
        });

        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });

        // Provider type change
        UI.elements.providerType.addEventListener('change', (e) => {
            const type = e.target.value;
            const config = APIManager.PROVIDER_CONFIGS[type];

            // Show/hide URL field
            const showUrl = ['custom', 'ollama'].includes(type);
            UI.elements.groupApiUrl.style.display = showUrl ? 'block' : 'none';

            // Show/hide API key field
            const hideKey = type === 'ollama';
            UI.elements.groupApiKey.style.display = hideKey ? 'none' : 'block';

            // Pre-fill model
            if (config?.defaultModel) {
                UI.elements.providerModel.value = config.defaultModel;
            }

            // Pre-fill URL for Ollama
            if (type === 'ollama') {
                UI.elements.providerUrl.value = 'http://localhost:11434';
            }
        });

        // Add Provider form
        UI.elements.formAddProvider.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProvider();
        });

        // Persona form
        UI.elements.formPersona.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersona();
        });

        // Save chat settings
        document.getElementById('btn-save-chat-settings').addEventListener('click', () => this.saveChatSettings());
        document.getElementById('btn-delete-chat').addEventListener('click', () => this.deleteCurrentChat());
        document.getElementById('btn-export-chat').addEventListener('click', () => ChatEngine.exportChat());

        // General settings auto-save
        ['settingTheme', 'settingFontsize', 'settingEnterSend', 'settingStreaming'].forEach(key => {
            UI.elements[key].addEventListener('change', () => this.saveGeneralSettings());
        });

        // Clear all data
        document.getElementById('btn-clear-all-data').addEventListener('click', () => {
            if (confirm('⚠️ คุณแน่ใจหรือว่าต้องการลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                Storage.clearAll();
                location.reload();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + N: New chat
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
                e.preventDefault();
                this.newChat();
            }
            // Escape: Close modals
            if (e.key === 'Escape') {
                UI.closeAllModals();
            }
        });

        // Hide context menu on click elsewhere
        document.addEventListener('click', () => {
            UI.elements.contextMenu.style.display = 'none';
        });
    },

    // ===== Chat Operations =====
    newChat() {
        const providers = Storage.getProviders();
        const providerId = UI.elements.modelSelector.value || (providers.length > 0 ? providers[0].id : null);
        const chat = ChatEngine.createChat(providerId);
        UI.renderChatList();
        UI.renderMessages(chat);
        UI.updateHeader(chat);
        UI.updateModelSelector();
        UI.elements.messageInput.focus();
        UI.elements.sidebar.classList.remove('open');
    },

    openChat(chatId) {
        const chat = ChatEngine.loadChat(chatId);
        if (!chat) return;

        UI.renderMessages(chat);
        UI.updateHeader(chat);
        UI.updateModelSelector();
        UI.renderChatList();
        UI.elements.messageInput.focus();
        UI.elements.sidebar.classList.remove('open');
    },

    async sendMessage() {
        const input = UI.elements.messageInput;
        const content = input.value.trim();
        if (!content || ChatEngine.isGenerating) return;

        const providerId = UI.elements.modelSelector.value;
        if (!providerId) {
            UI.notify('กรุณาเลือก API ก่อนส่งข้อความ', 'error');
            return;
        }

        // Ensure we have a chat
        if (!ChatEngine.currentChatId) {
            ChatEngine.createChat(providerId);
        }

        // Update provider on current chat
        const chat = ChatEngine.getCurrentChat();
        if (chat) {
            chat.providerId = providerId;
            Storage.saveChat(chat);
        }

        // Clear input
        input.value = '';
        input.style.height = 'auto';
        UI.elements.charCount.textContent = '0';

        // Add user message to UI
        const userMsg = {
            id: Storage.generateId(),
            role: 'user',
            content: content,
            timestamp: Date.now(),
        };

        const persona = chat?.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
        const aiAvatar = persona?.avatar || 'AI';

        UI.appendMessage(userMsg, aiAvatar);
        UI.showTyping(true);
        UI.elements.btnSend.disabled = true;

        let streamingMsgId = null;

        try {
            const aiMsg = await ChatEngine.sendMessage(content, {
                providerId,
                onChunk: (delta, fullText, msgId) => {
                    streamingMsgId = msgId;
                    UI.showTyping(false);
                    UI.updateStreamingMessage(msgId, fullText, aiAvatar);
                },
                onDone: (aiMsg) => {
                    if (streamingMsgId) {
                        UI.finalizeStreamingMessage(streamingMsgId);
                    }
                },
                onError: (err) => {
                    UI.notify(`❌ ${err.message}`, 'error');
                },
            });

            // For non-streaming mode
            if (aiMsg && !streamingMsgId) {
                UI.appendMessage(aiMsg, aiAvatar);
            }
        } catch (err) {
            UI.notify(`❌ ${err.message}`, 'error');
        } finally {
            UI.showTyping(false);
            UI.elements.btnSend.disabled = false;
            UI.renderChatList();
            UI.updateHeader(ChatEngine.getCurrentChat());
        }
    },

    // ===== Message Actions =====
    async editMessage(msgId) {
        const chat = ChatEngine.getCurrentChat();
        if (!chat) return;

        const msg = chat.messages.find(m => m.id === msgId);
        if (!msg) return;

        const newContent = prompt('แก้ไขข้อความ:', msg.content);
        if (newContent === null || newContent === msg.content) return;

        const persona = chat.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
        const aiAvatar = persona?.avatar || 'AI';

        // Clear and re-render
        UI.showTyping(true);

        try {
            await ChatEngine.editMessage(msgId, newContent, {
                onChunk: (delta, fullText, newMsgId) => {
                    UI.showTyping(false);
                    const updatedChat = ChatEngine.getCurrentChat();
                    UI.renderMessages(updatedChat);
                    UI.updateStreamingMessage(newMsgId, fullText, aiAvatar);
                },
                onDone: () => {
                    const updatedChat = ChatEngine.getCurrentChat();
                    UI.renderMessages(updatedChat);
                },
            });
        } catch (err) {
            UI.notify(`❌ ${err.message}`, 'error');
        } finally {
            UI.showTyping(false);
        }
    },

    copyMessage(msgId) {
        const chat = ChatEngine.getCurrentChat();
        if (!chat) return;

        const msg = chat.messages.find(m => m.id === msgId);
        if (!msg) return;

        navigator.clipboard.writeText(msg.content).then(() => {
            UI.notify('📋 คัดลอกแล้ว', 'success');
        });
    },

    async regenerateMessage() {
        if (ChatEngine.isGenerating) return;

        const chat = ChatEngine.getCurrentChat();
        if (!chat) return;

        const persona = chat.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
        const aiAvatar = persona?.avatar || 'AI';

        // Remove last AI message from UI
        const lastMsgEl = UI.elements.messagesWrapper.lastElementChild;
        if (lastMsgEl) lastMsgEl.remove();

        UI.showTyping(true);

        try {
            await ChatEngine.regenerateLastResponse({
                onChunk: (delta, fullText, msgId) => {
                    UI.showTyping(false);
                    UI.updateStreamingMessage(msgId, fullText, aiAvatar);
                },
                onDone: (aiMsg) => {
                    const updatedChat = ChatEngine.getCurrentChat();
                    UI.renderMessages(updatedChat);
                },
            });
        } catch (err) {
            UI.notify(`❌ ${err.message}`, 'error');
            const updatedChat = ChatEngine.getCurrentChat();
            UI.renderMessages(updatedChat);
        } finally {
            UI.showTyping(false);
        }
    },

    deleteMessage(msgId) {
        if (!confirm('ลบข้อความนี้?')) return;

        ChatEngine.deleteMessage(msgId);
        const chat = ChatEngine.getCurrentChat();
        UI.renderMessages(chat);
    },

    // ===== Provider Operations =====
    saveProvider(editId = null) {
        const type = UI.elements.providerType.value;
        const name = UI.elements.providerName.value.trim();

        if (!type || !name) {
            UI.notify('กรุณากรอกข้อมูลให้ครบ', 'error');
            return;
        }

        let customHeaders = {};
        try {
            const headersStr = UI.elements.providerHeaders.value.trim();
            if (headersStr) customHeaders = JSON.parse(headersStr);
        } catch {
            UI.notify('Custom Headers ไม่ใช่ JSON ที่ถูกต้อง', 'error');
            return;
        }

        const provider = {
            id: editId || Storage.generateId(),
            type,
            name,
            url: UI.elements.providerUrl.value.trim() || null,
            apiKey: UI.elements.providerKey.value.trim(),
            model: UI.elements.providerModel.value.trim(),
            systemPrompt: UI.elements.providerSystemPrompt.value.trim(),
            temperature: parseFloat(UI.elements.providerTemp.value),
            maxTokens: parseInt(UI.elements.providerMaxTokens.value),
            topP: parseFloat(UI.elements.providerTopP.value),
            frequencyPenalty: parseFloat(UI.elements.providerFreqPenalty.value),
            customHeaders,
        };

        Storage.saveProvider(provider);
        UI.renderProvidersList();
        UI.updateModelSelector();
        UI.notify('✅ บันทึก API เรียบร้อย', 'success');

        // Reset form
        UI.elements.formAddProvider.reset();
        UI.elements.groupApiUrl.style.display = 'none';
        UI.elements.groupApiKey.style.display = 'block';
        document.getElementById('temp-value').textContent = '0.7';
        document.getElementById('topp-value').textContent = '1.0';
        document.getElementById('freq-value').textContent = '0';

        // Switch to providers tab
        document.querySelector('[data-tab="providers"]').click();
    },

    async testProvider(id) {
        const provider = Storage.getProviders().find(p => p.id === id);
        if (!provider) return;

        UI.notify('🔗 กำลังทดสอบการเชื่อมต่อ...', 'info');

        const result = await APIManager.testConnection(provider);
        if (result.success) {
            UI.notify(`✅ เชื่อมต่อสำเร็จ: "${result.message}"`, 'success');
        } else {
            UI.notify(`❌ ไม่สามารถเชื่อมต่อ: ${result.message}`, 'error');
        }
    },

    editProvider(id) {
        const provider = Storage.getProviders().find(p => p.id === id);
        if (!provider) return;

        // Fill form
        UI.elements.providerType.value = provider.type;
        UI.elements.providerType.dispatchEvent(new Event('change'));
        UI.elements.providerName.value = provider.name;
        UI.elements.providerUrl.value = provider.url || '';
        UI.elements.providerKey.value = provider.apiKey || '';
        UI.elements.providerModel.value = provider.model || '';
        UI.elements.providerSystemPrompt.value = provider.systemPrompt || '';
        UI.elements.providerTemp.value = provider.temperature ?? 0.7;
        UI.elements.providerMaxTokens.value = provider.maxTokens ?? 4096;
        UI.elements.providerTopP.value = provider.topP ?? 1;
        UI.elements.providerFreqPenalty.value = provider.frequencyPenalty ?? 0;
        UI.elements.providerHeaders.value = provider.customHeaders ? JSON.stringify(provider.customHeaders) : '';

        document.getElementById('temp-value').textContent = provider.temperature ?? 0.7;
        document.getElementById('topp-value').textContent = provider.topP ?? 1;
        document.getElementById('freq-value').textContent = provider.frequencyPenalty ?? 0;

        // Switch to add tab
        document.querySelector('[data-tab="add-provider"]').click();

        // Temporarily override form submit to update
        const form = UI.elements.formAddProvider;
        const originalSubmit = form.onsubmit;
        form.onsubmit = null;

        const handler = (e) => {
            e.preventDefault();
            this.saveProvider(id); // Pass existing ID for update
            form.removeEventListener('submit', handler);
            form.addEventListener('submit', (e) => { e.preventDefault(); this.saveProvider(); });
        };

        // Remove old listener and add new
        form.removeEventListener('submit', handler);
        form.addEventListener('submit', handler, { once: true });
    },

    deleteProvider(id) {
        if (!confirm('ลบ API นี้?')) return;
        Storage.deleteProvider(id);
        UI.renderProvidersList();
        UI.updateModelSelector();
        UI.notify('🗑️ ลบ API เรียบร้อย', 'info');
    },

    // ===== Persona Operations =====
    savePersona() {
        const name = document.getElementById('persona-name').value.trim();
        const avatar = document.getElementById('persona-avatar').value.trim() || '🤖';
        const prompt = document.getElementById('persona-prompt').value.trim();

        if (!name || !prompt) {
            UI.notify('กรุณากรอกข้อมูลให้ครบ', 'error');
            return;
        }

        const persona = {
            id: Storage.generateId(),
            name,
            avatar,
            prompt,
        };

        Storage.savePersona(persona);
        UI.renderPersonasList();
        UI.notify('✅ บันทึกตัวละครเรียบร้อย', 'success');
        UI.elements.formPersona.reset();
    },

    deletePersona(id) {
        if (!confirm('ลบตัวละครนี้?')) return;
        Storage.deletePersona(id);
        UI.renderPersonasList();
    },

    // ===== Chat Settings =====
    openChatSettings() {
        const chat = ChatEngine.getCurrentChat();
        if (!chat) {
            UI.notify('ยังไม่มีแชทที่เปิดอยู่', 'error');
            return;
        }

        document.getElementById('edit-chat-title').value = chat.title;
        document.getElementById('edit-chat-system').value = chat.systemPrompt || '';
        UI.updatePersonaSelector();
        UI.openModal('modal-chat-settings');
    },

    saveChatSettings() {
        const chat = ChatEngine.getCurrentChat();
        if (!chat) return;

        chat.title = document.getElementById('edit-chat-title').value.trim() || 'สนทนาใหม่';
        chat.personaId = document.getElementById('edit-chat-persona').value || null;
        chat.systemPrompt = document.getElementById('edit-chat-system').value.trim();
        chat.updatedAt = Date.now();

        Storage.saveChat(chat);
        UI.updateHeader(chat);
        UI.renderChatList();
        UI.closeModal('modal-chat-settings');
        UI.notify('✅ บันทึกการตั้งค่าแชทเรียบร้อย', 'success');
    },

    deleteCurrentChat() {
        if (!confirm('ลบแชทนี้?')) return;

        const id = ChatEngine.currentChatId;
        Storage.deleteChat(id);
        ChatEngine.currentChatId = null;
        Storage.setActiveChat(null);

        UI.renderChatList();
        UI.showWelcome(true);
        UI.updateHeader(null);
        UI.closeModal('modal-chat-settings');
    },

    // ===== General Settings =====
    saveGeneralSettings() {
        const settings = {
            theme: UI.elements.settingTheme.value,
            fontSize: UI.elements.settingFontsize.value,
            enterSend: UI.elements.settingEnterSend.value === 'true',
            streaming: UI.elements.settingStreaming.value === 'true',
        };

        Storage.saveSettings(settings);
        UI.applyTheme(settings.theme);
        UI.applyFontSize(settings.fontSize);
    },

    // ===== Input Helpers =====
    autoResizeInput() {
        const input = UI.elements.messageInput;
        input.style.height = 'auto';
        input.style.height = Math.min(input.scrollHeight, 150) + 'px';
    },
};

// Toggle password visibility
function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    input.type = input.type === 'password' ? 'text' : 'password';
}

// ===== Initialize =====
document.addEventListener('DOMContentLoaded', () => App.init());
