// Archer Filter - Cell-shaded animation style
// Replicates the bold outlines, flat colors, and mid-century modern aesthetic

class ArcherFilter {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = video;

        // Processing canvases
        this.videoCanvas = document.createElement('canvas');
        this.videoCtx = this.videoCanvas.getContext('2d', { willReadFrequently: true });

        // Settings
        this.edgeThickness = 3;
        this.colorLevels = 6;
        this.shadowIntensity = 5;
        this.highlightBoost = 5;
        this.saturationBoost = 6;

        // Edge detection kernels
        this.sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        this.sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];
    }

    draw() {
        if (!this.video.videoWidth) return;

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Resize processing canvas if needed
        if (this.videoCanvas.width !== width || this.videoCanvas.height !== height) {
            this.videoCanvas.width = width;
            this.videoCanvas.height = height;
        }

        // Draw video frame (mirrored)
        this.videoCtx.save();
        this.videoCtx.scale(-1, 1);
        this.videoCtx.drawImage(this.video, -width, 0, width, height);
        this.videoCtx.restore();

        // Get source pixels
        const imageData = this.videoCtx.getImageData(0, 0, width, height);
        const src = imageData.data;

        // Create output buffer
        const outputData = this.ctx.createImageData(width, height);
        const dst = outputData.data;

        // Edge detection buffer
        const edges = new Float32Array(width * height);

        // First pass: Detect edges and process colors
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;

                // Get original color
                let r = src[idx];
                let g = src[idx + 1];
                let b = src[idx + 2];

                // Calculate luminance for edge detection
                const lum = r * 0.299 + g * 0.587 + b * 0.114;

                // Sobel edge detection
                let gx = 0, gy = 0;
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const nidx = ((y + ky) * width + (x + kx)) * 4;
                        const nLum = src[nidx] * 0.299 + src[nidx + 1] * 0.587 + src[nidx + 2] * 0.114;
                        gx += nLum * this.sobelX[ky + 1][kx + 1];
                        gy += nLum * this.sobelY[ky + 1][kx + 1];
                    }
                }
                const edgeMagnitude = Math.sqrt(gx * gx + gy * gy);
                edges[y * width + x] = edgeMagnitude;

                // Boost saturation
                const gray = lum;
                const satMult = 1 + (this.saturationBoost - 5) * 0.15;
                r = gray + (r - gray) * satMult;
                g = gray + (g - gray) * satMult;
                b = gray + (b - gray) * satMult;

                // Apply shadow/highlight contrast
                const shadowMult = this.shadowIntensity / 5;
                const highlightMult = this.highlightBoost / 5;

                if (lum < 80) {
                    // Darken shadows
                    const factor = 0.7 + (1 - shadowMult) * 0.3;
                    r *= factor;
                    g *= factor;
                    b *= factor;
                } else if (lum > 180) {
                    // Boost highlights
                    const factor = 1 + (highlightMult - 1) * 0.2;
                    r = Math.min(255, r * factor);
                    g = Math.min(255, g * factor);
                    b = Math.min(255, b * factor);
                }

                // Quantize colors for flat cel-shaded look
                const levels = this.colorLevels;
                const step = 255 / (levels - 1);
                r = Math.round(r / step) * step;
                g = Math.round(g / step) * step;
                b = Math.round(b / step) * step;

                // Clamp
                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));

                dst[idx] = r;
                dst[idx + 1] = g;
                dst[idx + 2] = b;
                dst[idx + 3] = 255;
            }
        }

        // Second pass: Apply edge darkening based on thickness
        const edgeThreshold = 30;
        const thickness = Math.floor(this.edgeThickness);

        for (let y = thickness; y < height - thickness; y++) {
            for (let x = thickness; x < width - thickness; x++) {
                const idx = (y * width + x) * 4;

                // Check if any nearby pixel is an edge
                let maxEdge = 0;
                for (let dy = -thickness; dy <= thickness; dy++) {
                    for (let dx = -thickness; dx <= thickness; dx++) {
                        const dist = Math.sqrt(dx * dx + dy * dy);
                        if (dist <= thickness) {
                            const edgeVal = edges[(y + dy) * width + (x + dx)];
                            maxEdge = Math.max(maxEdge, edgeVal);
                        }
                    }
                }

                if (maxEdge > edgeThreshold) {
                    // Darken based on edge strength
                    const edgeFactor = Math.min(1, (maxEdge - edgeThreshold) / 100);
                    const darkness = edgeFactor * 0.85;

                    dst[idx] = dst[idx] * (1 - darkness);
                    dst[idx + 1] = dst[idx + 1] * (1 - darkness);
                    dst[idx + 2] = dst[idx + 2] * (1 - darkness);
                }
            }
        }

        // Put the processed image
        this.ctx.putImageData(outputData, 0, 0);

        // Draw bold outlines on top
        this.drawOutlines(edges, width, height);
    }

    drawOutlines(edges, width, height) {
        const ctx = this.ctx;
        const threshold = 40;
        const step = 2;

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = this.edgeThickness * 0.8;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw connected edge segments
        for (let y = step; y < height - step; y += step) {
            for (let x = step; x < width - step; x += step) {
                const edgeVal = edges[y * width + x];

                if (edgeVal > threshold) {
                    // Find edge direction
                    const idx = (y * width + x) * 4;

                    // Look for connected edge pixels
                    const neighbors = [
                        { dx: step, dy: 0 },
                        { dx: 0, dy: step },
                        { dx: step, dy: step },
                        { dx: -step, dy: step }
                    ];

                    for (const n of neighbors) {
                        const nx = x + n.dx;
                        const ny = y + n.dy;

                        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                            const neighborEdge = edges[ny * width + nx];

                            if (neighborEdge > threshold) {
                                // Calculate opacity based on edge strength
                                const strength = Math.min(1, Math.min(edgeVal, neighborEdge) / 150);
                                ctx.strokeStyle = `rgba(0, 0, 0, ${0.6 + strength * 0.4})`;

                                ctx.beginPath();
                                ctx.moveTo(x, y);
                                ctx.lineTo(nx, ny);
                                ctx.stroke();
                            }
                        }
                    }
                }
            }
        }
    }
}

// Export
window.ArcherFilter = ArcherFilter;
