// ============================================
// UI Controller — DOM Manipulation & Events
// ============================================

const UI = {
    elements: {},

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
            btnToggleSidebar: document.getElementById('btn-toggle-sidebar'),
            btnChatSettings: document.getElementById('btn-chat-settings'),
            modelSelector: document.getElementById('model-selector'),
            chatTitle: document.getElementById('chat-title'),
            chatStatus: document.getElementById('chat-status'),
            chatAvatar: document.getElementById('chat-avatar'),
            typingIndicator: document.getElementById('typing-indicator'),
            charCount: document.getElementById('char-count'),

            // Modals
            modalSettings: document.getElementById('modal-settings'),
            modalPersona: document.getElementById('modal-persona'),
            modalChatSettings: document.getElementById('modal-chat-settings'),

            // Forms
            formAddProvider: document.getElementById('form-add-provider'),
            formPersona: document.getElementById('form-persona'),

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

            // Settings
            settingTheme: document.getElementById('setting-theme'),
            settingFontsize: document.getElementById('setting-fontsize'),
            settingEnterSend: document.getElementById('setting-enter-send'),
            settingStreaming: document.getElementById('setting-streaming'),

            // Context menu
            contextMenu: document.getElementById('msg-context-menu'),
        };
    },

    // ===== Markdown Parser =====
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
        html = html.replace(/(<li>.*<\/li>\n?)+/g, '<ul>�CODEBLOCK7�</ul>');

        // Ordered list
        html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Line breaks (but not inside pre/code)
        html = html.replace(/\n/g, '<br>');

        // Clean up
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

    // ===== Chat List =====
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
            const persona = chat.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
            const avatar = persona?.avatar || 'AI';

            return `
                <div class="chat-item ${isActive ? 'active' : ''}" data-chat-id="${chat.id}" onclick="App.openChat('${chat.id}')">
                    <div class="chat-item-avatar">${avatar}</div>
                    <div class="chat-item-info">
                        <div class="chat-item-title">${this._escapeHtml(chat.title)}</div>
                        <div class="chat-item-preview">${this._escapeHtml(preview)}</div>
                    </div>
                    <span class="chat-item-time">${time}</span>
                </div>`;
        }).join('');
    },

    // ===== Messages =====
    renderMessages(chat) {
        if (!chat || chat.messages.length === 0) {
            this.showWelcome(true);
            return;
        }

        this.showWelcome(false);
        const wrapper = this.elements.messagesWrapper;
        const persona = chat.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
        const aiAvatar = persona?.avatar || 'AI';

        wrapper.innerHTML = chat.messages.map(msg => this._renderMessage(msg, aiAvatar)).join('');
        this.scrollToBottom();
    },

    _renderMessage(msg, aiAvatar = 'AI') {
        const isUser = msg.role === 'user';
        const avatar = isUser ? '👤' : aiAvatar;
        const content = isUser ? this._escapeHtml(msg.content).replace(/\n/g, '<br>') : this.parseMarkdown(msg.content);
        const time = this._formatTime(msg.timestamp);

        return `
            <div class="message ${msg.role}" data-msg-id="${msg.id}">
                <div class="message-avatar">${avatar}</div>
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

    appendMessage(msg, aiAvatar = 'AI') {
        this.showWelcome(false);
        const wrapper = this.elements.messagesWrapper;
        wrapper.insertAdjacentHTML('beforeend', this._renderMessage(msg, aiAvatar));
        this.scrollToBottom();
    },

    /**
     * Update streaming message content in real-time
     */
    updateStreamingMessage(msgId, content, aiAvatar = 'AI') {
        let msgEl = document.querySelector(`[data-msg-id="${msgId}"]`);

        if (!msgEl) {
            // Create placeholder message
            this.showWelcome(false);
            const html = `
                <div class="message assistant" data-msg-id="${msgId}">
                    <div class="message-avatar">${aiAvatar}</div>
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

    // ===== Provider List =====
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

    // ===== Model Selector =====
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

    // ===== Persona List =====
    renderPersonasList() {
        const personas = Storage.getPersonas();
        const container = document.getElementById('personas-list');

        if (personas.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>ยังไม่มีตัวละคร</p></div>';
            return;
        }

        container.innerHTML = personas.map(p => `
            <div class="persona-card">
                <span class="persona-emoji">${p.avatar || '🤖'}</span>
                <div class="persona-card-info">
                    <h4>${this._escapeHtml(p.name)}</h4>
                    <p>${this._escapeHtml(p.prompt.substring(0, 60))}...</p>
                </div>
                <div class="provider-card-actions">
                    <button class="btn-icon" onclick="App.deletePersona('${p.id}')" title="ลบ">🗑️</button>
                </div>
            </div>
        `).join('');
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

    // ===== UI Helpers =====
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

    updateHeader(chat) {
        if (!chat) {
            this.elements.chatTitle.textContent = 'เริ่มต้นสนทนา';
            this.elements.chatStatus.textContent = 'เลือก API เพื่อเริ่มต้น';
            this.elements.chatAvatar.textContent = 'AI';
            return;
        }

        this.elements.chatTitle.textContent = chat.title;

        const provider = Storage.getProviders().find(p => p.id === chat.providerId);
        this.elements.chatStatus.textContent = provider ? `${provider.name} — ${provider.model}` : 'ยังไม่ได้เลือก API';

        const persona = chat.personaId ? Storage.getPersonas().find(p => p.id === chat.personaId) : null;
        this.elements.chatAvatar.textContent = persona?.avatar || 'AI';
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
        // Simple notification
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
    }
};
