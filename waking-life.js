// Waking Life Filter - Interpolated Rotoscope Style
// Replicates the dreamy, constantly-shifting hand-drawn animation aesthetic

class WakingLifeFilter {
    constructor(canvas, video) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = video;

        // Processing canvases
        this.videoCanvas = document.createElement('canvas');
        this.videoCtx = this.videoCanvas.getContext('2d', { willReadFrequently: true });

        this.processCanvas = document.createElement('canvas');
        this.processCtx = this.processCanvas.getContext('2d', { willReadFrequently: true });

        // Settings
        this.wobbleIntensity = 2.5;
        this.wobbleSpeed = 0.002;
        this.colorLevels = 8;
        this.edgeThickness = 1.5;
        this.edgeOpacity = 0.7;
        this.colorShiftAmount = 15;
        this.colorShiftSpeed = 0.0008;
        this.breathingIntensity = 2.5;
        this.breathingSpeed = 0.0015;
        this.painterliness = 0.6;
        this.saturationBoost = 1.3;

        // Animation state
        this.time = 0;
        this.frameCount = 0;

        // Perlin-like noise tables
        this.noiseTableX = this.generateNoiseTable();
        this.noiseTableY = this.generateNoiseTable();
        this.noiseTableColor = this.generateNoiseTable();

        // Edge data cache
        this.edgeData = null;
        this.lastWidth = 0;
        this.lastHeight = 0;

