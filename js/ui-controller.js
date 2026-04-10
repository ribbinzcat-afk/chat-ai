// ============================================
// UI Controller — DOM Manipulation & Events
// ============================================

const UI = {
    elements: {},

    // Maximum avatar image size in bytes (2MB)
    MAX_AVATAR_SIZE: 2 * 1024 * 1024,
    // Max dimension for resized avatar
    AVATAR_MAX_DIM: 256,

    /**
     * Cache DOM elements
     */
    cacheElements() {
        this.elements = {
            sidebar: document.getElementById('sidebar'),
            chatList: document.getElementById('chat-list'),
            searchChats: document.getElementById('search-chats'),
            messagesContainer: document.getElementById('messages-container'),
            messagesWrapper: document.getElementById('messages-wrapper'),
            welcomeScreen: document.getElementById('welcome-screen'),
            messageInput: document.getElementById('message-input'),
            btnSend: document.getElementById('btn-send'),
            btnNewChat: document.getElementById('btn-new-chat'),
            btnSettings: document.getElementById('btn-settings'),
            btnPersonas: document.getElementById('btn-personas'),
            btnProfile: document.getElementById('btn-profile'),
            btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
            btnChatSettings: document.getElementById('btn-chat-settings'),
            modelSelector: document.getElementById('model-selector'),
            chatTitle: document.getElementById('chat-title'),
            chatStatus: document.getElementById('chat-status'),
            chatAvatar: document.getElementById('chat-avatar'),
            typingIndicator: document.getElementById('typing-indicator'),
            charCount: document.getElementById('char-count'),

            // Sidebar profile
            sidebarProfileAvatar: document.getElementById('sidebar-profile-avatar'),
            sidebarProfileName: document.getElementById('sidebar-profile-name'),

            // Modals
            modalSettings: document.getElementById('modal-settings'),
            modalPersona: document.getElementById('modal-persona'),
            modalProfile: document.getElementById('modal-profile'),
            modalChatSettings: document.getElementById('modal-chat-settings'),

            // Forms
            formAddProvider: document.getElementById('form-add-provider'),
            formPersona: document.getElementById('form-persona'),
            formProfile: document.getElementById('form-profile'),

            // Provider form fields
            providerType: document.getElementById('provider-type'),
            providerName: document.getElementById('provider-name'),
            providerUrl: document.getElementById('provider-url'),
            providerKey: document.getElementById('provider-key'),
            providerModel: document.getElementById('provider-model'),
            providerSystemPrompt: document.getElementById('provider-system-prompt'),
            providerTemp: document.getElementById('provider-temp'),
            providerMaxTokens: document.getElementById('provider-max-tokens'),
            providerTopP: document.getElementById('provider-top-p'),
            providerFreqPenalty: document.getElementById('provider-freq-penalty'),
            providerHeaders: document.getElementById('provider-headers'),
            groupApiUrl: document.getElementById('group-api-url'),
            groupApiKey: document.getElementById('group-api-key'),

            // Persona form fields
            personaName: document.getElementById('persona-name'),
            personaPrompt: document.getElementById('persona-prompt'),
            personaAvatarFile: document.getElementById('persona-avatar-file'),
            personaAvatarEmoji: document.getElementById('persona-avatar-emoji'),
            personaAvatarData: document.getElementById('persona-avatar-data'),
            personaAvatarPreview: document.getElementById('persona-avatar-preview'),
            personaEditId: document.getElementById('persona-edit-id'),
            btnRemovePersonaAvatar: document.getElementById('btn-remove-persona-avatar'),

            // Profile form fields
            profileName: document.getElementById('profile-name'),
            profileBio: document.getElementById('profile-bio'),
            profileAvatarFile: document.getElementById('profile-avatar-file'),
            profileAvatarData: document.getElementById('profile-avatar-data'),
            profileAvatarPreview: document.getElementById('profile-avatar-preview'),
            btnRemoveProfileAvatar: document.getElementById('btn-remove-profile-avatar'),

            // Settings
            settingTheme: document.getElementById('setting-theme'),
            settingFontsize: document.getElementById('setting-fontsize'),
            settingEnterSend: document.getElementById('setting-enter-send'),
            settingStreaming: document.getElementById('setting-streaming'),

            // Context menu
            contextMenu: document.getElementById('msg-context-menu'),

            // Prompt form fields
promptName: document.getElementById('prompt-name'),
promptContent: document.getElementById('prompt-content'),
promptTags: document.getElementById('prompt-tags'),
promptEditId: document.getElementById('prompt-edit-id'),
searchPrompts: document.getElementById('search-prompts'),
btnPrompts: document.getElementById('btn-prompts'),

        };
    },

    // ========================================
    //  IMAGE PROCESSING UTILITIES
    // ========================================

    /**
     * Process an uploaded image file:
     * - Validate type & size
     * - Resize to AVATAR_MAX_DIM
     * - Return base64 data URL
     */
    processAvatarImage(file) {
        return new Promise((resolve, reject) => {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                reject(new Error('กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WEBP)'));
                return;
            }

            // Validate file size
            if (file.size > this.MAX_AVATAR_SIZE) {
                reject(new Error('ไฟล์มีขนาดใหญ่เกิน 2MB'));
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    // Resize image
                    const canvas = document.createElement('canvas');
                    const maxDim = this.AVATAR_MAX_DIM;
                    let { width, height } = img;

                    // Calculate new dimensions (maintain aspect ratio, crop to square)
                    const size = Math.min(width, height);
                    const sx = (width - size) / 2;
                    const sy = (height - size) / 2;

                    canvas.width = maxDim;
                    canvas.height = maxDim;

                    const ctx = canvas.getContext('2d');
                    // Draw cropped & resized
                    ctx.drawImage(img, sx, sy, size, size, 0, 0, maxDim, maxDim);

                    // Convert to base64 (JPEG for smaller size)
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                    resolve(dataUrl);
                };
                img.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์รูปภาพได้'));
                img.src = e.target.result;
            };
            reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
            reader.readAsDataURL(file);
        });
    },

    /**
     * Set avatar preview element with image or emoji or placeholder
     * @param {HTMLElement} previewEl - The preview container
     * @param {Object} options - { imageData, emoji }
     */
    setAvatarPreview(previewEl, { imageData = null, emoji = null } = {}) {
        if (imageData) {
            previewEl.innerHTML = `<img src="${imageData}" alt="Avatar">`;
            previewEl.classList.add('has-image');
        } else if (emoji) {
            previewEl.innerHTML = `<span class="avatar-emoji-display">${emoji}</span>`;
            previewEl.classList.remove('has-image');
        } else {
            previewEl.innerHTML = `
                <span class="avatar-placeholder-icon">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                    </svg>
                </span>`;
            previewEl.classList.remove('has-image');
        }
    },

    /**
     * Render an avatar as HTML string
     * Returns <img> for image data or text/emoji
     */
    renderAvatarHTML(avatarData, emoji, fallback = 'AI') {
        if (avatarData) {
            return `<img src="${avatarData}" alt="Avatar">`;
        }
        return emoji || fallback;
    },

    // ========================================
    //  PROFILE
    // ========================================

    /**
     * Load profile data into sidebar and forms
     */
    loadProfileUI() {
        const profile = Storage.getProfile();

        // Sidebar
        this.elements.sidebarProfileName.textContent = profile.name || 'ผู้ใช้';

        const sidebarAvatar = this.elements.sidebarProfileAvatar;
        if (profile.avatarData) {
            sidebarAvatar.innerHTML = `<img src="${profile.avatarData}" alt="Profile">`;
        } else {
            sidebarAvatar.innerHTML = '<span>👤</span>';
        }
    },

    /**
     * Populate profile modal with current data
     */
    populateProfileModal() {
        const profile = Storage.getProfile();

        this.elements.profileName.value = profile.name || '';
        this.elements.profileBio.value = profile.bio || '';
        this.elements.profileAvatarData.value = profile.avatarData || '';

        // Set preview
        this.setAvatarPreview(this.elements.profileAvatarPreview, {
            imageData: profile.avatarData,
        });

        // Show/hide remove button
        this.elements.btnRemoveProfileAvatar.style.display = profile.avatarData ? 'inline-flex' : 'none';
    },

    // ========================================
    //  MARKDOWN PARSER
    // ========================================

    parseMarkdown(text) {
        if (!text) return '';

        let html = this._escapeHtml(text);

        // Code blocks
        html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
            return `<div class="code-block-wrapper"><button class="btn-copy-code" onclick="UI.copyCode(this)">📋 Copy</button><pre><code class="language-${lang}">${code.trim()}</code></pre></div>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

        // Bold
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

        // Italic
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Strikethrough
        html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');

        // Headers
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Blockquote
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

        // Unordered list
        html = html.replace(/^[\-\*] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>');

        // Ordered list
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Line breaks
        html = html.replace(/\n/g, '<br>');

        html = html.replace(/<br><\/?(h[1-3]|ul|ol|li|blockquote|div|pre)/g, '</$1');
        html = html.replace(/<\/(h[1-3]|ul|ol|li|blockquote|div|pre)><br>/g, '</$1>');

        return html;
    },

    _escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    copyCode(btn) {
        const code = btn.nextElementSibling.textContent;
        navigator.clipboard.writeText(code).then(() => {
            btn.textContent = '✅ Copied!';
            setTimeout(() => btn.textContent = '📋 Copy', 2000);
        });
    },


    // ========================================
    //  CHAT LIST
    // ========================================

    renderChatList(filter = '') {
        const chats = Storage.getChats();
        const container = this.elements.chatList;
        const filterLower = filter.toLowerCase();

        const filtered = filter
            ? chats.filter(c => c.title.toLowerCase().includes(filterLower))
            : chats;

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                    <p>${filter ? 'ไม่พบแชทที่ค้นหา' : 'ยังไม่มีแชท<br>กด + เพื่อเริ่มสนทนาใหม่'}</p>
                </div>`;
            return;
        }

        container.innerHTML = filtered.map(chat => {
            const lastMsg = chat.messages[chat.messages.length - 1];
            const preview = lastMsg ? lastMsg.content.substring(0, 50) : 'ยังไม่มีข้อความ';
            const time = this._formatTime(chat.updatedAt);
            const isActive = chat.id === ChatEngine.currentChatId;

            // Get persona avatar
            const persona = chat.personaId ? Storage.getPersona(chat.personaId) : null;
            const avatarHTML = persona
                ? this.renderAvatarHTML(persona.avatarData, persona.avatar, 'AI')
                : 'AI';

            return `
                <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}" onclick="App.openChat('${chat.id}')">
                    <div class="chat-item-avatar">${avatarHTML}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-title">${this._escapeHtml(chat.title)}</div>
                        <div class="chat-item-preview">${this._escapeHtml(preview)}</div>
                    </div>
                    <span class="chat-item-time">${time}</span>
                </div>`;
        }).join('');
    },

    // ========================================
    //  MESSAGES
    // ========================================

    renderMessages(chat) {
        if (!chat || chat.messages.length === 0) {
            this.showWelcome(true);
            return;
        }

        this.showWelcome(false);
        const wrapper = this.elements.messagesWrapper;

        // Resolve avatars
        const persona = chat.personaId ? Storage.getPersona(chat.personaId) : null;
        const profile = Storage.getProfile();

        wrapper.innerHTML = chat.messages.map(msg =>
            this._renderMessage(msg, persona, profile)
        ).join('');

        this.scrollToBottom();
    },


    _renderMessage(msg, persona = null, profile = null) {
        const isUser = msg.role === 'user';

        if (!profile) profile = Storage.getProfile();

        let avatarHTML;
        let avatarClass = '';
        if (isUser) {
            if (profile.avatarData) {
                avatarHTML = `<img src="${profile.avatarData}" alt="User">`;
                avatarClass = 'has-image';
            } else {
                avatarHTML = '👤';
            }
        } else {
            if (persona?.avatarData) {
                avatarHTML = `<img src="${persona.avatarData}" alt="AI">`;
            } else {
                avatarHTML = persona?.avatar || 'AI';
            }
        }

        const content = isUser
            ? this._escapeHtml(msg.content).replace(/\n/g, '<br>')
            : this.parseMarkdown(msg.content);
        const time = this._formatTime(msg.timestamp);

        return `
            <div class="message ${msg.role}" data-msg-id="${msg.id}">
                <div class="message-avatar ${avatarClass}">${avatarHTML}</div>
                <div class="message-content">
                    <div class="message-bubble">${content}</div>
                    <div class="message-time">${time}</div>
                    <div class="message-actions">
                        ${isUser ? `<button onclick="App.editMessage('${msg.id}')" title="แก้ไข">✏️</button>` : ''}
                        <button onclick="App.copyMessage('${msg.id}')" title="คัดลอก">📋</button>
                        ${!isUser ? `<button onclick="App.regenerateMessage()" title="สร้างใหม่">🔄</button>` : ''}
                        <button onclick="App.deleteMessage('${msg.id}')" title="ลบ">🗑️</button>
                    </div>
                </div>
            </div>`;
    },

    appendMessage(msg, persona = null) {
        this.showWelcome(false);
        const wrapper = this.elements.messagesWrapper;
        const profile = Storage.getProfile();
        wrapper.insertAdjacentHTML('beforeend', this._renderMessage(msg, persona, profile));
        this.scrollToBottom();
    },

    updateStreamingMessage(msgId, content, persona = null) {
        let msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);

        if (!msgEl) {
            this.showWelcome(false);

            let avatarHTML;
            if (persona?.avatarData) {
                avatarHTML = `<img src="${persona.avatarData}" alt="AI">`;
            } else {
                avatarHTML = persona?.avatar || 'AI';
            }

            const html = `
                <div class="message assistant" data-msg-id="${msgId}">
                    <div class="message-avatar">${avatarHTML}</div>
                    <div class="message-content">
                        <div class="message-bubble"></div>
                        <div class="message-time">กำลังพิมพ์...</div>
                        <div class="message-actions">
                            <button onclick="App.copyMessage('${msgId}')" title="คัดลอก">📋</button>
                            <button onclick="App.regenerateMessage()" title="สร้างใหม่">🔄</button>
                            <button onclick="App.deleteMessage('${msgId}')" title="ลบ">🗑️</button>
                        </div>
                    </div>
                </div>`;
            this.elements.messagesWrapper.insertAdjacentHTML('beforeend', html);
            msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
        }

        const bubble = msgEl.querySelector('.message-bubble');
        bubble.innerHTML = this.parseMarkdown(content);
        this.scrollToBottom();
    },

    finalizeStreamingMessage(msgId) {
        const msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);
        if (msgEl) {
            const timeEl = msgEl.querySelector('.message-time');
            timeEl.textContent = this._formatTime(Date.now());
        }
    },

    // ========================================
    //  PROVIDERS LIST
    // ========================================

    renderProvidersList() {
        const providers = Storage.getProviders();
        const container = document.getElementById('providers-list');

        if (providers.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <p>ยังไม่มี API ที่ตั้งค่า<br>ไปที่แท็บ "เพิ่ม API ใหม่" เพื่อเริ่มต้น</p>
                </div>`;
            return;
        }

        container.innerHTML = providers.map(p => {
            const config = APIManager.PROVIDER_CONFIGS[p.type];
            return `
                <div class="provider-card">
                    <div class="provider-card-info">
                        <h4>${this._escapeHtml(p.name)}</h4>
                        <span>${config?.name || p.type} — ${p.model || 'default'}</span>
                    </div>
                    <div class="provider-card-actions">
                        <button class="btn-icon" onclick="App.testProvider('${p.id}')" title="ทดสอบ">🔗</button>
                        <button class="btn-icon" onclick="App.editProvider('${p.id}')" title="แก้ไข">✏️</button>
                        <button class="btn-icon" onclick="App.deleteProvider('${p.id}')" title="ลบ">🗑️</button>
                    </div>
                </div>`;
        }).join('');
    },

    // ========================================
    //  MODEL SELECTOR
    // ========================================

    updateModelSelector() {
        const providers = Storage.getProviders();
        const select = this.elements.modelSelector;
        const currentChat = ChatEngine.getCurrentChat();

        select.innerHTML = '<option value="">-- เลือก API --</option>';
        providers.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = p.name;
            if (currentChat?.providerId === p.id) opt.selected = true;
            select.appendChild(opt);
        });
    },

    // ========================================
    //  PERSONA LIST (Updated with image avatars)
    // ========================================

    renderPersonasList() {
        const personas = Storage.getPersonas();
        const container = document.getElementById('personas-list');

        if (personas.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>ยังไม่มีตัวละคร</p></div>';
            return;
        }

        container.innerHTML = personas.map(p => {
            const avatarInner = p.avatarData
                ? `<img src="${p.avatarData}" alt="${this._escapeHtml(p.name)}">`
                : (p.avatar || '🤖');

            return `
            <div class="persona-card">
                <div class="persona-card-avatar">${avatarInner}</div>
                <div class="persona-card-info">
                    <h4>${this._escapeHtml(p.name)}</h4>
                    <p>${this._escapeHtml(p.prompt.substring(0, 60))}${p.prompt.length > 60 ? '...' : ''}</p>
                </div>
                <div class="persona-card-actions">
                    <button class="btn-icon" onclick="App.editPersona('${p.id}')" title="แก้ไข">✏️</button>
                    <button class="btn-icon" onclick="App.deletePersona('${p.id}')" title="ลบ">🗑️</button>
                </div>
            </div>`;
        }).join('');
    },

    /**
     * Reset persona form to blank state
     */
    resetPersonaForm() {
        this.elements.formPersona.reset();
        this.elements.personaEditId.value = '';
        this.elements.personaAvatarData.value = '';
        this.setAvatarPreview(this.elements.personaAvatarPreview, {});
        this.elements.btnRemovePersonaAvatar.style.display = 'none';
    },

    /**
     * Populate persona form for editing
     */
    populatePersonaForm(persona) {
        this.elements.personaEditId.value = persona.id;
        this.elements.personaName.value = persona.name;
        this.elements.personaPrompt.value = persona.prompt;
        this.elements.personaAvatarEmoji.value = persona.avatar || '';
        this.elements.personaAvatarData.value = persona.avatarData || '';

        // Set preview
        this.setAvatarPreview(this.elements.personaAvatarPreview, {
            imageData: persona.avatarData,
            emoji: persona.avatar,
        });

        this.elements.btnRemovePersonaAvatar.style.display = persona.avatarData ? 'inline-flex' : 'none';
    },

    updatePersonaSelector() {
        const select = document.getElementById('edit-chat-persona');
        if (!select) return;

        const personas = Storage.getPersonas();
        const chat = ChatEngine.getCurrentChat();

        select.innerHTML = '<option value="">-- ไม่ใช้ --</option>';
        personas.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.id;
            opt.textContent = `${p.avatar || '🤖'} ${p.name}`;
            if (chat?.personaId === p.id) opt.selected = true;
            select.appendChild(opt);
        });
    },

    // ========================================
    //  HEADER
    // ========================================

    updateHeader(chat) {
        if (!chat) {
            this.elements.chatTitle.textContent = 'เริ่มต้นสนทนา';
            this.elements.chatStatus.textContent = 'เลือก API เพื่อเริ่มต้น';
            this.elements.chatAvatar.innerHTML = 'AI';
            return;
        }

        this.elements.chatTitle.textContent = chat.title;

        const provider = Storage.getProviders().find(p => p.id === chat.providerId);
        this.elements.chatStatus.textContent = provider
            ? `${provider.name} — ${provider.model}`
            : 'ยังไม่ได้เลือก API';

        // Avatar
        const persona = chat.personaId ? Storage.getPersona(chat.personaId) : null;
        if (persona?.avatarData) {
            this.elements.chatAvatar.innerHTML = `<img src="${persona.avatarData}" alt="AI">`;
        } else {
            this.elements.chatAvatar.innerHTML = persona?.avatar || 'AI';
        }
    },

    // ========================================
    //  UI HELPERS
    // ========================================

    showWelcome(show) {
        this.elements.welcomeScreen.style.display = show ? 'flex' : 'none';
        this.elements.messagesContainer.classList.toggle('active', !show);
    },

    showTyping(show) {
        this.elements.typingIndicator.style.display = show ? 'flex' : 'none';
        if (show) this.scrollToBottom();
    },

    scrollToBottom() {
        const container = this.elements.messagesContainer;
        requestAnimationFrame(() => {
            container.scrollTop = container.scrollHeight;
        });
    },

    // ===== Modals =====
    openModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.add('active');
    },

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.remove('active');
    },

    closeAllModals() {
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
    },

    // ===== Notifications =====
    notify(message, type = 'info') {
        const colors = {
            info: 'var(--accent)',
            success: 'var(--success)',
            error: 'var(--danger)',
        };

        const notif = document.createElement('div');
        notif.style.cssText = `
            position: fixed; top: 20px; right: 20px; z-index: 9999;
            padding: 12px 20px; border-radius: 8px; font-size: 14px;
            background: ${colors[type]}; color: white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            animation: msgFadeIn 0.3s ease;
            font-family: var(--font-family);
            max-width: 400px;
        `;
        notif.textContent = message;
        document.body.appendChild(notif);
        setTimeout(() => {
            notif.style.opacity = '0';
            notif.style.transition = 'opacity 0.3s';
            setTimeout(() => notif.remove(), 300);
        }, 3000);
    },

    // ===== Time Formatting =====
    _formatTime(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const now = new Date();
        const diffDays = Math.floor((now - date) / 86400000);

        const timeStr = date.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });

        if (diffDays === 0) return timeStr;
        if (diffDays === 1) return `เมื่อวาน ${timeStr}`;
        if (diffDays < 7) return `${diffDays} วันก่อน`;
        return date.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' });
    },

    // ===== Theme =====
    applyTheme(theme) {
        if (theme === 'auto') {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
    },

    applyFontSize(size) {
        document.documentElement.setAttribute('data-fontsize', size);
    },

    // ========================================
//  SYSTEM PROMPTS LIBRARY
// ========================================

renderPromptsList(filter = '') {
    const prompts = Storage.getPrompts();
    const container = document.getElementById('prompts-list');
    const filterLower = filter.toLowerCase();

    const filtered = filter
        ? prompts.filter(p =>
            p.name.toLowerCase().includes(filterLower) ||
            p.content.toLowerCase().includes(filterLower) ||
            (p.tags || []).some(t => t.toLowerCase().includes(filterLower))
        )
        : prompts;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <p>${filter ? 'ไม่พบ prompt ที่ค้นหา' : 'ยังไม่มี System Prompt ที่บันทึกไว้'}</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const tagsHTML = (p.tags || []).map(t =>
            `<span class="prompt-tag">${this._escapeHtml(t)}</span>`
        ).join('');

        const dateStr = this._formatTime(p.updatedAt || p.createdAt);

        return `
        <div class="prompt-card" data-prompt-id="${p.id}">
            <div class="prompt-card-header">
                <h4>${this._escapeHtml(p.name)}</h4>
                <div class="prompt-card-actions">
                    <button class="btn-icon" onclick="App.editPrompt('${p.id}')" title="แก้ไข">✏️</button>
                    <button class="btn-icon" onclick="App.duplicatePrompt('${p.id}')" title="ทำสำเนา">📋</button>
                    <button class="btn-icon" onclick="App.deletePrompt('${p.id}')" title="ลบ">🗑️</button>
                </div>
            </div>
            <div class="prompt-card-preview">${this._escapeHtml(p.content)}</div>
            <div class="prompt-card-footer">
                <div class="prompt-card-tags">${tagsHTML}</div>
                <span class="prompt-card-date">${dateStr}</span>
            </div>
        </div>`;
    }).join('');
},

/**
 * Reset prompt form to blank state
 */
resetPromptForm() {
    document.getElementById('form-prompt').reset();
    document.getElementById('prompt-edit-id').value = '';
},

/**
 * Populate prompt form for editing
 */
populatePromptForm(prompt) {
    this.elements.promptEditId.value = prompt.id;
    this.elements.promptName.value = prompt.name;
    this.elements.promptContent.value = prompt.content;
    this.elements.promptTags.value = (prompt.tags || []).join(', ');
},

/**
 * Populate a <select> dropdown with saved prompts
 * @param {string} selectId - ID of the <select> element
 * @param {string} currentValue - current system prompt text (to auto-match)
 */
populatePromptDropdown(selectId, currentValue = '') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const prompts = Storage.getPrompts();

    // Keep first default option, clear the rest
    select.innerHTML = '<option value="">-- เลือกจากคลัง (ไม่บังคับ) --</option>';

    prompts.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        // Auto-select if content matches
        if (currentValue && p.content.trim() === currentValue.trim()) {
            opt.selected = true;
        }
        select.appendChild(opt);
    });
},

};
