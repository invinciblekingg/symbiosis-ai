const express = require('express');
const router = express.Router();

/**
 * Matching Algorithm Utility Functions
 */

// Calculate distance between two coordinates using Haversine formula
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (deg) => deg * (Math.PI / 180);

// Calculate match score based on multiple factors
const calculateMatchScore = (supplier, buyer) => {
    let score = 0;
    let factors = 0;

    // Material type match (40 points)
    if (supplier.materialType === buyer.materialType) {
        score += 40;
    } else if (supplier.materialCategory === buyer.materialCategory) {
        score += 20; // Partial match for same category
    }
    factors++;

    // Quantity compatibility (20 points)
    if (supplier.quantity >= buyer.quantity * 0.8 &&
        supplier.quantity <= buyer.quantity * 1.5) {
        score += 20;
    } else if (supplier.quantity >= buyer.quantity * 0.5) {
        score += 10;
    }
    factors++;

    // Quality specifications match (20 points)
    if (supplier.quality && buyer.quality) {
        let qualityScore = 0;
        let qualityFactors = 0;

        if (supplier.quality.purity && buyer.quality.minPurity) {
            if (supplier.quality.purity >= buyer.quality.minPurity) {
                qualityScore += 5;
            }
            qualityFactors++;
        }

        if (supplier.quality.moisture && buyer.quality.maxMoisture) {
            if (supplier.quality.moisture <= buyer.quality.maxMoisture) {
                qualityScore += 5;
            }
            qualityFactors++;
        }

        if (qualityFactors > 0) {
            score += (qualityScore / qualityFactors) * 4;
        } else {
            score += 10; // Neutral if no quality specs
        }
    } else {
        score += 10;
    }
    factors++;

    // Distance factor (20 points) - closer is better
    if (supplier.distance !== undefined) {
        if (supplier.distance <= 50) {
            score += 20;
        } else if (supplier.distance <= 100) {
            score += 15;
        } else if (supplier.distance <= 200) {
            score += 10;
        } else if (supplier.distance <= 500) {
            score += 5;
        }
    }
    factors++;

    return Math.round(score);
};

// In-memory storage (replaced by Firebase in frontend)
const matches = new Map();
const companies = new Map();
const materials = new Map();

/**
 * GET /api/matches
 * Get personalized matches for a company
 */
