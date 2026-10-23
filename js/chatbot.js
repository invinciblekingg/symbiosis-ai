import { db } from './firebase-config.js';
import { collection, getDocs, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export class Chatbot {
    constructor(user) {
        this.user = user;
        this.init();
    }

    init() {
        this.createWidget();
        this.attachListeners();
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.id = 'chatbotWidget';
        widget.innerHTML = `
            <div id="chatButton" style="position: fixed; bottom: 20px; right: 20px; width: 60px; height: 60px; background: var(--primary-blue); border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 30px; cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15); z-index: 1000;">
                💬
            </div>
            <div id="chatWindow" style="position: fixed; bottom: 90px; right: 20px; width: 350px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.15); display: none; flex-direction: column; z-index: 1000; overflow: hidden;">
                <div style="background: var(--primary-blue); color: white; padding: 15px; display: flex; justify-content: space-between; align-items: center;">
                    <h3 style="margin: 0; font-size: 1.1rem;">Symbiosis Assistant</h3>
                    <span id="closeChat" style="cursor: pointer; font-size: 1.2rem;">&times;</span>
                </div>
                <div id="chatMessages" style="flex: 1; padding: 15px; overflow-y: auto; background: #f8f9fa;">
                    <div class="message bot">
                        Hello! I can help you find materials or check your stats. Try saying "find plastic" or "my stats".
                    </div>
                </div>
                <div style="padding: 15px; border-top: 1px solid #eee; display: flex; gap: 10px;">
                    <input type="text" id="chatInput" placeholder="Type a message..." style="flex: 1; padding: 10px; border: 1px solid #ddd; border-radius: 20px; outline: none;">
                    <button id="sendMessage" style="background: var(--primary-green); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer;">➤</button>
                </div>
            </div>
            <style>
                .message { margin-bottom: 10px; padding: 10px 15px; border-radius: 15px; max-width: 80%; font-size: 0.9rem; line-height: 1.4; }
                .message.bot { background: white; border: 1px solid #eee; align-self: flex-start; border-bottom-left-radius: 5px; }
                .message.user { background: var(--primary-blue); color: white; align-self: flex-end; border-bottom-right-radius: 5px; margin-left: auto; }
            </style>
        `;
        document.body.appendChild(widget);
    }

    attachListeners() {
        const btn = document.getElementById('chatButton');
        const window = document.getElementById('chatWindow');
        const close = document.getElementById('closeChat');
        const input = document.getElementById('chatInput');
        const send = document.getElementById('sendMessage');

        btn.addEventListener('click', () => window.style.display = 'flex');
        close.addEventListener('click', () => window.style.display = 'none');

        const handleSend = () => {
            const text = input.value.trim();
            if (!text) return;

            this.addMessage(text, 'user');
            input.value = '';
            this.processMessage(text);
        };

        send.addEventListener('click', handleSend);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSend();
        });
    }

    addMessage(text, sender) {
        const container = document.getElementById('chatMessages');
        const div = document.createElement('div');
        div.className = `message ${sender}`;
        div.innerText = text;
        container.appendChild(div);
        container.scrollTop = container.scrollHeight;
    }

    async processMessage(text) {
        const lower = text.toLowerCase();

        if (lower.includes('hello') || lower.includes('hi')) {
            this.addMessage("Hello there! How can I help you today?", 'bot');
        } else if (lower.includes('stats') || lower.includes('dashboard')) {
            await this.showStats();
        } else if (lower.includes('find') || lower.includes('search') || lower.includes('need')) {
            const term = lower.replace('find', '').replace('search', '').replace('need', '').trim();
            if (term) {
                await this.findMaterials(term);
            } else {
                this.addMessage("What material are you looking for? Try 'find plastic'.", 'bot');
            }
        } else {
            this.addMessage("I'm not sure about that. Try asking for 'stats' or 'find [material]'.", 'bot');
        }
    }

    async showStats() {
        try {
            const docRef = doc(db, "companies", this.user.uid);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                const matCount = data.materials.length;
                const wasteCount = data.waste.length + data.byproducts.length;
                this.addMessage(`You have listed ${matCount} material needs and ${wasteCount} waste items.`, 'bot');
            } else {
                this.addMessage("I couldn't find your profile data.", 'bot');
            }
        } catch (error) {
            this.addMessage("Error retrieving stats.", 'bot');
        }
    }

    async findMaterials(term) {
        this.addMessage(`Searching for companies with ${term}...`, 'bot');
        try {
            const querySnapshot = await getDocs(collection(db, "companies"));
            let count = 0;

            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.uid === this.user.uid) return;

                const hasWaste = [...data.waste, ...data.byproducts].some(w => w.type.toLowerCase().includes(term));
                if (hasWaste) count++;
            });

            if (count > 0) {
                this.addMessage(`Found ${count} companies offering ${term}! Check the dashboard for matches.`, 'bot');
            } else {
                this.addMessage(`No companies found offering ${term} yet.`, 'bot');
            }
        } catch (error) {
            this.addMessage("Error searching.", 'bot');
        }
    }
}
