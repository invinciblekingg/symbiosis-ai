/**
 * Database & Configuration Bridge for Symbiosis.ai & NIVAAR AI
 * 
 * Powered by Supabase as Central Database & Storage
 * Backwards compatible with legacy Firebase/LocalStorage APIs
 */

// Global Supabase verification
const isSupabaseReady = () => typeof window.NivaarSupabase !== 'undefined';

// Database references bridge
const getRef = (path) => {
    return {
        path,
        once: async () => ({ val: () => window.dbOperations.get(path) }),
        set: (data) => window.dbOperations.set(path, data),
        update: (data) => window.dbOperations.update(path, data),
        remove: () => window.dbOperations.remove(path)
    };
};

// Database operations routed through central Supabase engine
const dbOperations = {
    async set(path, data) {
        if (window.NivaarSupabase && typeof window.NivaarSupabase.client !== 'undefined') {
            return window.NivaarSupabase.set ? window.NivaarSupabase.set(path, data) : this._fallbackSet(path, data);
        }
        return this._fallbackSet(path, data);
    },

    async _fallbackSet(path, data) {
        localStorage.setItem(`symbiosis_${path}`, JSON.stringify(data));
        return Promise.resolve();
    },

    async get(path) {
        if (window.NivaarSupabase && typeof window.NivaarSupabase.client !== 'undefined') {
            // Check if NivaarSupabase has higher-level table mappings
            const parts = path.split('/');
            if (parts[0] === 'users' && parts[1]) {
                try {
                    const { data } = await window.NivaarSupabase.client.from('companies').select('*').eq('id', parts[1]).single();
                    if (data) return { ...data.raw_profile, id: data.id, companyName: data.company_name, email: data.email };
                } catch (e) {}
            }
        }
        const data = localStorage.getItem(`symbiosis_${path}`);
        return data ? JSON.parse(data) : null;
    },

    async update(path, data) {
        const existing = await this.get(path) || {};
        const updated = { ...existing, ...data };
        return this.set(path, updated);
    },

    async remove(path) {
        localStorage.removeItem(`symbiosis_${path}`);
        return Promise.resolve();
    },

    async push(path, data) {
        const key = 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
        const allData = await this.get(path) || {};
        allData[key] = data;
        localStorage.setItem(`symbiosis_${path}`, JSON.stringify(allData));
        return key;
    },

    async queryByChild(path, childKey, childValue) {
        if (window.NivaarSupabase && window.NivaarSupabase.client && path === 'users') {
            try {
                const col = childKey === 'email' ? 'email' : 'id';
                const { data } = await window.NivaarSupabase.client.from('companies').select('*').eq(col, childValue);
                if (data && data.length > 0) {
                    const map = {};
                    data.forEach(c => { map[c.id] = { ...c.raw_profile, id: c.id, companyName: c.company_name, email: c.email }; });
                    return map;
                }
            } catch (e) {}
        }
        const allData = await this.get(path) || {};
        const results = {};
        Object.entries(allData).forEach(([key, value]) => {
            if (value && value[childKey] === childValue) {
                results[key] = value;
            }
        });
        return Object.keys(results).length > 0 ? results : null;
    },

    onValue(path, callback) {
        this.get(path).then(callback);
        return null;
    },

    offValue(path) {}
};

// Export compatibility globals
window.db = null;
window.getRef = getRef;
if (!window.dbOperations) {
    window.dbOperations = dbOperations;
}
window.firebaseInitialized = true;
console.log('⚡ [DB Bridge] Database routing initialized with Supabase fallback.');
