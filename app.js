// Vision Filter - Main Application
// Handles all filters and UI interactions

class App {
    constructor() {
        this.canvas = document.getElementById('mainCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.video = document.getElementById('video');

        // Current filter mode
        this.mode = 'matrix';

        // Initialize filters
        this.filters = {
            matrix: new MatrixFilter(this.canvas, this.video),
            wakingLife: new WakingLifeFilter(this.canvas, this.video),
            archer: new ArcherFilter(this.canvas, this.video)
        };

        this.isRunning = false;
        this.settingsPanelOpen = false;

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Start button
        document.getElementById('startBtn').addEventListener('click', () => this.start());

        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this.setMode(filter);
            });
        });

        // Settings toggle
        document.getElementById('settingsToggle').addEventListener('click', () => {
            this.toggleSettings();
        });

        document.getElementById('closeSettings').addEventListener('click', () => {
            this.toggleSettings(false);
        });

        // Fullscreen
        document.getElementById('fullscreenBtn').addEventListener('click', () => {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                document.documentElement.requestFullscreen();
            }
        });

        // Camera selection
        document.getElementById('cameraSelect').addEventListener('change', (e) => {
            this.switchCamera(e.target.value);
        });

        // Matrix controls
        this.setupSlider('charSize', (val) => {
            this.filters.matrix.charSize = parseInt(val);
            this.filters.matrix.initGrid();
        }, 'px');
        this.setupSlider('fallSpeed', (val) => this.filters.matrix.fallSpeed = parseInt(val));
        this.setupSlider('brightness', (val) => this.filters.matrix.brightnessSensitivity = parseInt(val));
        this.setupSlider('explosionRate', (val) => this.filters.matrix.explosionRate = parseInt(val));
        this.setupSlider('contrast', (val) => this.filters.matrix.contrast = parseInt(val));

        // Waking Life controls
        this.setupSlider('wobbleIntensity', (val) => this.filters.wakingLife.wobbleIntensity = val / 2);
        this.setupSlider('colorLevels', (val) => this.filters.wakingLife.colorLevels = parseInt(val));
        this.setupSlider('edgeOpacity', (val) => this.filters.wakingLife.edgeOpacity = val / 10);
        this.setupSlider('colorShift', (val) => this.filters.wakingLife.colorShiftAmount = val * 3);
        this.setupSlider('breathingIntensity', (val) => this.filters.wakingLife.breathingIntensity = val / 2);
        this.setupSlider('painterliness', (val) => this.filters.wakingLife.painterliness = val / 10);
        this.setupSlider('saturation', (val) => {
            this.filters.wakingLife.saturationBoost = val / 10;
            const display = document.getElementById('saturationValue');
            if (display) display.textContent = (val / 10).toFixed(1) + 'x';
        }, null, true);

        // Archer controls
        this.setupSlider('archerEdge', (val) => this.filters.archer.edgeThickness = parseInt(val));
        this.setupSlider('archerColors', (val) => this.filters.archer.colorLevels = parseInt(val));
        this.setupSlider('archerShadow', (val) => this.filters.archer.shadowIntensity = parseInt(val));
        this.setupSlider('archerHighlight', (val) => this.filters.archer.highlightBoost = parseInt(val));
        this.setupSlider('archerSaturation', (val) => this.filters.archer.saturationBoost = parseInt(val));

        // Window resize
        window.addEventListener('resize', () => this.resize());

        // Click outside panel to close
        document.addEventListener('click', (e) => {
            const panel = document.getElementById('settingsPanel');
            const toggle = document.getElementById('settingsToggle');
            if (this.settingsPanelOpen &&
                !panel.contains(e.target) &&
                !toggle.contains(e.target)) {
                this.toggleSettings(false);
            }
        });
    }

    setupSlider(id, callback, suffix = '', skipDisplay = false) {
        const slider = document.getElementById(id);
        if (!slider) return;

        const valueDisplay = document.getElementById(id + 'Value');

        slider.addEventListener('input', (e) => {
            const val = e.target.value;
            if (valueDisplay && !skipDisplay) {
                valueDisplay.textContent = val + (suffix || '');
            }
            callback(val);
        });
    }

    setMode(mode) {
        this.mode = mode;

        // Update body data attribute for CSS
        document.body.setAttribute('data-mode', mode);

        // Update filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.filter === mode);
        });

        // Update control sections
        document.querySelectorAll('.control-section').forEach(section => {
            section.classList.remove('active');
        });
        document.getElementById(mode + 'Controls').classList.add('active');

        // Update panel title
        const titles = {
            matrix: 'Matrix',
            wakingLife: 'Waking Life',
            archer: 'Archer'
        };
        document.getElementById('panelTitleText').textContent = titles[mode] + ' Settings';

        // Update panel dot color
        const colors = {
            matrix: '#00ff41',
            wakingLife: '#a855f7',
            archer: '#dc2626'
        };
        document.getElementById('panelDot').style.background = colors[mode];

        // Clear canvas when switching
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    toggleSettings(forceState) {
        const panel = document.getElementById('settingsPanel');
        const toggle = document.getElementById('settingsToggle');

        if (typeof forceState === 'boolean') {
            this.settingsPanelOpen = forceState;
        } else {
            this.settingsPanelOpen = !this.settingsPanelOpen;
        }

        panel.classList.toggle('visible', this.settingsPanelOpen);
        toggle.classList.toggle('visible', !this.settingsPanelOpen);
    }

    async start() {
        // Hide start screen, show UI
        document.getElementById('startScreen').classList.add('hidden');
        document.getElementById('filterBar').classList.add('visible');
        document.getElementById('settingsToggle').classList.add('visible');
        document.getElementById('fullscreenBtn').classList.add('visible');

        await this.initCamera();
        this.resize();
        this.isRunning = true;
        this.setMode('matrix');
        this.animate();
    }

    async initCamera() {
        try {
            // Request camera permission first
            await navigator.mediaDevices.getUserMedia({ video: true });

            // Then enumerate devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');

            const select = document.getElementById('cameraSelect');
            select.innerHTML = '';

            videoDevices.forEach((device, index) => {
                const option = document.createElement('option');
                option.value = device.deviceId;
                option.textContent = device.label || `Camera ${index + 1}`;
                select.appendChild(option);
            });

            if (videoDevices.length > 0) {
                await this.switchCamera(videoDevices[0].deviceId);
            }
        } catch (err) {
            console.error('Camera access error:', err);
            alert('Could not access camera. Please ensure camera permissions are granted.');
        }
    }

    async switchCamera(deviceId) {
        try {
            if (this.video.srcObject) {
                this.video.srcObject.getTracks().forEach(track => track.stop());
            }

            const constraints = {
                video: {
                    deviceId: deviceId ? { exact: deviceId } : undefined,
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                }
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = stream;

            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => resolve();
            });

            // Initialize matrix filter video dimensions
            this.filters.matrix.videoWidth = this.video.videoWidth;
            this.filters.matrix.videoHeight = this.video.videoHeight;
            this.filters.matrix.videoCanvas.width = this.video.videoWidth;
            this.filters.matrix.videoCanvas.height = this.video.videoHeight;
            this.filters.matrix.initGrid();

        } catch (err) {
            console.error('Camera switch error:', err);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;

        // Update matrix filter
        this.filters.matrix.canvas = this.canvas;
        this.filters.matrix.ctx = this.ctx;
        this.filters.matrix.initGrid();

        // Update other filters
        this.filters.wakingLife.canvas = this.canvas;
        this.filters.wakingLife.ctx = this.ctx;

        this.filters.archer.canvas = this.canvas;
        this.filters.archer.ctx = this.ctx;
    }

    animate() {
        if (!this.isRunning) return;

        // Draw current filter
        this.filters[this.mode].draw();

        requestAnimationFrame(() => this.animate());
    }
}

