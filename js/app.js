// ============================================
// App — Main Application Controller
// ============================================

const App = {
    init() {
        UI.cacheElements();
        this.loadSettings();
        this.bindEvents();
        this.loadInitialState();
        UI.loadProfileUI();
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
        // ---- Core Chat ----
        UI.elements.btnNewChat.addEventListener('click', () => this.newChat());
        UI.elements.btnSend.addEventListener('click', () => this.sendMessage());

        UI.elements.messageInput.addEventListener('input', () => {
            this.autoResizeInput();
            UI.elements.charCount.textContent = UI.elements.messageInput.value.length;
        });

        UI.elements.messageInput.addEventListener('keydown', (e) => {
            const settings = Storage.getSettings();
            if (settings.enterSend) {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this.sendMessage(); }
            } else {
                if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); this.sendMessage(); }
            }
        });

        UI.elements.modelSelector.addEventListener('change', (e) => {
            const chat = ChatEngine.getCurrentChat();
            if (chat) {
                chat.providerId = e.target.value;
                Storage.saveChat(chat);
                UI.updateHeader(chat);
            }
        });

        // ---- Sidebar ----
        UI.elements.btnToggleSidebar.addEventListener('click', () => {
            UI.elements.sidebar.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (UI.elements.sidebar.classList.contains('open') &&
                !UI.elements.sidebar.contains(e.target) &&
                e.target !== UI.elements.btnToggleSidebar) {
                UI.elements.sidebar.classList.remove('open');
            }
        });

        UI.elements.searchChats.addEventListener('input', (e) => {
            UI.renderChatList(e.target.value);
        });

        // ---- Modal Triggers ----
        UI.elements.btnSettings.addEventListener('click', () => {
            UI.renderProvidersList();
            UI.openModal('modal-settings');
        });

        UI.elements.btnPersonas.addEventListener('click', () => {
            UI.resetPersonaForm();
            UI.renderPersonasList();
            UI.openModal('modal-persona');
        });

        UI.elements.btnProfile.addEventListener('click', () => {
            UI.populateProfileModal();
            UI.openModal('modal-profile');
        });

        UI.elements.btnChatSettings.addEventListener('click', () => {
            this.openChatSettings();
        });

        // ---- Modal Close ----
        document.querySelectorAll('.modal-close, .modal-overlay').forEach(el => {
            el.addEventListener('click', () => UI.closeAllModals());
        });

        // ---- Tabs ----
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                const tabGroup = btn.closest('.modal-body') || document;
                tabGroup.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                tabGroup.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                btn.classList.add('active');
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });

        // ---- Provider Type Change ----
        UI.elements.providerType.addEventListener('change', (e) => {
            const type = e.target.value;
            const config = APIManager.PROVIDER_CONFIGS[type];
            const showUrl = ['custom', 'ollama'].includes(type);
            UI.elements.groupApiUrl.style.display = showUrl ? 'block' : 'none';
            const hideKey = type === 'ollama';
            UI.elements.groupApiKey.style.display = hideKey ? 'none' : 'block';
            if (config?.defaultModel) UI.elements.providerModel.value = config.defaultModel;
            if (type === 'ollama') UI.elements.providerUrl.value = 'http://localhost:11434';
        });

        // ---- Provider Form ----
        UI.elements.formAddProvider.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProvider();
        });

        // ========================================
        //  PERSONA AVATAR UPLOAD EVENTS
        // ========================================

        // Click on preview to trigger file input
        UI.elements.personaAvatarPreview.addEventListener('click', () => {
            UI.elements.personaAvatarFile.click();
        });

        // File input change
        UI.elements.personaAvatarFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const dataUrl = await UI.processAvatarImage(file);
                UI.elements.personaAvatarData.value = dataUrl;
                UI.elements.personaAvatarEmoji.value = ''; // Clear emoji when image uploaded
                UI.setAvatarPreview(UI.elements.personaAvatarPreview, { imageData: dataUrl });
                UI.elements.btnRemovePersonaAvatar.style.display = 'inline-flex';
            } catch (err) {
                UI.notify(`❌ ${err.message}`, 'error');
            }

            // Reset file input so same file can be selected again
            e.target.value = '';
        });

        // Emoji input change (fallback)
        UI.elements.personaAvatarEmoji.addEventListener('input', (e) => {
            const emoji = e.target.value;
            if (emoji && !UI.elements.personaAvatarData.value) {
                UI.setAvatarPreview(UI.elements.personaAvatarPreview, { emoji });
            }
        });

        // Remove persona avatar
        UI.elements.btnRemovePersonaAvatar.addEventListener('click', () => {
            UI.elements.personaAvatarData.value = '';
            UI.elements.personaAvatarFile.value = '';
            const emoji = UI.elements.personaAvatarEmoji.value;
            UI.setAvatarPreview(UI.elements.personaAvatarPreview, { emoji: emoji || null });
            UI.elements.btnRemovePersonaAvatar.style.display = 'none';
        });

        // Drag and drop on persona avatar
        this._setupDragDrop(UI.elements.personaAvatarPreview, async (file) => {
            try {
                const dataUrl = await UI.processAvatarImage(file);
                UI.elements.personaAvatarData.value = dataUrl;
                UI.elements.personaAvatarEmoji.value = '';
                UI.setAvatarPreview(UI.elements.personaAvatarPreview, { imageData: dataUrl });
                UI.elements.btnRemovePersonaAvatar.style.display = 'inline-flex';
            } catch (err) {
                UI.notify(`❌ ${err.message}`, 'error');
            }
        });

        // ---- Persona Form Submit ----
        UI.elements.formPersona.addEventListener('submit', (e) => {
            e.preventDefault();
            this.savePersona();
        });

        // ========================================
        //  PROFILE AVATAR UPLOAD EVENTS
        // ========================================

        UI.elements.profileAvatarPreview.addEventListener('click', () => {
            UI.elements.profileAvatarFile.click();
        });

        UI.elements.profileAvatarFile.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const dataUrl = await UI.processAvatarImage(file);
                UI.elements.profileAvatarData.value = dataUrl;
                UI.setAvatarPreview(UI.elements.profileAvatarPreview, { imageData: dataUrl });
                UI.elements.btnRemoveProfileAvatar.style.display = 'inline-flex';
            } catch (err) {
                UI.notify(`❌ ${err.message}`, 'error');
            }

            e.target.value = '';
        });

        UI.elements.btnRemoveProfileAvatar.addEventListener('click', () => {
            UI.elements.profileAvatarData.value = '';
            UI.elements.profileAvatarFile.value = '';
            UI.setAvatarPreview(UI.elements.profileAvatarPreview, {});
            UI.elements.btnRemoveProfileAvatar.style.display = 'none';
        });

        // Drag and drop on profile avatar
        this._setupDragDrop(UI.elements.profileAvatarPreview, async (file) => {
            try {
                const dataUrl = await UI.processAvatarImage(file);
                UI.elements.profileAvatarData.value = dataUrl;
                UI.setAvatarPreview(UI.elements.profileAvatarPreview, { imageData: dataUrl });
                UI.elements.btnRemoveProfileAvatar.style.display = 'inline-flex';
            } catch (err) {
                UI.notify(`❌ ${err.message}`, 'error');
            }
        });

        // ---- Profile Form Submit ----
        UI.elements.formProfile.addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveProfile();
        });

        // ---- Chat Settings ----
        document.getElementById('btn-save-chat-settings').addEventListener('click', () => this.saveChatSettings());
        document.getElementById('btn-delete-chat').addEventListener('click', () => this.deleteCurrentChat());
        document.getElementById('btn-export-chat').addEventListener('click', () => ChatEngine.exportChat());

        // ---- General Settings auto-save ----
        ['settingTheme', 'settingFontsize', 'settingEnterSend', 'settingStreaming'].forEach(key => {
            UI.elements[key].addEventListener('change', () => this.saveGeneralSettings());
        });

        // ---- Clear all data ----
        document.getElementById('btn-clear-all-data').addEventListener('click', () => {
            if (confirm('⚠️ คุณแน่ใจหรือว่าต้องการลบข้อมูลทั้งหมด? การกระทำนี้ไม่สามารถย้อนกลับได้')) {
                Storage.clearAll();
                location.reload();
            }
        });

        // ---- Keyboard shortcuts ----
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); this.newChat(); }
            if (e.key === 'Escape') UI.closeAllModals();
        });

        document.addEventListener('click', () => {
            UI.elements.contextMenu.style.display = 'none';
        });
    },

    // ========================================
    //  DRAG & DROP HELPER
    // ========================================

    _setupDragDrop(targetEl, onFileDrop) {
        targetEl.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.stopPropagation();
            targetEl.classList.add('dragging');
        });

        targetEl.addEventListener('dragleave', (e) => {
            e.preventDefault();
            e.stopPropagation();
            targetEl.classList.remove('dragging');
        });

        targetEl.addEventListener('drop', (e) => {
            e.preventDefault();
            e.stopPropagation();
            targetEl.classList.remove('dragging');

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('image/')) {
                onFileDrop(files[0]);
            }
        });
    },

    // ========================================
    //  CHAT OPERATIONS
    // ========================================

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

        if (!ChatEngine.currentChatId) {
            ChatEngine.createChat(providerId);
        }

        const chat = ChatEngine.getCurrentChat();
        if (chat) {
            chat.providerId = providerId;
            Storage.saveChat(chat);
        }

        input.value = '';
        input.style.height = 'auto';
        UI.elements.charCount.textContent = '0';

        const userMsg = {
            id: Storage.generateId(),
            role: 'user',
            content: content,
            timestamp: Date.now(),
        };

        const persona = chat?.personaId ? Storage.getPersona(chat.personaId) : null;

        UI.appendMessage(userMsg, persona);
        UI.showTyping(true);
        UI.elements.btnSend.disabled = true;

        let streamingMsgId = null;

        try {
            const aiMsg = await ChatEngine.sendMessage(content, {
                providerId,
                onChunk: (delta, fullText, msgId) => {
                    streamingMsgId = msgId;
                    UI.showTyping(false);
                    UI.updateStreamingMessage(msgId, fullText, persona);
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

            if (aiMsg && !streamingMsgId) {
                UI.appendMessage(aiMsg, persona);
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

    // ========================================
    //  MESSAGE ACTIONS
    // ========================================

    async editMessage(msgId) {
        const chat = ChatEngine.getCurrentChat();
        if (!chat) return;

        const msg = chat.messages.find(m => m.id === msgId);
        if (!msg) return;

        const newContent = prompt('แก้ไขข้อความ:', msg.content);
        if (newContent === null || newContent === msg.content) return;

        const persona = chat.personaId ? Storage.getPersona(chat.personaId) : null;

        UI.showTyping(true);

        try {
            await ChatEngine.editMessage(msgId, newContent, {
                onChunk: (delta, fullText, newMsgId) => {
                    UI.showTyping(false);
                    const updatedChat = ChatEngine.getCurrentChat();
                    UI.renderMessages(updatedChat);
                    UI.updateStreamingMessage(newMsgId, fullText, persona);
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

        const persona = chat.personaId ? Storage.getPersona(chat.personaId) : null;

        const lastMsgEl = UI.elements.messagesWrapper.lastElementChild;
        if (lastMsgEl) lastMsgEl.remove();

        UI.showTyping(true);

        try {
            await ChatEngine.regenerateLastResponse({
                onChunk: (delta, fullText, msgId) => {
                    UI.showTyping(false);
                    UI.updateStreamingMessage(msgId, fullText, persona);
                },
                onDone: () => {
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

    // ========================================
    //  PROVIDER OPERATIONS
    // ========================================

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
            type, name,
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

        UI.elements.formAddProvider.reset();
        UI.elements.groupApiUrl.style.display = 'none';
        UI.elements.groupApiKey.style.display = 'block';
        document.getElementById('temp-value').textContent = '0.7';
        document.getElementById('topp-value').textContent = '1.0';
        document.getElementById('freq-value').textContent = '0';

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

        document.querySelector('[data-tab="add-provider"]').click();

        const handler = (e) => {
            e.preventDefault();
            this.saveProvider(id);
            UI.elements.formAddProvider.removeEventListener('submit', handler);
            UI.elements.formAddProvider.addEventListener('submit', (e) => { e.preventDefault(); this.saveProvider(); });
        };
        UI.elements.formAddProvider.addEventListener('submit', handler, { once: true });
    },

    deleteProvider(id) {
        if (!confirm('ลบ API นี้?')) return;
        Storage.deleteProvider(id);
        UI.renderProvidersList();
        UI.updateModelSelector();
        UI.notify('🗑️ ลบ API เรียบร้อย', 'info');
    },

    // ========================================
    //  PERSONA OPERATIONS (Updated)
    // ========================================

    savePersona() {
        const name = UI.elements.personaName.value.trim();
        const prompt = UI.elements.personaPrompt.value.trim();
        const avatarData = UI.elements.personaAvatarData.value || null;
        const emoji = UI.elements.personaAvatarEmoji.value.trim() || null;
        const editId = UI.elements.personaEditId.value || null;

        if (!name || !prompt) {
            UI.notify('กรุณากรอกชื่อและ System Prompt', 'error');
            return;
        }

        const persona = {
            id: editId || Storage.generateId(),
            name,
            avatar: avatarData ? null : (emoji || '🤖'), // emoji only if no image
            avatarData: avatarData, // base64 image or null
            prompt,
        };

        Storage.savePersona(persona);
        UI.renderPersonasList();
        UI.resetPersonaForm();
        UI.notify(`✅ ${editId ? 'แก้ไข' : 'บันทึก'}ตัวละครเรียบร้อย`, 'success');
    },

    editPersona(id) {
        const persona = Storage.getPersona(id);
        if (!persona) return;
        UI.populatePersonaForm(persona);

        // Scroll form into view
        UI.elements.formPersona.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    deletePersona(id) {
        if (!confirm('ลบตัวละครนี้?')) return;
        Storage.deletePersona(id);
        UI.renderPersonasList();
        UI.notify('🗑️ ลบตัวละครเรียบร้อย', 'info');
    },

    // ========================================
    //  PROFILE OPERATIONS (New)
    // ========================================

    saveProfile() {
        const name = UI.elements.profileName.value.trim();
        if (!name) {
            UI.notify('กรุณากรอกชื่อผู้ใช้', 'error');
            return;
        }

        const profile = {
            name,
            bio: UI.elements.profileBio.value.trim(),
            avatarData: UI.elements.profileAvatarData.value || null,
        };

        Storage.saveProfile(profile);
        UI.loadProfileUI();

        // Re-render messages to update user avatars
        const chat = ChatEngine.getCurrentChat();
        if (chat) UI.renderMessages(chat);

        UI.closeModal('modal-profile');
        UI.notify('✅ บันทึกโปรไฟล์เรียบร้อย', 'success');
    },

    // ========================================
    //  CHAT SETTINGS
    // ========================================

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
        UI.renderMessages(chat); // Re-render to apply new persona avatar
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

    // ========================================
    //  GENERAL SETTINGS
    // ========================================

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

    // ========================================
    //  HELPERS
    // ========================================

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
