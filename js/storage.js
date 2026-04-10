// ============================================
// Storage Manager — LocalStorage Abstraction
// ============================================

const Storage = {
    KEYS: {
        PROVIDERS: 'acs_providers',
        CHATS: 'acs_chats',
        ACTIVE_CHAT: 'acs_active_chat',
        PERSONAS: 'acs_personas',
        SETTINGS: 'acs_settings',
    },

    get(key, fallback = null) {
        try {
            const data = localStorage.getItem(key);
            return data ? JSON.parse(data) : fallback;
        } catch {
            return fallback;
        }
    },

    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage error:', e);
        }
    },

    remove(key) {
        localStorage.removeItem(key);
    },

    // ---- Providers ----
    getProviders() {
        return this.get(this.KEYS.PROVIDERS, []);
    },

    saveProvider(provider) {
        const providers = this.getProviders();
        const idx = providers.findIndex(p => p.id === provider.id);
        if (idx >= 0) providers[idx] = provider;
        else providers.push(provider);
        this.set(this.KEYS.PROVIDERS, providers);
    },

    deleteProvider(id) {
        const providers = this.getProviders().filter(p => p.id !== id);
        this.set(this.KEYS.PROVIDERS, providers);
    },

    // ---- Chats ----
    getChats() {
        return this.get(this.KEYS.CHATS, []);
    },

    getChat(id) {
        return this.getChats().find(c => c.id === id) || null;
    },

    saveChat(chat) {
        const chats = this.getChats();
        const idx = chats.findIndex(c => c.id === chat.id);
        if (idx >= 0) chats[idx] = chat;
        else chats.unshift(chat);
        this.set(this.KEYS.CHATS, chats);
    },

    deleteChat(id) {
        const chats = this.getChats().filter(c => c.id !== id);
        this.set(this.KEYS.CHATS, chats);
    },

    getActiveChat() {
        return this.get(this.KEYS.ACTIVE_CHAT, null);
    },

    setActiveChat(id) {
        this.set(this.KEYS.ACTIVE_CHAT, id);
    },

    // ---- Personas ----
    getPersonas() {
        return this.get(this.KEYS.PERSONAS, []);
    },

    savePersona(persona) {
        const personas = this.getPersonas();
        const idx = personas.findIndex(p => p.id === persona.id);
        if (idx >= 0) personas[idx] = persona;
        else personas.push(persona);
        this.set(this.KEYS.PERSONAS, personas);
    },

    deletePersona(id) {
        const personas = this.getPersonas().filter(p => p.id !== id);
        this.set(this.KEYS.PERSONAS, personas);
    },

    // ---- Settings ----
    getSettings() {
        return this.get(this.KEYS.SETTINGS, {
            theme: 'light',
            fontSize: 'medium',
            enterSend: true,
            streaming: true,
        });
    },

    saveSettings(settings) {
        this.set(this.KEYS.SETTINGS, settings);
    },

    // ---- Clear All ----
    clearAll() {
        Object.values(this.KEYS).forEach(key => this.remove(key));
    },

    // ---- Utils ----
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2, 8);
    }
};