        // Motion detection
        this.prevFrame = null;
        this.motionMap = null;
        this.globalMotion = 0;
    }

    generateNoiseTable() {
        const size = 512;
        const table = new Float32Array(size * size);
        for (let i = 0; i < table.length; i++) {
            table[i] = Math.random();
        }
        return table;
    }

    noise2D(x, y, table) {
        const size = 512;
        const xi = Math.floor(Math.abs(x)) % size;
        const yi = Math.floor(Math.abs(y)) % size;
        const xf = x - Math.floor(x);
        const yf = y - Math.floor(y);

        const n00 = table[yi * size + xi];
        const n10 = table[yi * size + ((xi + 1) % size)];
        const n01 = table[((yi + 1) % size) * size + xi];
        const n11 = table[((yi + 1) % size) * size + ((xi + 1) % size)];

        // Smoothstep interpolation
        const sx = xf * xf * (3 - 2 * xf);
        const sy = yf * yf * (3 - 2 * yf);

        const nx0 = n00 * (1 - sx) + n10 * sx;
        const nx1 = n01 * (1 - sx) + n11 * sx;

        return nx0 * (1 - sy) + nx1 * sy;
    }

    // Fractal Brownian Motion
    fbm(x, y, table, octaves = 3) {
        let value = 0;
        let amplitude = 0.5;
        let frequency = 1;
        let maxValue = 0;

        for (let i = 0; i < octaves; i++) {
            value += amplitude * this.noise2D(x * frequency, y * frequency, table);
            maxValue += amplitude;
            amplitude *= 0.5;
            frequency *= 2;
        }

        return value / maxValue;
    }

    // Detect motion between frames
    detectMotion(src, width, height) {
        const gridSize = 16; // Sample grid for performance
        const gridW = Math.floor(width / gridSize);
        const gridH = Math.floor(height / gridSize);

        if (!this.motionMap || this.motionMap.length !== gridW * gridH) {
            this.motionMap = new Float32Array(gridW * gridH);
        }

        if (!this.prevFrame) {
            this.prevFrame = new Uint8ClampedArray(src);
            return;
        }

        let totalMotion = 0;

        for (let gy = 0; gy < gridH; gy++) {
            for (let gx = 0; gx < gridW; gx++) {
                const x = gx * gridSize + gridSize / 2;
                const y = gy * gridSize + gridSize / 2;
                const idx = (Math.floor(y) * width + Math.floor(x)) * 4;

                // Compare current and previous frame
                const diffR = Math.abs(src[idx] - this.prevFrame[idx]);
                const diffG = Math.abs(src[idx + 1] - this.prevFrame[idx + 1]);
                const diffB = Math.abs(src[idx + 2] - this.prevFrame[idx + 2]);
                const motion = (diffR + diffG + diffB) / (255 * 3);

                const gridIdx = gy * gridW + gx;
                // Smooth motion over time
                this.motionMap[gridIdx] = this.motionMap[gridIdx] * 0.7 + motion * 0.3;
                totalMotion += this.motionMap[gridIdx];
            }
        }

        // Store global motion level (smoothed)
        const avgMotion = totalMotion / (gridW * gridH);
        this.globalMotion = this.globalMotion * 0.8 + avgMotion * 0.2;

        // Copy current frame to previous
        this.prevFrame.set(src);
    }

    // Get local motion at a position
    getMotionAt(x, y, width, height) {
        if (!this.motionMap) return this.globalMotion;

        const gridSize = 16;
        const gridW = Math.floor(width / gridSize);
        const gridH = Math.floor(height / gridSize);

        const gx = Math.floor(x / gridSize);
        const gy = Math.floor(y / gridSize);

        if (gx < 0 || gx >= gridW || gy < 0 || gy >= gridH) {
            return this.globalMotion;
        }

        return this.motionMap[gy * gridW + gx];
    }

    draw() {
        if (!this.video.videoWidth) return;

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Resize processing canvases if needed
        if (this.processCanvas.width !== width || this.processCanvas.height !== height) {
            this.processCanvas.width = width;
            this.processCanvas.height = height;
            this.videoCanvas.width = width;
            this.videoCanvas.height = height;
        }

        // Draw video frame (mirrored)
        this.videoCtx.save();
        this.videoCtx.scale(-1, 1);
        this.videoCtx.drawImage(this.video, -width, 0, width, height);
        this.videoCtx.restore();

        // Get source pixels
        const sourceData = this.videoCtx.getImageData(0, 0, width, height);
        const src = sourceData.data;

        // Detect motion
        this.detectMotion(src, width, height);

        // Create output buffer
        const outputData = this.ctx.createImageData(width, height);
        const dst = outputData.data;

        // Update time
        this.time += 16;
        this.frameCount++;

        const t = this.time * this.wobbleSpeed;
        const colorT = this.time * this.colorShiftSpeed;
        const breathT = this.time * this.breathingSpeed;

        // Breathing scale
        const breathScale = 1 + Math.sin(breathT) * 0.004 * this.breathingIntensity;
        const cx = width / 2;
        const cy = height / 2;

        // Process each pixel
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                // Get local motion at this position
                const localMotion = this.getMotionAt(x, y, width, height);
                // Motion multiplier: base 1x + up to 4x more with motion
                const motionMultiplier = 1 + localMotion * 15 + this.globalMotion * 8;

                // Calculate wobble offset - increases with motion
                const wobbleX = (this.fbm(x * 0.015 + t, y * 0.015, this.noiseTableX) - 0.5) * this.wobbleIntensity * 3 * motionMultiplier;
                const wobbleY = (this.fbm(x * 0.015, y * 0.015 + t * 1.2, this.noiseTableY) - 0.5) * this.wobbleIntensity * 3 * motionMultiplier;

                // Apply breathing
                let srcX = (x - cx) / breathScale + cx + wobbleX;
                let srcY = (y - cy) / breathScale + cy + wobbleY;

                // Clamp
                srcX = Math.max(0, Math.min(width - 1, srcX));
                srcY = Math.max(0, Math.min(height - 1, srcY));

                // Bilinear sample
                const x0 = Math.floor(srcX);
                const y0 = Math.floor(srcY);
                const x1 = Math.min(x0 + 1, width - 1);
                const y1 = Math.min(y0 + 1, height - 1);
                const xf = srcX - x0;
                const yf = srcY - y0;

                const idx00 = (y0 * width + x0) * 4;
                const idx10 = (y0 * width + x1) * 4;
                const idx01 = (y1 * width + x0) * 4;
                const idx11 = (y1 * width + x1) * 4;

                let r = this.bilerp(src[idx00], src[idx10], src[idx01], src[idx11], xf, yf);
                let g = this.bilerp(src[idx00 + 1], src[idx10 + 1], src[idx01 + 1], src[idx11 + 1], xf, yf);
                let b = this.bilerp(src[idx00 + 2], src[idx10 + 2], src[idx01 + 2], src[idx11 + 2], xf, yf);

                // Boost saturation
                const gray = r * 0.299 + g * 0.587 + b * 0.114;
                r = gray + (r - gray) * this.saturationBoost;
                g = gray + (g - gray) * this.saturationBoost;
                b = gray + (b - gray) * this.saturationBoost;

                // Apply color shift based on noise
                const colorNoise = this.fbm(x * 0.008 + colorT, y * 0.008 + colorT * 0.7, this.noiseTableColor, 2);
                const shift = (colorNoise - 0.5) * this.colorShiftAmount * 2;

                r += shift * 1.2;
                g += shift * 0.6;
                b -= shift * 0.8;

                // Quantize colors for painterly effect
                const levels = this.colorLevels;
                const step = 255 / (levels - 1);

                // Add slight dithering/variation to quantization
                const dither = (this.noise2D(x * 0.5 + this.frameCount * 0.1, y * 0.5, this.noiseTableColor) - 0.5) * step * 0.3;

                r = Math.round((r + dither) / step) * step;
                g = Math.round((g + dither) / step) * step;
                b = Math.round((b + dither) / step) * step;

                // Clamp values
                r = Math.max(0, Math.min(255, r));
                g = Math.max(0, Math.min(255, g));
                b = Math.max(0, Math.min(255, b));

                const dstIdx = (y * width + x) * 4;
                dst[dstIdx] = r;
                dst[dstIdx + 1] = g;
                dst[dstIdx + 2] = b;
                dst[dstIdx + 3] = 255;
            }
        }

        // Apply painterly smoothing (simplified bilateral-like effect)
        if (this.painterliness > 0.2) {
            this.applyPainterlySmooth(dst, width, height);
        }

        // Put the processed image
        this.ctx.putImageData(outputData, 0, 0);

        // Detect and draw wobbly edges on top
        this.detectAndDrawEdges(src, width, height);
    }

    bilerp(v00, v10, v01, v11, xf, yf) {
        const v0 = v00 * (1 - xf) + v10 * xf;
        const v1 = v01 * (1 - xf) + v11 * xf;
        return v0 * (1 - yf) + v1 * yf;
    }

    applyPainterlySmooth(data, width, height) {
        // Simple smoothing pass that preserves edges
        const radius = Math.floor(1 + this.painterliness * 2);
        const temp = new Uint8ClampedArray(data);
        const colorThreshold = 40 + (1 - this.painterliness) * 60;

        for (let y = radius; y < height - radius; y += 2) {
            for (let x = radius; x < width - radius; x += 2) {
                const idx = (y * width + x) * 4;
                const centerR = temp[idx];
                const centerG = temp[idx + 1];
                const centerB = temp[idx + 2];

                let sumR = 0, sumG = 0, sumB = 0, count = 0;

                for (let dy = -radius; dy <= radius; dy++) {
                    for (let dx = -radius; dx <= radius; dx++) {
                        const nidx = ((y + dy) * width + (x + dx)) * 4;
                        const nr = temp[nidx];
                        const ng = temp[nidx + 1];
                        const nb = temp[nidx + 2];

                        // Only average similar colors
                        const diff = Math.abs(nr - centerR) + Math.abs(ng - centerG) + Math.abs(nb - centerB);
                        if (diff < colorThreshold) {
                            sumR += nr;
                            sumG += ng;
                            sumB += nb;
                            count++;
                        }
                    }
                }

                if (count > 0) {
                    data[idx] = sumR / count;
                    data[idx + 1] = sumG / count;
                    data[idx + 2] = sumB / count;
                }
            }
        }
    }

    detectAndDrawEdges(src, width, height) {
        if (this.edgeOpacity < 0.05) return;

        const t = this.time * this.wobbleSpeed * 2;
        const ctx = this.ctx;

        // Sobel edge detection
        const threshold = 25;

        ctx.lineCap = 'round';

        // Sample edges at intervals for performance
        const step = 3;

        for (let y = step; y < height - step; y += step) {
            for (let x = step; x < width - step; x += step) {
                // Sobel operator
                const idx = (y * width + x) * 4;
                const idxL = (y * width + (x - step)) * 4;
                const idxR = (y * width + (x + step)) * 4;
                const idxU = ((y - step) * width + x) * 4;
                const idxD = ((y + step) * width + x) * 4;

                const lumC = (src[idx] + src[idx + 1] + src[idx + 2]) / 3;
                const lumL = (src[idxL] + src[idxL + 1] + src[idxL + 2]) / 3;
                const lumR = (src[idxR] + src[idxR + 1] + src[idxR + 2]) / 3;
                const lumU = (src[idxU] + src[idxU + 1] + src[idxU + 2]) / 3;
                const lumD = (src[idxD] + src[idxD + 1] + src[idxD + 2]) / 3;

                const gx = lumR - lumL;
                const gy = lumD - lumU;
                const magnitude = Math.sqrt(gx * gx + gy * gy);

                if (magnitude > threshold) {
                    // Get local motion for edge wobble
                    const localMotion = this.getMotionAt(x, y, width, height);
                    const edgeMotionMult = 1 + localMotion * 12 + this.globalMotion * 6;

                    // Calculate wobble for this edge point - increases with motion
                    const wobbleX = (this.noise2D(x * 0.08 + t * 3, y * 0.08, this.noiseTableX) - 0.5) * this.wobbleIntensity * 4 * edgeMotionMult;
                    const wobbleY = (this.noise2D(x * 0.08, y * 0.08 + t * 3.5, this.noiseTableY) - 0.5) * this.wobbleIntensity * 4 * edgeMotionMult;

                    const drawX = x + wobbleX;
                    const drawY = y + wobbleY;

                    // Edge color - dark with slight color variation
                    const colorVar = this.noise2D(x * 0.02 + this.frameCount * 0.05, y * 0.02, this.noiseTableColor);
                    const edgeR = Math.floor(20 + colorVar * 30);
                    const edgeG = Math.floor(15 + colorVar * 25);
                    const edgeB = Math.floor(25 + colorVar * 20);

                    // Opacity based on edge strength
                    const alpha = Math.min(1, magnitude / 80) * this.edgeOpacity;

                    ctx.strokeStyle = `rgba(${edgeR}, ${edgeG}, ${edgeB}, ${alpha})`;

                    // Line width increases with motion
                    ctx.lineWidth = this.edgeThickness * (1 + localMotion * 2);

                    // Draw short strokes perpendicular to edge direction
                    // Stroke length increases with motion
                    const angle = Math.atan2(gy, gx) + Math.PI / 2;
                    const strokeLen = (1.5 + this.noise2D(x * 0.1, y * 0.1, this.noiseTableX) * 2) * (1 + localMotion * 3);

                    ctx.beginPath();
                    ctx.moveTo(
                        drawX - Math.cos(angle) * strokeLen,
                        drawY - Math.sin(angle) * strokeLen
                    );
                    ctx.lineTo(
                        drawX + Math.cos(angle) * strokeLen,
                        drawY + Math.sin(angle) * strokeLen
                    );
                    ctx.stroke();
                }
            }
        }

        // Add some random "sketchy" marks for hand-drawn feel
        if (this.frameCount % 3 === 0) {
            this.addSketchyMarks(width, height);
        }
    }

    addSketchyMarks(width, height) {
        const ctx = this.ctx;
        const numMarks = Math.floor(5 + this.painterliness * 10);

        for (let i = 0; i < numMarks; i++) {
            const x = Math.random() * width;
            const y = Math.random() * height;

            // Only add marks in areas with some detail
            const t = this.time * this.wobbleSpeed;
            const noise = this.noise2D(x * 0.01 + t, y * 0.01, this.noiseTableColor);

            if (noise > 0.6) {
                const alpha = (noise - 0.6) * 0.3 * this.edgeOpacity;
                ctx.strokeStyle = `rgba(30, 25, 35, ${alpha})`;
                ctx.lineWidth = 0.5 + Math.random();

                const wobbleX = (this.noise2D(x * 0.1 + t, y * 0.1, this.noiseTableX) - 0.5) * 5;
                const wobbleY = (this.noise2D(x * 0.1, y * 0.1 + t, this.noiseTableY) - 0.5) * 5;

                ctx.beginPath();
                ctx.moveTo(x + wobbleX, y + wobbleY);
                ctx.lineTo(x + wobbleX + (Math.random() - 0.5) * 8, y + wobbleY + (Math.random() - 0.5) * 8);
                ctx.stroke();
            }
        }
    }
}

// Export for use in main app
window.WakingLifeFilter = WakingLifeFilter;