router.get('/', async (req, res) => {
    try {
        const { companyId, type, minScore, maxDistance, materialType, limit = 20 } = req.query;

        if (!companyId) {
            return res.status(400).json({
                success: false,
                message: 'Company ID is required'
            });
        }

        const company = companies.get(companyId);
        if (!company) {
            // Return mock data for demo purposes
            return res.json({
                success: true,
                data: {
                    needYourWaste: [],
                    produceWhatYouNeed: []
                },
                message: 'Connect to Firebase for real matches'
            });
        }

        const companyLat = company.factory?.coordinates?.latitude;
        const companyLon = company.factory?.coordinates?.longitude;

        let needYourWaste = [];
        let produceWhatYouNeed = [];

        // Find companies that need what this company produces
        if (company.wasteProduced && company.wasteProduced.length > 0) {
            for (const waste of company.wasteProduced) {
                const potentialBuyers = Array.from(companies.values()).filter(c => {
                    if (c.id === companyId) return false;
                    return c.materialsRequired?.some(m =>
                        m.materialType === waste.materialType ||
                        m.materialCategory === waste.materialCategory
                    );
                });

                for (const buyer of potentialBuyers) {
                    const buyerReq = buyer.materialsRequired.find(m =>
                        m.materialType === waste.materialType
                    );

                    if (buyerReq) {
                        const buyerLat = buyer.factory?.coordinates?.latitude;
                        const buyerLon = buyer.factory?.coordinates?.longitude;

                        let distance = null;
                        if (companyLat && companyLon && buyerLat && buyerLon) {
                            distance = calculateDistance(
                                companyLat, companyLon, buyerLat, buyerLon
                            );
                        }

                        const matchData = {
                            ...waste,
                            distance
                        };

                        const score = calculateMatchScore(matchData, buyerReq);

                        needYourWaste.push({
                            id: `match_${Date.now()}_${buyer.id}`,
                            company: {
                                id: buyer.id,
                                name: buyer.companyName,
                                industry: buyer.industryType,
                                location: buyer.factory?.city,
                                state: buyer.factory?.state
                            },
                            material: {
                                type: waste.materialType,
                                category: waste.materialCategory,
                                quantityNeeded: buyerReq.quantity,
                                unit: buyerReq.unit
                            },
                            matchScore: score,
                            distance: distance ? Math.round(distance) : null,
                            pricing: buyerReq.pricing
                        });
                    }
                }
            }
        }

        // Find companies that produce what this company needs
        if (company.materialsRequired && company.materialsRequired.length > 0) {
            for (const requirement of company.materialsRequired) {
                const potentialSuppliers = Array.from(companies.values()).filter(c => {
                    if (c.id === companyId) return false;
                    return c.wasteProduced?.some(w =>
                        w.materialType === requirement.materialType ||
                        w.materialCategory === requirement.materialCategory
                    );
                });

                for (const supplier of potentialSuppliers) {
                    const supplierWaste = supplier.wasteProduced.find(w =>
                        w.materialType === requirement.materialType
                    );

                    if (supplierWaste) {
                        const supplierLat = supplier.factory?.coordinates?.latitude;
                        const supplierLon = supplier.factory?.coordinates?.longitude;

                        let distance = null;
                        if (companyLat && companyLon && supplierLat && supplierLon) {
                            distance = calculateDistance(
                                companyLat, companyLon, supplierLat, supplierLon
                            );
                        }

                        const matchData = {
                            ...supplierWaste,
                            distance
                        };

                        const score = calculateMatchScore(matchData, requirement);

                        produceWhatYouNeed.push({
                            id: `match_${Date.now()}_${supplier.id}`,
                            company: {
                                id: supplier.id,
                                name: supplier.companyName,
                                industry: supplier.industryType,
                                location: supplier.factory?.city,
                                state: supplier.factory?.state
                            },
                            material: {
                                type: supplierWaste.materialType,
                                category: supplierWaste.materialCategory,
                                quantityAvailable: supplierWaste.quantity,
                                unit: supplierWaste.unit
                            },
                            matchScore: score,
                            distance: distance ? Math.round(distance) : null,
                            pricing: supplierWaste.pricing,
                            quality: supplierWaste.quality
                        });
                    }
                }
            }
        }

        // Apply filters
        if (minScore) {
            needYourWaste = needYourWaste.filter(m => m.matchScore >= parseInt(minScore));
            produceWhatYouNeed = produceWhatYouNeed.filter(m => m.matchScore >= parseInt(minScore));
        }

        if (maxDistance) {
            needYourWaste = needYourWaste.filter(m =>
                m.distance === null || m.distance <= parseInt(maxDistance)
            );
            produceWhatYouNeed = produceWhatYouNeed.filter(m =>
                m.distance === null || m.distance <= parseInt(maxDistance)
            );
        }

        if (materialType) {
            needYourWaste = needYourWaste.filter(m =>
                m.material.type.toLowerCase().includes(materialType.toLowerCase())
            );
            produceWhatYouNeed = produceWhatYouNeed.filter(m =>
                m.material.type.toLowerCase().includes(materialType.toLowerCase())
            );
        }

        // Sort by match score (highest first)
        needYourWaste.sort((a, b) => b.matchScore - a.matchScore);
        produceWhatYouNeed.sort((a, b) => b.matchScore - a.matchScore);

        // Limit results
        needYourWaste = needYourWaste.slice(0, parseInt(limit));
        produceWhatYouNeed = produceWhatYouNeed.slice(0, parseInt(limit));

        res.json({
            success: true,
            data: {
                needYourWaste,
                produceWhatYouNeed
            },
            meta: {
                totalBuyers: needYourWaste.length,
                totalSuppliers: produceWhatYouNeed.length
            }
        });

    } catch (error) {
        console.error('Get matches error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while fetching matches'
        });
    }
});

/**
 * GET /api/matches/:id
 * Get detailed match information
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // For demo, return mock detailed data
        res.json({
            success: true,
            data: {
                id,
                company: {
                    id: 'company_123',
                    name: 'Example Industries Ltd.',
                    industry: 'Steel & Metal Manufacturing',
                    location: 'Chennai',
                    state: 'Tamil Nadu',
                    verified: true,
                    yearsInOperation: 15,
                    employeeRange: '201-500'
                },
                material: {
                    type: 'Fly Ash',
                    category: 'Construction Waste',
                    quantity: 100,
                    unit: 'Metric Tons',
                    description: 'High-quality fly ash from thermal power generation'
                },
                quality: {
                    purity: 85,
                    moisture: 5,
                    particleSize: '2-5mm',
                    ph: 7.2
                },
                logistics: {
                    transportation: ['pickup', 'delivery'],
                    loading: ['forklift', 'crane'],
                    storage: 'covered'
                },
                pricing: {
                    amount: 1200,
                    unit: 'per ton',
                    type: 'negotiable'
                },
                compatibility: {
                    materialMatch: true,
                    quantityMatch: true,
                    qualityMatch: true,
                    distanceOk: true,
                    paymentTermsMatch: true
                },
                matchScore: 88,
                distance: 45
            }
        });

    } catch (error) {
        console.error('Get match details error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * POST /api/matches/:id/contact
 * Initiate contact for a match
 */
router.post('/:id/contact', async (req, res) => {
    try {
        const { id } = req.params;
        const { fromCompanyId, message, contactType } = req.body;

        // Log the contact request
        const contactRequest = {
            id: `contact_${Date.now()}`,
            matchId: id,
            fromCompanyId,
            message,
            contactType: contactType || 'message',
            status: 'sent',
            createdAt: new Date().toISOString()
        };

        res.json({
            success: true,
            message: 'Contact request sent successfully',
            data: contactRequest
        });

    } catch (error) {
        console.error('Contact request error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

module.exports = router;