// Matrix Filter Class
class MatrixFilter {
    constructor(canvas, video) {
        this.matrixChars = [
            'ｦ', 'ｧ', 'ｨ', 'ｩ', 'ｪ', 'ｫ', 'ｬ', 'ｭ', 'ｮ', 'ｯ',
            'ｰ', 'ｱ', 'ｲ', 'ｳ', 'ｴ', 'ｵ', 'ｶ', 'ｷ', 'ｸ', 'ｹ',
            'ｺ', 'ｻ', 'ｼ', 'ｽ', 'ｾ', 'ｿ', 'ﾀ', 'ﾁ', 'ﾂ', 'ﾃ',
            'ﾄ', 'ﾅ', 'ﾆ', 'ﾇ', 'ﾈ', 'ﾉ', 'ﾊ', 'ﾋ', 'ﾌ', 'ﾍ',
            'ﾎ', 'ﾏ', 'ﾐ', 'ﾑ', 'ﾒ', 'ﾓ', 'ﾔ', 'ﾕ', 'ﾖ', 'ﾗ',
            'ﾘ', 'ﾙ', 'ﾚ', 'ﾛ', 'ﾜ', 'ﾝ'
        ];

        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.video = video;

        this.videoCanvas = document.createElement('canvas');
        this.videoCtx = this.videoCanvas.getContext('2d');

        this.grid = [];
        this.gridWidth = 0;
        this.gridHeight = 0;

        this.charSize = 12;
        this.fallSpeed = 5;
        this.brightnessSensitivity = 6;
        this.explosionRate = 3;
        this.contrast = 7;

        this.explosions = [];
        this.videoWidth = 0;
        this.videoHeight = 0;
        this.brightnessData = null;
        this.streams = [];
    }

