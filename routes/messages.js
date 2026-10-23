const express = require('express');
const router = express.Router();

// In-memory message storage
const conversations = new Map();
const messages = new Map();
let messageIdCounter = 1;

/**
 * GET /api/messages/conversations
 * Get all conversations for a user/company
 */
router.get('/conversations', async (req, res) => {
    try {
        const { companyId } = req.query;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        // Get conversations for this company
        const userConversations = Array.from(conversations.values())
            .filter(c => c.participants.includes(companyId))
            .map(c => ({
                ...c,
                lastMessage: getLastMessage(c.id),
                unreadCount: getUnreadCount(c.id, companyId)
            }))
            .sort((a, b) => new Date(b.lastActivity) - new Date(a.lastActivity));

        res.json({
            success: true,
            data: userConversations
        });

    } catch (error) {
        console.error('Get conversations error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * POST /api/messages/conversations
 * Create a new conversation
 */
router.post('/conversations', async (req, res) => {
    try {
        const { participants, materialContext, initialMessage } = req.body;

        if (!participants || participants.length < 2) {
            return res.status(400).json({
                success: false,
                message: 'At least 2 participants are required'
            });
        }

        const conversationId = `conv_${Date.now()}`;

        const conversation = {
            id: conversationId,
            participants,
            materialContext: materialContext || null,
            createdAt: new Date().toISOString(),
            lastActivity: new Date().toISOString()
        };

        conversations.set(conversationId, conversation);

        // Add initial message if provided
        if (initialMessage) {
            const msgId = `msg_${messageIdCounter++}`;
            const message = {
                id: msgId,
                conversationId,
                senderId: initialMessage.senderId,
                content: initialMessage.content,
                type: 'text',
                read: false,
                createdAt: new Date().toISOString()
            };
            messages.set(msgId, message);
        }

        res.status(201).json({
            success: true,
            message: 'Conversation created',
            data: conversation
        });

    } catch (error) {
        console.error('Create conversation error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * GET /api/messages/conversations/:id
 * Get messages in a conversation
 */
router.get('/conversations/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { page = 1, limit = 50 } = req.query;

        const conversation = conversations.get(id);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        // Get messages for this conversation
        const conversationMessages = Array.from(messages.values())
            .filter(m => m.conversationId === id)
            .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const paginatedMessages = conversationMessages.slice(startIndex, startIndex + parseInt(limit));

        res.json({
            success: true,
            data: {
                conversation,
                messages: paginatedMessages,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: conversationMessages.length
                }
            }
        });

    } catch (error) {
        console.error('Get conversation messages error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * POST /api/messages
 * Send a message
 */
router.post('/', async (req, res) => {
    try {
        const { conversationId, senderId, content, type = 'text', attachments } = req.body;

        if (!conversationId || !senderId || !content) {
            return res.status(400).json({
                success: false,
                message: 'Conversation ID, sender ID, and content are required'
            });
        }

        const conversation = conversations.get(conversationId);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Conversation not found'
            });
        }

        const messageId = `msg_${messageIdCounter++}`;
        const message = {
            id: messageId,
            conversationId,
            senderId,
            content,
            type,
            attachments: attachments || [],
            read: false,
            createdAt: new Date().toISOString()
        };

        messages.set(messageId, message);

        // Update conversation last activity
        conversation.lastActivity = new Date().toISOString();
        conversations.set(conversationId, conversation);

        res.status(201).json({
            success: true,
            message: 'Message sent',
            data: message
        });

    } catch (error) {
        console.error('Send message error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * PUT /api/messages/:id/read
 * Mark message as read
 */
router.put('/:id/read', async (req, res) => {
    try {
        const { id } = req.params;

        const message = messages.get(id);
        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Message not found'
            });
        }

        message.read = true;
        message.readAt = new Date().toISOString();
        messages.set(id, message);

        res.json({
            success: true,
            message: 'Message marked as read'
        });

    } catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * PUT /api/messages/conversations/:id/read-all
 * Mark all messages in conversation as read
 */
router.put('/conversations/:id/read-all', async (req, res) => {
    try {
        const { id } = req.params;
        const { readerId } = req.body;

        const conversationMessages = Array.from(messages.values())
            .filter(m => m.conversationId === id && m.senderId !== readerId);

        conversationMessages.forEach(msg => {
            msg.read = true;
            msg.readAt = new Date().toISOString();
            messages.set(msg.id, msg);
        });

        res.json({
            success: true,
            message: 'All messages marked as read',
            count: conversationMessages.length
        });

    } catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

// Helper functions
function getLastMessage(conversationId) {
    const conversationMessages = Array.from(messages.values())
        .filter(m => m.conversationId === conversationId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return conversationMessages[0] || null;
}

function getUnreadCount(conversationId, readerId) {
    return Array.from(messages.values())
        .filter(m =>
            m.conversationId === conversationId &&
            m.senderId !== readerId &&
            !m.read
        ).length;
}

// Message templates
router.get('/templates', (req, res) => {
    res.json({
        success: true,
        data: [
            {
                id: 'interested',
                text: "Hi, I'm interested in your listing. Can we discuss the details?"
            },
            {
                id: 'quality',
                text: "Can you provide a quality certificate or test report for this material?"
            },
            {
                id: 'price',
                text: "What's your best price for bulk orders?"
            },
            {
                id: 'schedule',
                text: "Can we schedule a call to discuss this opportunity?"
            },
            {
                id: 'visit',
                text: "Would it be possible to visit your facility for inspection?"
            },
            {
                id: 'samples',
                text: "Can you send samples before we proceed with the order?"
            }
        ]
    });
});

module.exports = router;
