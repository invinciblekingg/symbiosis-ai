/**
 * Symbiosis.ai - Document Validator with OCR
 * Uses Tesseract.js for client-side OCR to validate uploaded documents
 */

const DocumentValidator = {
    // Tesseract worker for OCR
    worker: null,
    isLoaded: false,

    // Load Tesseract.js dynamically
    async loadTesseract() {
        if (this.isLoaded) return true;

        try {
            // Check if Tesseract is already loaded
            if (typeof Tesseract !== 'undefined') {
                this.isLoaded = true;
                return true;
            }

            // Load Tesseract.js from CDN
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@4/dist/tesseract.min.js';
                script.onload = resolve;
                script.onerror = reject;
                document.head.appendChild(script);
            });

            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error('Failed to load Tesseract:', error);
            return false;
        }
    },

    // Analyze image for document characteristics
    async analyzeImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();

            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);

                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    const analysis = this.analyzePixels(imageData);

                    resolve({
                        width: img.width,
                        height: img.height,
                        aspectRatio: img.width / img.height,
                        ...analysis
                    });
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    },

    // Analyze pixel data for document characteristics
    analyzePixels(imageData) {
        const pixels = imageData.data;
        let brightPixels = 0;
        let darkPixels = 0;
        let totalVariance = 0;
        let previousBrightness = 0;
        const edgeCount = { horizontal: 0, vertical: 0 };

        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];
            const brightness = (r + g + b) / 3;

            if (brightness > 200) brightPixels++;
            if (brightness < 50) darkPixels++;

            totalVariance += Math.abs(brightness - previousBrightness);
            previousBrightness = brightness;
        }

        const totalPixels = pixels.length / 4;
        const brightRatio = brightPixels / totalPixels;
        const darkRatio = darkPixels / totalPixels;
        const avgVariance = totalVariance / totalPixels;

        return {
            brightRatio,
            darkRatio,
            variance: avgVariance,
            hasHighContrast: avgVariance > 20,
            isMainlyWhite: brightRatio > 0.6,
            hasDarkElements: darkRatio > 0.05 && darkRatio < 0.4
        };
    },

    // Perform OCR to detect text
    async extractText(file, onProgress) {
        const loaded = await this.loadTesseract();
        if (!loaded) {
            return { success: false, text: '', confidence: 0, error: 'OCR not available' };
        }

        try {
            const result = await Tesseract.recognize(file, 'eng+hin', {
                logger: m => {
                    if (onProgress && m.status === 'recognizing text') {
                        onProgress(Math.round(m.progress * 100));
                    }
                }
            });

            return {
                success: true,
                text: result.data.text,
                confidence: result.data.confidence,
                words: result.data.words?.length || 0
            };
        } catch (error) {
            console.error('OCR error:', error);
            return { success: false, text: '', confidence: 0, error: error.message };
        }
    },

    // Check for document keywords (GST, registration, license, etc.)
    detectDocumentKeywords(text) {
        const keywords = {
            gst: ['gst', 'gstin', 'goods and services tax', 'tax invoice'],
            registration: ['registration', 'certificate', 'registered', 'reg no', 'registration number'],
            license: ['license', 'licence', 'permit', 'authorization', 'authorisation'],
            company: ['company', 'pvt ltd', 'private limited', 'llp', 'incorporated', 'corporation'],
            government: ['government', 'govt', 'ministry', 'department', 'india', 'state'],
            factory: ['factory', 'manufacturing', 'industrial', 'plant', 'unit'],
            date: /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g,
            numbers: /[A-Z]{2,3}[0-9]{6,}/g // Like GSTIN patterns
        };

        const lowerText = text.toLowerCase();
        const found = {};
        let score = 0;

        for (const [key, pattern] of Object.entries(keywords)) {
            if (Array.isArray(pattern)) {
                found[key] = pattern.some(p => lowerText.includes(p));
                if (found[key]) score += 10;
            } else {
                const matches = text.match(pattern);
                found[key] = matches ? matches.length : 0;
                if (found[key] > 0) score += 15;
            }
        }

        return { keywords: found, score };
    },

    // Validate if the file is a legitimate document
    async validateDocument(file, onProgress) {
        const result = {
            isValid: false,
            confidence: 0,
            reasons: [],
            warnings: [],
            details: {}
        };

        // Basic file validation
        if (!file || !file.type.startsWith('image/')) {
            result.reasons.push('File is not an image');
            return result;
        }

        // Check file size (should be reasonable for a document scan)
        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB < 0.01) {
            result.reasons.push('File is too small - likely not a real document');
            return result;
        }
        if (sizeMB > 15) {
            result.warnings.push('File is very large - consider compressing');
        }

        // Analyze image characteristics
        if (onProgress) onProgress(10);
        const imageAnalysis = await this.analyzeImage(file);
        result.details.imageAnalysis = imageAnalysis;

        // Check aspect ratio (documents are usually portrait or landscape A4-ish)
        const ar = imageAnalysis.aspectRatio;
        const isDocumentRatio = (ar > 0.6 && ar < 0.9) || (ar > 1.1 && ar < 1.7);
        if (!isDocumentRatio) {
            result.warnings.push('Unusual aspect ratio for a document');
        }

        // Check if image is too uniform (might be blank or solid color)
        if (imageAnalysis.variance < 5) {
            result.reasons.push('Image appears to be blank or solid color');
            return result;
        }

        // Check for document-like characteristics
        let confScore = 0;

        if (imageAnalysis.isMainlyWhite) {
            confScore += 20;
            result.details.hasWhiteBackground = true;
        }

        if (imageAnalysis.hasDarkElements) {
            confScore += 15;
            result.details.hasText = true;
        }

        if (imageAnalysis.hasHighContrast) {
            confScore += 10;
        }

        // Perform OCR for text detection
        if (onProgress) onProgress(30);
        const ocrResult = await this.extractText(file, (p) => {
            if (onProgress) onProgress(30 + Math.round(p * 0.5));
        });

        result.details.ocr = ocrResult;

        if (ocrResult.success) {
            // Check for meaningful text
            if (ocrResult.words > 10) {
                confScore += 20;
                result.details.hasReadableText = true;
            } else if (ocrResult.words > 3) {
                confScore += 10;
            }

            // Check OCR confidence
            if (ocrResult.confidence > 70) {
                confScore += 15;
            } else if (ocrResult.confidence > 50) {
                confScore += 10;
            }

            // Check for document keywords
            const keywordResult = this.detectDocumentKeywords(ocrResult.text);
            result.details.keywords = keywordResult;
            confScore += keywordResult.score;

            if (keywordResult.keywords.gst) {
                result.details.documentType = 'GST Certificate / Invoice';
            } else if (keywordResult.keywords.license) {
                result.details.documentType = 'License / Permit';
            } else if (keywordResult.keywords.registration) {
                result.details.documentType = 'Registration Document';
            } else if (keywordResult.keywords.company) {
                result.details.documentType = 'Company Document';
            }
        } else {
            result.warnings.push('Could not perform OCR verification');
            // Still give some credit for image characteristics
            confScore += 10;
        }

        if (onProgress) onProgress(100);

        // Calculate final confidence
        result.confidence = Math.min(confScore, 100);
        result.isValid = result.confidence >= 40 && result.reasons.length === 0;

        // Add summary
        if (result.isValid) {
            if (result.confidence >= 70) {
                result.summary = '✅ This appears to be a valid document';
            } else if (result.confidence >= 50) {
                result.summary = '⚠️ This might be a document, but verification is uncertain';
            } else {
                result.summary = '⚠️ Low confidence - please ensure this is a clear document scan';
            }
        } else {
            result.summary = '❌ This does not appear to be a valid document';
        }

        return result;
    }
};

// Export for use in other files
window.DocumentValidator = DocumentValidator;