    initGrid() {
        if (!this.canvas.width) return;

        this.gridWidth = Math.ceil(this.canvas.width / this.charSize);
        this.gridHeight = Math.ceil(this.canvas.height / this.charSize);

        this.grid = [];
        for (let x = 0; x < this.gridWidth; x++) {
            this.grid[x] = [];
            for (let y = 0; y < this.gridHeight; y++) {
                this.grid[x][y] = {
                    char: this.getRandomChar(),
                    brightness: 0,
                    targetBrightness: 0,
                    changeTimer: Math.random() * 100
                };
            }
        }

        this.streams = [];
        for (let x = 0; x < this.gridWidth; x++) {
            this.streams.push({
                x: x,
                y: Math.random() * this.gridHeight,
                speed: 0.3 + Math.random() * 0.4,
                length: 5 + Math.floor(Math.random() * 15)
            });
        }
    }

    getRandomChar() {
        return this.matrixChars[Math.floor(Math.random() * this.matrixChars.length)];
    }

    processVideoFrame() {
        if (!this.video.videoWidth || !this.videoCanvas.width) return;

        this.videoCtx.save();
        this.videoCtx.scale(-1, 1);
        this.videoCtx.drawImage(this.video, -this.videoWidth, 0, this.videoWidth, this.videoHeight);
        this.videoCtx.restore();

        const imageData = this.videoCtx.getImageData(0, 0, this.videoWidth, this.videoHeight);
        this.brightnessData = imageData.data;
    }

    getBrightnessAt(gridX, gridY) {
        if (!this.brightnessData) return 0;

        const vx = Math.floor((gridX / this.gridWidth) * this.videoWidth);
        const vy = Math.floor((gridY / this.gridHeight) * this.videoHeight);

        let total = 0;
        let samples = 0;
        const sampleRadius = 2;

        for (let dx = -sampleRadius; dx <= sampleRadius; dx++) {
            for (let dy = -sampleRadius; dy <= sampleRadius; dy++) {
                const px = Math.max(0, Math.min(this.videoWidth - 1, vx + dx));
                const py = Math.max(0, Math.min(this.videoHeight - 1, vy + dy));
                const idx = (py * this.videoWidth + px) * 4;

                const r = this.brightnessData[idx];
                const g = this.brightnessData[idx + 1];
                const b = this.brightnessData[idx + 2];
                total += (r * 0.299 + g * 0.587 + b * 0.114) / 255;
                samples++;
            }
        }

        let brightness = total / samples;

        const contrastFactor = this.contrast / 5;
        brightness = (brightness - 0.5) * contrastFactor + 0.5;
        brightness = Math.max(0, Math.min(1, brightness));
        brightness = Math.pow(brightness, 2 - (this.brightnessSensitivity / 5));

        return brightness;
    }

