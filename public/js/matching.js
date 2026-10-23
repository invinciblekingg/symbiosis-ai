/**
 * Symbiosis.ai - Real-time Matching Engine
 * Connects to Firebase to find and display real matches
 */

const MatchingEngine = {
    // Calculate match score between two factories
    calculateMatchScore(producer, consumer, material) {
        let score = 0;
        let factors = [];

        // Material type match (40 points max)
        if (producer.materialType === consumer.materialType) {
            score += 40;
            factors.push('Material type matches');
        } else if (this.areSimilarMaterials(producer.materialType, consumer.materialType)) {
            score += 25;
            factors.push('Similar material types');
        }

        // Quantity compatibility (20 points max)
        const producerQty = parseFloat(producer.quantity) || 0;
        const consumerQty = parseFloat(consumer.quantity) || 0;
        if (producerQty >= consumerQty) {
            score += 20;
            factors.push('Quantity meets requirement');
        } else if (producerQty >= consumerQty * 0.5) {
            score += 10;
            factors.push('Partial quantity available');
        }

        // Quality specs (20 points max)
        const producerPurity = parseFloat(producer.quality?.purity) || 0;
        const consumerMinPurity = parseFloat(consumer.quality?.minPurity) || 0;
        if (producerPurity >= consumerMinPurity) {
            score += 20;
            factors.push('Quality meets specs');
        } else if (producerPurity >= consumerMinPurity * 0.8) {
            score += 10;
            factors.push('Quality close to specs');
        }

        // Location proximity (20 points max) - based on same state/city
        if (producer.location?.state === consumer.location?.state) {
            score += 15;
            factors.push('Same state');
            if (producer.location?.city === consumer.location?.city) {
                score += 5;
                factors.push('Same city');
            }
        }

        return { score: Math.min(score, 100), factors };
    },

    // Check if materials are similar/compatible
    areSimilarMaterials(mat1, mat2) {
        const similarGroups = [
            ['Fly Ash', 'Bottom Ash', 'Coal Ash'],
            ['Ferrous Scrap', 'Iron Scrap', 'Steel Scrap', 'Metal Scrap'],
            ['PET', 'HDPE', 'Plastic Scrap', 'PP Scrap'],
            ['Rice Husk', 'Bagasse', 'Agricultural Residue', 'Corn Cob'],
            ['Cardboard', 'Paper Waste', 'Packaging Paper']
        ];

        for (const group of similarGroups) {
            const m1Match = group.some(g => mat1?.toLowerCase().includes(g.toLowerCase()));
            const m2Match = group.some(g => mat2?.toLowerCase().includes(g.toLowerCase()));
            if (m1Match && m2Match) return true;
        }
        return false;
    },

    // Get all registered users from Firebase
    async getAllUsers() {
        try {
            const users = await dbOperations.get('users');
            if (!users) return [];
            return Object.entries(users).map(([id, data]) => ({
                id,
                ...data,
                password: undefined // Remove sensitive data
            }));
        } catch (error) {
            console.error('Error fetching users:', error);
            return [];
        }
    },

    // Find matches for a given user
    async findMatchesForUser(userId) {
        const currentUser = await dbOperations.get(`users/${userId}`);
        if (!currentUser) return { buyerMatches: [], sellerMatches: [] };

        const allUsers = await this.getAllUsers();
        const otherUsers = allUsers.filter(u => u.id !== userId && u.onboardingComplete);

        const buyerMatches = []; // Factories that need what we produce
        const sellerMatches = []; // Factories that produce what we need

        // Get current user's waste and requirements
        const myWaste = currentUser.wasteProduced || [];
        const myRequirements = currentUser.materialsRequired || [];

        for (const otherUser of otherUsers) {
            const theirWaste = otherUser.wasteProduced || [];
            const theirRequirements = otherUser.materialsRequired || [];

            // Check if they need what we produce (buyer matches)
            for (const waste of myWaste) {
                for (const req of theirRequirements) {
                    const { score, factors } = this.calculateMatchScore(
                        { ...waste, location: currentUser.factory },
                        { ...req, location: otherUser.factory },
                        waste.materialType
                    );
                    if (score >= 40) {
                        buyerMatches.push({
                            matchId: `${userId}_${otherUser.id}_${waste.materialType}`,
                            company: otherUser.companyName,
                            industry: otherUser.industryType,
                            location: `${otherUser.factory?.city || ''}, ${otherUser.factory?.state || ''}`,
                            material: waste.materialType,
                            theyNeed: req.quantity,
                            weHave: waste.quantity,
                            unit: waste.unit || 'tons',
                            score,
                            factors,
                            companyId: otherUser.id
                        });
                    }
                }
            }

            // Check if they produce what we need (seller matches)
            for (const req of myRequirements) {
                for (const waste of theirWaste) {
                    const { score, factors } = this.calculateMatchScore(
                        { ...waste, location: otherUser.factory },
                        { ...req, location: currentUser.factory },
                        waste.materialType
                    );
                    if (score >= 40) {
                        sellerMatches.push({
                            matchId: `${otherUser.id}_${userId}_${waste.materialType}`,
                            company: otherUser.companyName,
                            industry: otherUser.industryType,
                            location: `${otherUser.factory?.city || ''}, ${otherUser.factory?.state || ''}`,
                            material: waste.materialType,
                            theyProduce: waste.quantity,
                            weNeed: req.quantity,
                            unit: waste.unit || 'tons',
                            score,
                            factors,
                            companyId: otherUser.id
                        });
                    }
                }
            }
        }

        // Sort by score descending
        buyerMatches.sort((a, b) => b.score - a.score);
        sellerMatches.sort((a, b) => b.score - a.score);

        return { buyerMatches, sellerMatches };
    },

    // Listen for real-time match updates
    subscribeToMatches(userId, callback) {
        if (!db) {
            console.warn('Firebase not available, using static matches');
            return null;
        }

        // Listen to users collection for changes
        const usersRef = db.ref('users');
        usersRef.on('value', async () => {
            const matches = await this.findMatchesForUser(userId);
            callback(matches);
        });

        return () => usersRef.off('value');
    },

    // Get all listings (both waste and requirements)
    async getAllListings() {
        const users = await this.getAllUsers();
        const listings = [];

        for (const user of users) {
            if (!user.onboardingComplete) continue;

            // Add waste as listings
            const waste = user.wasteProduced || [];
            for (const w of waste) {
                listings.push({
                    id: `waste_${user.id}_${w.materialType}`,
                    type: 'waste',
                    title: w.materialType || 'Waste Material',
                    company: user.companyName,
                    companyId: user.id,
                    location: `${user.factory?.city || ''}, ${user.factory?.state || ''}`,
                    category: this.getMaterialCategory(w.materialType),
                    quantity: w.quantity,
                    unit: w.unit || 'tons',
                    description: w.description,
                    quality: w.quality,
                    hazardous: w.hazardous,
                    availability: w.availability,
                    verified: user.verified || false,
                    createdAt: user.createdAt
                });
            }

            // Add requirements as listings
            const reqs = user.materialsRequired || [];
            for (const r of reqs) {
                listings.push({
                    id: `req_${user.id}_${r.materialType}`,
                    type: 'requirement',
                    title: r.materialType || 'Required Material',
                    company: user.companyName,
                    companyId: user.id,
                    location: `${user.factory?.city || ''}, ${user.factory?.state || ''}`,
                    category: this.getMaterialCategory(r.materialType),
                    quantity: r.quantity,
                    unit: r.unit || 'tons',
                    purpose: r.purpose,
                    budget: r.budget,
                    frequency: r.frequency,
                    verified: user.verified || false,
                    createdAt: user.createdAt
                });
            }
        }

        return listings;
    },

    // Get material category from type
    getMaterialCategory(materialType) {
        const categories = {
            metal: ['Ferrous', 'Iron', 'Steel', 'Aluminum', 'Copper', 'Brass', 'Slag', 'Metal'],
            plastic: ['PET', 'HDPE', 'LDPE', 'PP', 'PVC', 'Plastic'],
            construction: ['Fly Ash', 'Bottom Ash', 'Gypsum', 'Cement', 'Concrete', 'Brick'],
            organic: ['Food', 'Agricultural', 'Bagasse', 'Rice Husk', 'Corn', 'Press Mud'],
            chemical: ['Chemical', 'Catalyst', 'Acid', 'Alkali', 'Glycerin', 'Tar'],
            textile: ['Cotton', 'Fabric', 'Yarn', 'Textile'],
            paper: ['Cardboard', 'Paper', 'Packaging'],
            electronic: ['E-waste', 'Circuit', 'Battery', 'Electronic']
        };

        if (!materialType) return 'other';

        for (const [category, keywords] of Object.entries(categories)) {
            if (keywords.some(k => materialType.toLowerCase().includes(k.toLowerCase()))) {
                return category;
            }
        }
        return 'other';
    },

    // Get icon for material category
    getCategoryIcon(category) {
        const icons = {
            metal: '⚙️',
            plastic: '♻️',
            construction: '🏗️',
            organic: '🌾',
            chemical: '🧪',
            textile: '🧵',
            paper: '📦',
            electronic: '💻',
            other: '📦'
        };
        return icons[category] || '📦';
    }
};

// Export for use in other files
window.MatchingEngine = MatchingEngine;
