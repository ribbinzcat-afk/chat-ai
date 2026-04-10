// ============================================
// API Manager — Multi-Provider Support
// ============================================

const APIManager = {
    // Provider configurations with endpoint templates
    PROVIDER_CONFIGS: {
        openai: {
            name: 'OpenAI',
            baseUrl: 'https://api.openai.com/v1',
            chatEndpoint: '/chat/completions',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            defaultModel: 'gpt-4o',
            models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
        },
        anthropic: {
            name: 'Anthropic',
            baseUrl: 'https://api.anthropic.com',
            chatEndpoint: '/v1/messages',
            authHeader: 'x-api-key',
            authPrefix: '',
            defaultModel: 'claude-sonnet-4-20250514',
            models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
            extraHeaders: {
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
            },
        },
        google: {
            name: 'Google Gemini',
            baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
            defaultModel: 'gemini-2.0-flash',
            models: ['gemini-2.0-flash', 'gemini-2.0-flash-lite', 'gemini-1.5-pro', 'gemini-1.5-flash'],
        },
        openrouter: {
            name: 'OpenRouter',
            baseUrl: 'https://openrouter.ai/api/v1',
            chatEndpoint: '/chat/completions',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            defaultModel: 'openai/gpt-4o',
            models: [],
        },
        ollama: {
            name: 'Ollama',
            baseUrl: 'http://localhost:11434',
            chatEndpoint: '/api/chat',
            authHeader: null,
            defaultModel: 'llama3.1',
            models: [],
        },
        custom: {
            name: 'Custom / Reverse Proxy',
            baseUrl: '',
            chatEndpoint: '/chat/completions',
            authHeader: 'Authorization',
            authPrefix: 'Bearer ',
            defaultModel: '',
            models: [],
        }
    },

    /**
     * Send a message to the appropriate API
     * @param {Object} provider - Provider config from storage
     * @param {Array} messages - Conversation messages
     * @param {Object} options - Additional options (streaming callback, etc.)
     * @returns {Promise<string>} AI response text
     */
    async sendMessage(provider, messages, options = {}) {
        const type = provider.type;

        switch (type) {
            case 'anthropic':
                return this._sendAnthropic(provider, messages, options);
            case 'google':
                return this._sendGoogle(provider, messages, options);
            case 'ollama':
                return this._sendOllama(provider, messages, options);
            default:
                // OpenAI-compatible (openai, openrouter, custom)
                return this._sendOpenAICompatible(provider, messages, options);
        }
    },

    // ---- OpenAI Compatible ----
    async _sendOpenAICompatible(provider, messages, options) {
        const config = this.PROVIDER_CONFIGS[provider.type] || this.PROVIDER_CONFIGS.custom;
        const baseUrl = provider.url || config.baseUrl;
        const endpoint = baseUrl + (config.chatEndpoint || '/chat/completions');

        const headers = {
            'Content-Type': 'application/json',
            ...(config.extraHeaders || {}),
            ...(provider.customHeaders || {}),
        };

        if (provider.apiKey && config.authHeader) {
            headers[config.authHeader] = (config.authPrefix || '') + provider.apiKey;
        }

        const body = {
            model: provider.model || config.defaultModel,
            messages: messages,
            temperature: provider.temperature ?? 0.7,
            max_tokens: provider.maxTokens ?? 4096,
            top_p: provider.topP ?? 1,
            frequency_penalty: provider.frequencyPenalty ?? 0,
            stream: options.stream ?? false,
        };

        if (options.stream && options.onChunk) {
            return this._streamOpenAI(endpoint, headers, body, options.onChunk, options.onDone);
        }

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`API Error ${resp.status}: ${err}`);
        }

        const data = await resp.json();
        return data.choices?.[0]?.message?.content || '';
    },

    async _streamOpenAI(endpoint, headers, body, onChunk, onDone) {
        body.stream = true;

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`API Error ${resp.status}: ${err}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith('data: ')) continue;

                const data = trimmed.slice(6);
                if (data === '[DONE]') break;

                try {
                    const json = JSON.parse(data);
                    const delta = json.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        fullText += delta;
                        onChunk(delta, fullText);
                    }
                } catch { /* skip malformed */ }
            }
        }

        if (onDone) onDone(fullText);
        return fullText;
    },

    // ---- Anthropic (Claude) ----
    async _sendAnthropic(provider, messages, options) {
        const config = this.PROVIDER_CONFIGS.anthropic;
        const baseUrl = provider.url || config.baseUrl;
        const endpoint = baseUrl + config.chatEndpoint;

        // Extract system message
        let systemPrompt = '';
        const chatMessages = [];
        for (const msg of messages) {
            if (msg.role === 'system') {
                systemPrompt += (systemPrompt ? '\n' : '') + msg.content;
            } else {
                chatMessages.push({ role: msg.role, content: msg.content });
            }
        }

        // Anthropic requires alternating user/assistant
        const sanitized = this._sanitizeAlternating(chatMessages);

        const headers = {
            'Content-Type': 'application/json',
            'x-api-key': provider.apiKey,
            ...config.extraHeaders,
            ...(provider.customHeaders || {}),
        };

        const body = {
            model: provider.model || config.defaultModel,
            max_tokens: provider.maxTokens ?? 4096,
            messages: sanitized,
            temperature: provider.temperature ?? 0.7,
            top_p: provider.topP ?? 1,
        };

        if (systemPrompt) body.system = systemPrompt;

        if (options.stream && options.onChunk) {
            body.stream = true;
            return this._streamAnthropic(endpoint, headers, body, options.onChunk, options.onDone);
        }

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Anthropic Error ${resp.status}: ${err}`);
        }

        const data = await resp.json();
        return data.content?.[0]?.text || '';
    },

    async _streamAnthropic(endpoint, headers, body, onChunk, onDone) {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Anthropic Error ${resp.status}: ${err}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.slice(6));
                    if (json.type === 'content_block_delta') {
                        const delta = json.delta?.text || '';
                        if (delta) {
                            fullText += delta;
                            onChunk(delta, fullText);
                        }
                    }
                } catch { /* skip */ }
            }
        }

        if (onDone) onDone(fullText);
        return fullText;
    },

    // ---- Google Gemini ----
    async _sendGoogle(provider, messages, options) {
        const model = provider.model || 'gemini-2.0-flash';
        const baseUrl = provider.url || this.PROVIDER_CONFIGS.google.baseUrl;
        const streamSuffix = (options.stream && options.onChunk) ? 'streamGenerateContent?alt=sse&' : 'generateContent?';
        const endpoint = `${baseUrl}/models/${model}:${streamSuffix}key=${provider.apiKey}`;

        // Convert to Gemini format
        let systemInstruction = '';
        const contents = [];

        for (const msg of messages) {
            if (msg.role === 'system') {
                systemInstruction += (systemInstruction ? '\n' : '') + msg.content;
            } else {
                contents.push({
                    role: msg.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: msg.content }],
                });
            }
        }

        const body = {
            contents,
            generationConfig: {
                temperature: provider.temperature ?? 0.7,
                maxOutputTokens: provider.maxTokens ?? 4096,
                topP: provider.topP ?? 1,
            },
        };

        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }

        if (options.stream && options.onChunk) {
            return this._streamGoogle(endpoint, body, options.onChunk, options.onDone);
        }

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Gemini Error ${resp.status}: ${err}`);
        }

        const data = await resp.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    },

    async _streamGoogle(endpoint, body, onChunk, onDone) {
        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Gemini Error ${resp.status}: ${err}`);
        }

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let fullText = '';
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const json = JSON.parse(trimmed.slice(6));
                    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
                    if (text) {
                        fullText += text;
                        onChunk(text, fullText);
                    }
                } catch { /* skip */ }
            }
        }

        if (onDone) onDone(fullText);
        return fullText;
    },

    // ---- Ollama ----
    async _sendOllama(provider, messages, options) {
        const baseUrl = provider.url || 'http://localhost:11434';
        const endpoint = baseUrl + '/api/chat';

        const body = {
            model: provider.model || 'llama3.1',
            messages: messages,
            stream: !!(options.stream && options.onChunk),
            options: {
                temperature: provider.temperature ?? 0.7,
                top_p: provider.topP ?? 1,
                num_predict: provider.maxTokens ?? 4096,
            },
        };

        if (options.stream && options.onChunk) {
            const resp = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!resp.ok) {
                const err = await resp.text();
                throw new Error(`Ollama Error ${resp.status}: ${err}`);
            }

            const reader = resp.body.getReader();
            const decoder = new TextDecoder();
            let fullText = '';
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const json = JSON.parse(line);
                        const text = json.message?.content || '';
                        if (text) {
                            fullText += text;
                            options.onChunk(text, fullText);
                        }
                    } catch { /* skip */ }
                }
            }

            if (options.onDone) options.onDone(fullText);
            return fullText;
        }

        const resp = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const err = await resp.text();
            throw new Error(`Ollama Error ${resp.status}: ${err}`);
        }

        const data = await resp.json();
        return data.message?.content || '';
    },

    // ---- Helpers ----
    _sanitizeAlternating(messages) {
        // Ensure messages alternate user/assistant (required by Anthropic)
        const result = [];
        for (const msg of messages) {
            if (result.length > 0 && result[result.length - 1].role === msg.role) {
                // Merge consecutive same-role messages
                result[result.length - 1].content += '\n' + msg.content;
            } else {
                result.push({ ...msg });
            }
        }
        // Anthropic requires first message to be user
        if (result.length > 0 && result[0].role !== 'user') {
            result.unshift({ role: 'user', content: '(start)' });
        }
        return result;
    },

    /**
     * Test connection to a provider
     */
    async testConnection(provider) {
        try {
            const testMessages = [{ role: 'user', content: 'Hi, respond with just "Connected!" and nothing else.' }];
            if (provider.systemPrompt) {
                testMessages.unshift({ role: 'system', content: provider.systemPrompt });
            }

            const result = await this.sendMessage(provider, testMessages, { stream: false });
            return { success: true, message: result.substring(0, 100) };
        } catch (err) {
            return { success: false, message: err.message };
        }
    }
};