    updateGrid() {
        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                const cell = this.grid[x][y];
                cell.targetBrightness = this.getBrightnessAt(x, y);
                cell.brightness += (cell.targetBrightness - cell.brightness) * 0.3;

                cell.changeTimer -= 1 + cell.brightness * 2;
                if (cell.changeTimer <= 0) {
                    cell.char = this.getRandomChar();
                    cell.changeTimer = 20 + Math.random() * 80;
                }
            }
        }
    }

    updateStreams() {
        for (const stream of this.streams) {
            let avgBrightness = 0;
            for (let y = 0; y < this.gridHeight; y++) {
                avgBrightness += this.grid[stream.x][y].brightness;
            }
            avgBrightness /= this.gridHeight;

            const speedMod = 0.5 + avgBrightness * 1.5;
            stream.y += stream.speed * (this.fallSpeed / 5) * speedMod;

            if (stream.y - stream.length > this.gridHeight) {
                stream.y = -stream.length;
                stream.speed = 0.3 + Math.random() * 0.4;
                stream.length = 5 + Math.floor(Math.random() * 15);
            }
        }
    }

    checkForExplosions() {
        if (this.explosionRate === 0) return;

        for (let x = 0; x < this.gridWidth; x += 8) {
            for (let y = 0; y < this.gridHeight; y += 8) {
                const brightness = this.grid[x][y].brightness;

                if (brightness > 0.85 && Math.random() < (this.explosionRate / 3000) * brightness) {
                    this.createExplosion(
                        x * this.charSize + this.charSize / 2,
                        y * this.charSize + this.charSize / 2,
                        brightness
                    );
                }
            }
        }
    }

    createExplosion(x, y, intensity) {
        const sizeMultiplier = 0.15 + Math.random() * 0.1;
        const spreadX = this.canvas.width * sizeMultiplier;
        const spreadY = this.canvas.height * sizeMultiplier;
        const particleCount = 15 + Math.floor(intensity * 30);

        for (let i = 0; i < particleCount; i++) {
            const isStationary = Math.random() < 0.4;
            const vx = isStationary ? 0 : (Math.random() - 0.5) * 0.3;
            const vy = isStationary ? 0 : (Math.random() - 0.5) * 0.3;
            const offsetX = (Math.random() - 0.5) * spreadX;
            const offsetY = (Math.random() - 0.5) * spreadY;

            this.explosions.push({
                x: x + offsetX,
                y: y + offsetY,
                vx: vx,
                vy: vy,
                life: 1,
                decay: 0.006 + Math.random() * 0.01,
                char: this.getRandomChar(),
                isWhite: Math.random() < 0.5,
                hasGravity: Math.random() < 0.3
            });
        }
    }

    updateExplosions() {
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            const p = this.explosions[i];

            p.x += p.vx;
            p.y += p.vy;

            if (p.hasGravity) {
                p.vy += 0.02;
            }

            p.life -= p.decay;

            if (Math.random() < 0.05) {
                p.char = this.getRandomChar();
            }

            if (p.life <= 0) {
                this.explosions.splice(i, 1);
            }
        }

        if (this.explosions.length > 500) {
            this.explosions.splice(0, this.explosions.length - 500);
        }
    }

    draw() {
        this.processVideoFrame();
        this.updateGrid();
        this.updateStreams();
        this.checkForExplosions();
        this.updateExplosions();

        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.font = `${this.charSize}px "MS Gothic", "Hiragino Kaku Gothic Pro", monospace`;
        this.ctx.textBaseline = 'top';

        for (let x = 0; x < this.gridWidth; x++) {
            for (let y = 0; y < this.gridHeight; y++) {
                const cell = this.grid[x][y];
                const brightness = cell.brightness;

                if (brightness < 0.05) continue;

                let isLeading = false;
                for (const stream of this.streams) {
                    if (stream.x === x) {
                        const distFromHead = stream.y - y;
                        if (distFromHead >= 0 && distFromHead < 1) {
                            isLeading = true;
                            break;
                        }
                    }
                }

                let r, g, b, alpha;

                if (isLeading && brightness > 0.3) {
                    r = 180 + brightness * 75;
                    g = 255;
                    b = 180 + brightness * 75;
                    alpha = 0.9 + brightness * 0.1;
                    this.ctx.shadowColor = `rgba(200, 255, 200, 0.8)`;
                    this.ctx.shadowBlur = 12;
                } else {
                    r = 0;
                    g = Math.floor(80 + brightness * 175);
                    b = 0;
                    alpha = 0.3 + brightness * 0.7;
                    this.ctx.shadowColor = `rgba(0, ${g}, 0, 0.5)`;
                    this.ctx.shadowBlur = brightness > 0.5 ? 8 : 3;
                }

                this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;

                const drawX = x * this.charSize;
                const drawY = y * this.charSize;

                this.ctx.save();
                this.ctx.translate(drawX + this.charSize / 2, drawY);
                this.ctx.scale(-1, 1);
                this.ctx.fillText(cell.char, -this.charSize / 2, 0);
                this.ctx.restore();
            }
        }

        this.ctx.shadowBlur = 0;
        this.drawExplosions();
    }

    drawExplosions() {
        for (const p of this.explosions) {
            const alpha = p.life;

            if (p.isWhite) {
                this.ctx.fillStyle = `rgba(200, 255, 200, ${alpha})`;
                this.ctx.shadowColor = 'rgba(200, 255, 200, 0.8)';
                this.ctx.shadowBlur = 6;
            } else {
                this.ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
                this.ctx.shadowColor = 'rgba(0, 255, 0, 0.6)';
                this.ctx.shadowBlur = 4;
            }

            this.ctx.font = `${this.charSize}px "MS Gothic", monospace`;

            this.ctx.save();
            this.ctx.translate(p.x, p.y);
            this.ctx.scale(-1, 1);
            this.ctx.fillText(p.char, 0, 0);
            this.ctx.restore();
        }

        this.ctx.shadowBlur = 0;
    }
}

// Initialize app when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
