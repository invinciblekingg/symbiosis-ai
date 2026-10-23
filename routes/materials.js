const express = require('express');
const router = express.Router();
const supabaseService = require('../supabaseServer');

// In-memory storage for materials/listings (synchronized with Supabase)
const materials = new Map();
let listingIdCounter = 1;

/**
 * POST /api/materials
 * Create a new material listing
 */
router.post('/', async (req, res) => {
    try {
        const {
            companyId,
            type, // 'waste' or 'requirement'
            materialType,
            materialCategory,
            description,
            quantity,
            unit,
            quality,
            hazardous,
            disposalMethod,
            availability,
            storageCapacity,
            transactionTypes,
            pricing,
            images
        } = req.body;

        const listingId = `listing_${Date.now()}_${listingIdCounter++}`;

        const listing = {
            id: listingId,
            companyId,
            type,
            materialType,
            materialCategory,
            description,
            quantity,
            unit,
            quality: quality || {},
            hazardous: hazardous || 'non-hazardous',
            disposalMethod,
            availability: availability || 'continuous',
            storageCapacity,
            transactionTypes: transactionTypes || ['negotiable'],
            pricing: pricing || {},
            images: images || [],
            status: 'active',
            views: 0,
            inquiries: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        materials.set(listingId, listing);

        // Async write to Supabase
        supabaseService.addMaterial({
            id: listingId,
            company_id: companyId || 'demo_user',
            title: materialType || 'Industrial Material',
            description,
            type: type || 'waste',
            category: materialCategory || 'Manufacturing',
            material_type: materialType,
            quantity: parseFloat(quantity) || 0,
            unit: unit || 'tons',
            quality,
            hazardous,
            pricing,
            images
        }).catch(err => console.warn('Supabase sync listing warning:', err.message));

        res.status(201).json({
            success: true,
            message: 'Listing created successfully',
            data: listing
        });

    } catch (error) {
        console.error('Create listing error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * GET /api/materials
 * Get all material listings with filters
 */
router.get('/', async (req, res) => {
    try {
        const {
            type,
            materialType,
            category,
            minQuantity,
            maxQuantity,
            minPrice,
            maxPrice,
            hazardous,
            availability,
            sortBy,
            sortOrder,
            page = 1,
            limit = 20
        } = req.query;

        let results = Array.from(materials.values());

        // Apply filters
        if (type) {
            results = results.filter(m => m.type === type);
        }
        if (materialType) {
            results = results.filter(m =>
                m.materialType.toLowerCase().includes(materialType.toLowerCase())
            );
        }
        if (category) {
            results = results.filter(m => m.materialCategory === category);
        }
        if (minQuantity) {
            results = results.filter(m => m.quantity >= parseFloat(minQuantity));
        }
        if (maxQuantity) {
            results = results.filter(m => m.quantity <= parseFloat(maxQuantity));
        }
        if (hazardous) {
            results = results.filter(m => m.hazardous === hazardous);
        }
        if (availability) {
            results = results.filter(m => m.availability === availability);
        }

        // Only show active listings
        results = results.filter(m => m.status === 'active');

        // Sorting
        if (sortBy) {
            results.sort((a, b) => {
                const order = sortOrder === 'desc' ? -1 : 1;
                if (sortBy === 'createdAt') {
                    return order * (new Date(a.createdAt) - new Date(b.createdAt));
                }
                if (sortBy === 'quantity') {
                    return order * (a.quantity - b.quantity);
                }
                if (sortBy === 'price') {
                    return order * ((a.pricing?.amount || 0) - (b.pricing?.amount || 0));
                }
                return 0;
            });
        }

        // Pagination
        const startIndex = (parseInt(page) - 1) * parseInt(limit);
        const endIndex = startIndex + parseInt(limit);
        const paginatedResults = results.slice(startIndex, endIndex);

        res.json({
            success: true,
            data: paginatedResults,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: results.length,
                pages: Math.ceil(results.length / parseInt(limit))
            }
        });

    } catch (error) {
        console.error('Get materials error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * GET /api/materials/:id
 * Get a specific material listing
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const listing = materials.get(id);

        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }

        // Increment view count
        listing.views++;
        materials.set(id, listing);

        res.json({
            success: true,
            data: listing
        });

    } catch (error) {
        console.error('Get material error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * PUT /api/materials/:id
 * Update a material listing
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        const listing = materials.get(id);
        if (!listing) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }

        const updatedListing = {
            ...listing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        materials.set(id, updatedListing);

        res.json({
            success: true,
            message: 'Listing updated successfully',
            data: updatedListing
        });

    } catch (error) {
        console.error('Update material error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * DELETE /api/materials/:id
 * Delete a material listing
 */
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        if (!materials.has(id)) {
            return res.status(404).json({
                success: false,
                message: 'Listing not found'
            });
        }

        materials.delete(id);

        res.json({
            success: true,
            message: 'Listing deleted successfully'
        });

    } catch (error) {
        console.error('Delete material error:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred'
        });
    }
});

/**
 * GET /api/materials/categories/list
 * Get all material categories
 */
router.get('/categories/list', async (req, res) => {
    const categories = {
        construction: {
            name: 'Construction Waste',
            materials: [
                'Fly Ash', 'Bottom Ash', 'Gypsum', 'Cement Kiln Dust',
                'Demolished Concrete', 'Brick Waste'
            ]
        },
        metal: {
            name: 'Metal Waste',
            materials: [
                'Ferrous Scrap (Iron/Steel)', 'Non-ferrous Scrap (Aluminum)',
                'Non-ferrous Scrap (Copper)', 'Non-ferrous Scrap (Brass)',
                'Metal Turnings/Chips', 'Slag (Steel/Iron)'
            ]
        },
        plastic: {
            name: 'Plastic Waste',
            materials: [
                'PET Bottles/Scrap', 'HDPE Scrap', 'LDPE Film',
                'PP Scrap', 'PVC Scrap', 'Mixed Plastic Waste'
            ]
        },
        organic: {
            name: 'Organic Waste',
            materials: [
                'Food Processing Waste', 'Agricultural Residue',
                'Bagasse (Sugarcane)', 'Rice Husk', 'Corn Cob', 'Press Mud'
            ]
        },
        chemical: {
            name: 'Chemical Waste',
            materials: [
                'Chemical Sludge', 'Spent Catalyst', 'Acid/Alkali Byproducts',
                'Glycerin', 'Tar'
            ]
        },
        textile: {
            name: 'Textile Waste',
            materials: [
                'Cotton Fabric Scraps', 'Synthetic Fabric Scraps',
                'Yarn Waste', 'Cutting Waste'
            ]
        },
        paper: {
            name: 'Paper Waste',
            materials: [
                'Cardboard Waste', 'Office Paper Waste', 'Packaging Paper'
            ]
        },
        electronic: {
            name: 'Electronic Waste',
            materials: [
                'E-waste Components', 'Circuit Board Scrap', 'Battery Scrap'
            ]
        }
    };

    res.json({
        success: true,
        data: categories
    });
});

module.exports = router;
