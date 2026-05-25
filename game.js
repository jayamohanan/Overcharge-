// Overcharge! — main game scene
// No physics engine — pure drag/drop battery merge + gadget charging

class GameScene extends Phaser.Scene {
    constructor() { super('GameScene'); }

    // ================================================================
    // INIT
    // ================================================================
    init() {
        this.platforms          = [];
        this.gadgetsData        = null;
        this.currentGadgetIndex = 0;

        this.coins              = 1000;
        this.grid               = Array(3).fill(null).map(() => Array(3).fill(null));
        this.gridCells          = [];
        this.batteries          = [];
        this.draggingBattery    = null;
        this.hasStartedPlaying  = false;
        this.spawnButtonLevel   = CONFIG.BATTERY_START_LEVEL;
        this.spawnCost          = 10;
        this.highestBatteryLevel = CONFIG.BATTERY_START_LEVEL;
        this.levelUpTimer       = null;
        this.levelUpButtonVisible    = false;
        this.levelUpButtonShowTime   = null;
        this.firstLevelUpTimer  = true;
        this.mergeTutorialShown = false;
        this.mergePointer       = null;
        this.unlockDisplayContainer  = null;
        this.unlockDisplayText       = null;
        this.unlockDisplayBatteryIcon= null;
        this.highestUnlockedBatteryLevel = 0;
        this.gadgetAnimationsComplete = false;
        this.isWatchingAd = false;  // Flag to block interactions during ad

        this.CELL_SIZE  = CONFIG.CELL.SIZE;
        this.CELL_GAP   = CONFIG.CELL.GAP;
        this.CELL_RADIUS= CONFIG.CELL.RADIUS;
        this.GRID_COLS  = 3;
        this.GRID_ROWS  = 3;

        this.chargingSlots    = [null, null, null];
        this.chargingInterval = null;

        // Layout state for responsive design
        this.isPortrait         = true;  // Detected in create()
        this.layoutConfig       = {};    // Will store calculated layout values
        this.platformsContainer = null;
        this.gridContainer      = null;
        this.uiContainer        = null;
    }

    // ================================================================
    // LAYOUT HELPERS
    // ================================================================
    calculateLayout() {
        // Use window dimensions for orientation detection (not fixed canvas size)
        const W = window.innerWidth;
        const H = window.innerHeight;
        this.isPortrait = H > W;  // Portrait if height > width

        const config = {
            screenWidth: W,
            screenHeight: H,
            isPortrait: this.isPortrait,
        };

        if (this.isPortrait) {
            // Portrait: Top half (platforms) + Bottom half (grid + buttons)
            config.platformsTop = 0;
            config.platformsHeight = H * 0.45;
            
            config.gridBottom = H;
            config.gridHeight = H * 0.55;
            config.gridTop = config.gridBottom - config.gridHeight;
            
            config.platformsCenterX = W / 2;
            config.gridCenterX = W / 2;
        } else {
            // Landscape: Left half (grid + buttons) + Right half (platforms)
            config.gridLeft = 0;
            config.gridWidth = W * 0.5;
            config.gridCenterX = config.gridWidth / 2;
            
            config.platformsLeft = config.gridWidth;
            config.platformsWidth = W * 0.5;
            config.platformsCenterX = config.platformsLeft + config.platformsWidth / 2;
            
            config.platformsTop = 0;
            config.platformsHeight = H;
            config.gridTop = 0;
            config.gridHeight = H;
        }

        this.layoutConfig = config;
    }

    // ================================================================
    // PRELOAD
    // ================================================================
    preload() {
        loadBatteryImagesFromCache(this);
        this.load.image('coin',          'graphics/coin.png');
        this.load.image('point',         'graphics/point.png');
        this.load.image('button',        'graphics/spawn_button3.png');
        this.load.image('grid_panel',    'graphics/grid_panel.png');
        this.load.image('battery_crown', 'graphics/battery_crown.png');
        this.load.image('bolt',          'graphics/bolt_64.png');
        this.load.image('gadget_socket',   'graphics/connection/socket.png');
        this.load.image('gadget_plug_in',  'graphics/connection/plug_in.png');
        this.load.image('gadget_plug_out', 'graphics/connection/plug_out.png');
        
        // Load explosion sprite frames
        for (let i = 1; i <= 8; i++) {
            this.load.image(`explosion_${String(i).padStart(2, '0')}`, `graphics/explosion/explosion_${String(i).padStart(2, '0')}.png`);
        }
        
        // Load gadget sprites from gadgetData.js
        if (typeof GADGET_SPRITES !== 'undefined' && GADGET_SPRITES) {
            GADGET_SPRITES.forEach(g => {
                this.load.image(`gadget_${g.name}_normal`, `graphics/gadgets/${g.normal_sprite}`);
                this.load.image(`gadget_${g.name}_burnedout`, `graphics/gadgets/${g.burnedout_sprite}`);
            });
        }
    }

    // ================================================================
    // CREATE
    // ================================================================
    create() {
        const W = window.innerWidth || this.cameras.main.width;
        const H = window.innerHeight || this.cameras.main.height;

        // Calculate layout based on orientation
        this.calculateLayout();

        // Background
        const bgGfx = this.add.graphics();
        const sc = parseInt(CONFIG.BACKGROUND.GRADIENT_START_COLOR.substring(1), 16);
        const ec = parseInt(CONFIG.BACKGROUND.GRADIENT_END_COLOR.substring(1), 16);
        bgGfx.fillGradientStyle(sc, sc, ec, ec, 1);
        bgGfx.fillRect(0, 0, W, H);
        bgGfx.setDepth(0);

        // Create explosion animation
        this.anims.create({
            key: 'explode',
            frames: [
                { key: 'explosion_01' },
                { key: 'explosion_02' },
                { key: 'explosion_03' },
                { key: 'explosion_04' },
                { key: 'explosion_05' },
                { key: 'explosion_06' },
                { key: 'explosion_07' },
                { key: 'explosion_08' }
            ],
            frameRate: 20,
            repeat: 0
        });

        // Load gadget data from gadgetData.js
        if (typeof GADGET_SPRITES !== 'undefined' && GADGET_SPRITES) {
            this.gadgetsData = GADGET_SPRITES.map((sprite, index) => {
                const level = index + 1;
                const capacity = getGadgetCapacity(level) || [200, 250, 300];
                return {
                    ...sprite,
                    capacity: capacity
                };
            });
        } else {
            this.gadgetsData = [];
        }

        // Top half — platforms
        this.createPlatforms();
        if (this.gadgetsData.length > 0) {
            this.loadGadgets(this.gadgetsData[0]);
        }

        // Bottom half — merge grid
        this.createGrid();
        this.createCoinDisplay();
        this.createBatteryUnlockDisplay();
        this.spawnBatteryInGrid(0, 0, CONFIG.BATTERY_START_LEVEL);
        this.createButtons();
        this.createStartOverlay();

        // Input
        this.input.on('dragstart', this.onDragStart, this);
        this.input.on('drag',      this.onDrag,      this);
        this.input.on('dragend',   this.onDragEnd,   this);

        this.startCharging();
    }

    // ================================================================
    // PLATFORM SYSTEM (TOP HALF)
    // ================================================================
    createPlatforms() {
        const P = CONFIG.PLATFORM;
        const L = this.layoutConfig;
        
        // Calculate responsive Y positions based on available platform height
        const platformHeight = L.isPortrait ? L.platformsHeight : L.platformsHeight;
        const baseY = L.isPortrait ? L.platformsTop + platformHeight * 0.15 : L.platformsTop + platformHeight * 0.15;
        const spacingY = platformHeight / 3.5;  // Distribute 3 platforms across available height
        
        const responsiveYPositions = [
            baseY,
            baseY + spacingY,
            baseY + spacingY * 2
        ];

        for (let i = 0; i < 3; i++) {
            const cy  = responsiveYPositions[i];  // Use responsive Y instead of P.Y_POSITIONS[i]
            const ssz = P.SLOT_SIZE;
            
            // Center horizontally based on layout
            const centerX = L.platformsCenterX;
            
            // Center the stripe at centerX
            const stripeLeftEdge = centerX - P.STRIPE_WIDTH / 2;
            
            // Calculate slot position from centered stripe's left edge
            const slotX = stripeLeftEdge + P.SLOT_PADDING_FROM_LEFT + ssz / 2;
            const slotY = cy - P.STRIPE_HEIGHT / 2 - P.SLOT_ABOVE_STRIPE - ssz / 2;
            
            // Calculate debug rect position from slot right edge
            const debugRectX = slotX + ssz / 2 + P.DEBUG_RECT_PADDING_FROM_SLOT + P.DEBUG_RECT_WIDTH / 2;
            const debugRectY = cy - P.STRIPE_HEIGHT / 2 - P.DEBUG_RECT_PADDING_FROM_STRIPE - P.DEBUG_RECT_HEIGHT / 2;

            // Stripe — plain background bar, nothing drawn on it
            const stripe = this.add.graphics();
            stripe.fillStyle(hexColor(P.STRIPE_COLOR), P.STRIPE_ALPHA);
            stripe.fillRoundedRect(stripeLeftEdge, cy - P.STRIPE_HEIGHT / 2, P.STRIPE_WIDTH, P.STRIPE_HEIGHT, 6);
            stripe.setDepth(2);

            // Slot backgrounds
            const slotBg = this.add.graphics();
            this._drawSlot(slotBg, slotX, slotY, ssz, false);
            slotBg.setDepth(3);

            const slotBgFilled = this.add.graphics();
            this._drawSlot(slotBgFilled, slotX, slotY, ssz, true);
            slotBgFilled.setDepth(3);
            slotBgFilled.setVisible(false);

            // Charge-rate label above slot (shown when a battery is present)
            const rateTextY = slotY - ssz / 2 - P.CHARGE_RATE_GAP;
            const chargeRateText = this.add.text(slotX - 2, rateTextY, '', {
                fontSize: '22px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#000000', fontStyle: 'bold',
                stroke: '#FFFFFF', strokeThickness: 3,
            }).setOrigin(1, 0.5).setDepth(5).setVisible(false);

            const chargeRateBolt = this.add.image(slotX + 2, rateTextY, 'bolt')
                .setDisplaySize(P.CHARGE_RATE_BOLT_SIZE, P.CHARGE_RATE_BOLT_SIZE)
                .setOrigin(0, 0.5).setDepth(5).setVisible(false)
                .setTint(0xFFFF00);

            this.platforms.push({
                index: i,
                centerY: cy,
                centerX: centerX,  // Store centerX for responsive repositioning
                stripe,
                slotX: slotX, slotY: slotY, slotSize: ssz,
                slotBg, slotBgFilled,
                chargeRateText, chargeRateBolt,
                batterySprite: null, batteryLevelText: null,
                debugRectX: debugRectX, debugRectY: debugRectY,
                gadgetSprite: null,
                gadgetCapacity: 0, gadgetCurrentCharge: 0,
                gadgetCapacityText: null, gadgetChargeText: null,
                isDefeated: false,
                smokePuffs: [],        // Track smoke particle objects
                explosionEffects: [],  // Track explosion ring objects
                coinAnimationComplete: true,  // Track if coin animation finished
                chargingAnimationsActive: [],  // Track active charging animations
                reachedZeroCapacity: false,  // Track if gadget reached 0 capacity (stop charging)
            });
        }
    }

    _drawSlot(gfx, x, y, size, filled) {
        const shadow = hexColor(CONFIG.CELL.INSET_SHADOW_COLOR);
        const fill   = filled ? hexColor(CONFIG.CELL.FILLED_BG_COLOR) : hexColor(CONFIG.CELL.EMPTY_BG_COLOR);
        const inset  = CONFIG.CELL.INSET_BORDER_WIDTH;
        const r      = CONFIG.PLATFORM.SLOT_RADIUS;
        gfx.clear();
        gfx.fillStyle(shadow, 1);
        gfx.fillRoundedRect(x - size / 2, y - size / 2, size, size, r);
        gfx.fillStyle(fill, 1);
        gfx.fillRoundedRect(x - size / 2 + inset, y - size / 2 + inset,
            size - inset * 2, size - inset * 2, Math.max(1, r - inset));
    }

    // ── Analog meter face (static background drawn once per gadget load) ──────
    _drawMeterBg(gfx, px, py) {
        const P     = CONFIG.PLATFORM;
        const r     = P.METER_RADIUS;
        // meter angle m (0-180) → canvas arc angle in radians
        const arcOf = (m) => Math.PI + (m / 180) * Math.PI;
        const zr    = r - 4;
        const greenEnd = 100;

        // Single dark arc across full sweep
        gfx.lineStyle(6, 0x0d1f2d, 1.0);
        gfx.beginPath();
        gfx.arc(px, py, zr, arcOf(0), arcOf(180), false);
        gfx.strokePath();

        // Radial tick marks: short stripes stradding the arc, watch-style
        const drawTick = (m, color, w) => {
            const a   = arcOf(m);
            const cos = Math.cos(a);
            const sin = Math.sin(a);
            gfx.lineStyle(w, color, 1.0);
            gfx.beginPath();
            gfx.moveTo(px + (zr - 7) * cos, py + (zr - 7) * sin);
            gfx.lineTo(px + (zr + 5) * cos, py + (zr + 5) * sin);
            gfx.strokePath();
        };

        drawTick(greenEnd,             0xFFD600, 3);  // yellow warning mark
        drawTick(P.METER_RED_ZONE_ANGLE, 0xFF1744, 3);  // red danger mark
    }

    // ── Animate needle with analog overshoot/undershoot swing ────────────────
    _animateMeterNeedle(p, meterTargetAngle) {
        if (!p.meterNeedle) return;
        const P        = CONFIG.PLATFORM;
        const overshoot = P.METER_OSCILLATION_OVERSHOOT;
        const needle   = p.meterNeedle;
        this.tweens.killTweensOf(needle);

        // meterAngle (0-180) → Phaser setAngle degrees
        // needle origin is (0.5, 1) pointing UP at angle 0
        // so: 0 → -90 (left), 90 → 0 (up), 180 → +90 (right)
        const ph = (m) => m - 90;

        const tA     = ph(meterTargetAngle);
        const overA  = ph(Math.min(meterTargetAngle + overshoot,       180));
        const underA = ph(Math.max(meterTargetAngle - overshoot * 0.45,  0));

        this.tweens.add({
            targets: needle, angle: overA, duration: 175, ease: 'Quad.easeOut',
            onComplete: () => this.tweens.add({
                targets: needle, angle: underA, duration: 130, ease: 'Quad.easeOut',
                onComplete: () => this.tweens.add({
                    targets: needle, angle: tA, duration: 85, ease: 'Sine.easeOut',
                })
            })
        });

        // Needle colour tracks zone
        const inRed    = meterTargetAngle >= P.METER_RED_ZONE_ANGLE;
        const inYellow = !inRed && meterTargetAngle >= 100;
        needle.setFillStyle(inRed ? 0xFF3333 : inYellow ? 0xFFD600 : 0xF0F0F0);
    }

    // ── Color lerp helper ────────────────────────────────────────────────────
    _lerpColor(c1, c2, t) {
        const r1 = (c1 >> 16) & 0xFF, g1 = (c1 >> 8) & 0xFF, b1 = c1 & 0xFF;
        const r2 = (c2 >> 16) & 0xFF, g2 = (c2 >> 8) & 0xFF, b2 = c2 & 0xFF;
        return (Math.round(r1 + (r2 - r1) * t) << 16) |
               (Math.round(g1 + (g2 - g1) * t) << 8)  |
                Math.round(b1 + (b2 - b1) * t);
    }

    // ── Draw charge fill bar on the platform stripe ──────────────────────────
    _drawChargeFill(p, progress) {
        if (!p.chargeFill) return;
        const P         = CONFIG.PLATFORM;
        const yellowT   = 100 / P.METER_EXPLOSION_ANGLE;
        const redT      = P.METER_RED_ZONE_ANGLE / P.METER_EXPLOSION_ANGLE;
        let fillColor;
        if (progress < yellowT) {
            fillColor = 0x00C853;
        } else if (progress < redT) {
            fillColor = this._lerpColor(0xFFD600, 0xFF6B00, (progress - yellowT) / (redT - yellowT));
        } else {
            fillColor = this._lerpColor(0xFF6B00, 0xFF1744, Math.min((progress - redT) / (1 - redT), 1));
        }
        const fillW = P.STRIPE_WIDTH * progress;
        p.chargeFill.clear();
        p.chargeFill.fillStyle(fillColor, 0.55);
        p.chargeFill.fillRoundedRect(P.STRIPE_X, p.centerY - P.STRIPE_HEIGHT / 2, fillW, P.STRIPE_HEIGHT, 6);
    }

    // ── Tension effects: shake / tint / pulse / camera shake ─────────────────
    _applyTensionEffects(p) {
        if (!p.gadgetSprite || p.isDefeated) return;
        const P            = CONFIG.PLATFORM;
        const progress     = p.gadgetCapacity > 0 ? p.gadgetCurrentCharge / p.gadgetCapacity : 0;
        const yellowThresh = 100 / P.METER_EXPLOSION_ANGLE;

        if (progress < yellowThresh) {
            // Normal range — clear any leftover tint, soft pulse on each charge tick
            p.gadgetSprite.setTint(0xffffff);
            if (P.GADGET_FLASH_ON_CHARGE_ENABLED) {
                this.tweens.add({ targets: p.gadgetSprite, alpha: 0.35, duration: 80, yoyo: true });
            }
            return;
        }

        // Smooth tension progression from yellowThresh to 100%
        const tensionProgress = (progress - yellowThresh) / (1 - yellowThresh);

         if(P.GADGET_TENSION_COLOR_CHANGE_ENABLED){
        // ── Tint: smooth interpolation from white → subtle yellow → light orange ───
        // Start: 0xFFFFFF (white), Mid: 0xFFDD99 (subtle warm), End: 0xFFBB77 (light orange)
        const startR = 0xFF, startG = 0xFF, startB = 0xFF;
        const endR   = 0xFF, endG   = 0xBB, endB   = 0x77;
        
        const r = Math.round(startR + (endR - startR) * tensionProgress);
        const g = Math.round(startG + (endG - startG) * tensionProgress);
        const b = Math.round(startB + (endB - startB) * tensionProgress);
        p.gadgetSprite.setTint((r << 16) | (g << 8) | b);
        }

        // ── Flash (subtle, increases with tension) ──────────────────────────────
        if (P.GADGET_FLASH_ON_CHARGE_ENABLED) {
            const flashAlpha = 0.4 - tensionProgress * 0.25; // 0.4 → 0.15
            const flashDur   = 80 - Math.round(tensionProgress * 35); // 80ms → 45ms
            this.tweens.add({ targets: p.gadgetSprite, alpha: flashAlpha, duration: flashDur, yoyo: true });
        }

        // ── Shake (increases gradually, maximum at end) ─────────────────────────
        if (!p._shakeActive) {
            p._shakeActive = true;
            // Shake intensity: 0.75 at start → 5 at end (reduced by half)
            const shakeAmt = 0.75 + tensionProgress * 4.25;
            // Shake speed: slower at start, faster at end
            const shakeDur = Math.round(75 - tensionProgress * 40); // 75ms → 35ms
            const numSteps = 4 + Math.round(tensionProgress * 4); // 4 → 8 steps
            const ox = p._gadgetOriginX;
            const oy = p._gadgetOriginY;

            const doShake = (n) => {
                if (!p.gadgetSprite || p.isDefeated) { p._shakeActive = false; return; }
                if (n <= 0) {
                    this.tweens.add({
                        targets: p.gadgetSprite, x: ox, y: oy,
                        duration: shakeDur, ease: 'Sine.easeOut',
                        onComplete: () => { p._shakeActive = false; },
                    });
                    return;
                }
                const dx = (Math.random() - 0.5) * shakeAmt * 2;
                const dy = (Math.random() - 0.5) * shakeAmt;
                this.tweens.add({
                    targets: p.gadgetSprite, x: ox + dx, y: oy + dy,
                    duration: shakeDur, ease: 'Sine.easeInOut',
                    onComplete: () => doShake(n - 1),
                });
            };
            doShake(numSteps);
        }

        // ── Scale bulge in red zone ───────────────────────────────────────────
        // Removed: scaling animation not needed since we now have burnedout sprite
        // if (inRed && !p._pulseActive) {
        //     p._pulseActive = true;
        //     const sz    = P.GADGET_SIZE;
        //     const bulge = sz * (1.05 + 0.04 * redIntensity);
        //     this.tweens.add({
        //         targets: p.gadgetSprite, displayWidth: bulge, displayHeight: bulge,
        //         duration: 110, ease: 'Quad.easeOut', yoyo: true,
        //         onComplete: () => {
        //             p._pulseActive = false;
        //             if (p.gadgetSprite && !p.isDefeated) p.gadgetSprite.setDisplaySize(sz, sz);
        //         },
        //     });
        // }

        // ── Camera shake removed - only happens at final explosion ──────────────

        // ── Smoke (ramps up with progress toward explosion) ─────────────────
        if (progress >= CONFIG.PLATFORM.SMOKE_START_PROGRESS) {
            this._updateSmokeIntensity(p, progress);
        }
    }

    // ── Smoke helpers ────────────────────────────────────────────────────────
    // ── Wire drawing ──────────────────────────────────────────────────────────
    _drawWire(gfx, x1, y1, x2, y2) {
        const P   = CONFIG.PLATFORM;
        const d   = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;

        // Rigid vertical drop from plug bottom before the sag begins
        const rigidLen = P.WIRE_RIGID_LENGTH;
        const rx = x1;               // rigid segment ends directly below plug
        const ry = y1 + rigidLen;

        // Sag curve from end-of-rigid to gadget connection point
        const excess   = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        const N  = 28;

        gfx.clear();
        gfx.lineStyle(P.WIRE_THICKNESS, P.WIRE_COLOR, 1);

        // Rigid segment
        gfx.beginPath();
        gfx.moveTo(x1, y1);
        gfx.lineTo(rx, ry);
        gfx.strokePath();

        // Sag curve
        gfx.beginPath();
        gfx.moveTo(rx, ry);
        for (let i = 1; i <= N; i++) {
            const t  = i / N;
            const mt = 1 - t;
            gfx.lineTo(
                mt * mt * rx + 2 * mt * t * cx + t * t * x2,
                mt * mt * ry + 2 * mt * t * cy + t * t * y2,
            );
        }
        gfx.strokePath();
    }

    _startSmoke(p) {
        if (p.smokeTimer) return;
        const P = CONFIG.PLATFORM;
        p._smokeDelay = P.SMOKE_FREQUENCY_START_MS;
        p.smokeTimer = this.time.addEvent({
            delay: P.SMOKE_FREQUENCY_START_MS,
            callback: () => this._spawnSmokePuff(p),
            loop: true,
        });
    }

    // Ramp smoke frequency up as charge approaches explosion
    _updateSmokeIntensity(p, progress) {
        const P = CONFIG.PLATFORM;
        if (!p.smokeTimer) {
            this._startSmoke(p);
            return;
        }
        const smokeT   = Math.max(0,
            (progress - P.SMOKE_START_PROGRESS) / (1 - P.SMOKE_START_PROGRESS));
        const newDelay = Math.round(
            P.SMOKE_FREQUENCY_START_MS +
            (P.SMOKE_FREQUENCY_MAX_MS - P.SMOKE_FREQUENCY_START_MS) * smokeT
        );
        if (Math.abs((p._smokeDelay ?? P.SMOKE_FREQUENCY_START_MS) - newDelay) > 20) {
            this._stopSmoke(p);
            p._smokeDelay = newDelay;
            p.smokeTimer  = this.time.addEvent({
                delay: newDelay, callback: () => this._spawnSmokePuff(p), loop: true,
            });
        }
    }

    // Max-rate burst for SMOKE_MAX_AFTER_EXPLOSION_MS, then settle to idle rate
    _setSmokeBurst(p) {
        const P = CONFIG.PLATFORM;
        this._stopSmoke(p);
        p._smokeDelay = P.SMOKE_FREQUENCY_MAX_MS;
        p.smokeTimer  = this.time.addEvent({
            delay: P.SMOKE_FREQUENCY_MAX_MS, callback: () => this._spawnSmokePuff(p), loop: true,
        });
        this.time.delayedCall(P.SMOKE_MAX_AFTER_EXPLOSION_MS, () => {
            if (!p.smokeTimer) return;  // clearGadgets already ran
            this._stopSmoke(p);
            p._smokeDelay = P.SMOKE_FREQUENCY_IDLE_MS;
            p.smokeTimer  = this.time.addEvent({
                delay: P.SMOKE_FREQUENCY_IDLE_MS, callback: () => this._spawnSmokePuff(p), loop: true,
            });
        });
    }

    _stopSmoke(p) {
        if (p.smokeTimer) {
            this.time.removeEvent(p.smokeTimer);
            p.smokeTimer = null;
        }
    }

    _spawnSmokePuff(p) {
        const P  = CONFIG.PLATFORM;
        const ox = p._gadgetOriginX;
        const oy = p._gadgetOriginY;  // center of gadget
        
        // Check if we're in post-explosion burst mode (stronger smoke)
        const isPostExplosion = p.isDefeated && p._smokeDelay === P.SMOKE_FREQUENCY_MAX_MS;
        
        const r  = isPostExplosion 
            ? 6 + Math.random() * 8  // Much larger: 6-14px after explosion
            : P.SMOKE_RADIUS_MIN + Math.random() * (P.SMOKE_RADIUS_MAX - P.SMOKE_RADIUS_MIN);
        
        const alpha = isPostExplosion ? 0.7 : 0.45;  // More opaque after explosion
        const sx = ox + (Math.random() - 0.5) * P.SMOKE_SPREAD_X;
        const puff = this.add.circle(sx, oy, r, P.SMOKE_COLOR, alpha).setDepth(25);
        
        // Track this smoke puff for cleanup
        if (p.smokePuffs) p.smokePuffs.push(puff);
        
        const lifespan = isPostExplosion ? 1800 : P.SMOKE_LIFESPAN_MS;  // Longer lasting after explosion
        
        this.tweens.add({
            targets: puff,
            y: oy - P.SMOKE_DRIFT_Y - Math.random() * 20,
            x: sx + (Math.random() - 0.5) * 16,
            alpha: 0,
            scaleX: isPostExplosion ? 2.8 : 2.2,
            scaleY: isPostExplosion ? 2.8 : 2.2,
            duration: lifespan,
            ease: 'Sine.easeOut',
            onComplete: () => {
                // Remove from tracking array
                if (p.smokePuffs) {
                    const idx = p.smokePuffs.indexOf(puff);
                    if (idx > -1) p.smokePuffs.splice(idx, 1);
                }
                puff.destroy();
            },
        });
    }

    /**
     * Calculate display dimensions to fit sprite to target rectangle while preserving aspect ratio.
     * Automatically constrains by width or height to maximize area within the target rect.
     * 
     * @param {Phaser.Textures.Texture} texture - The sprite texture
     * @param {number} targetWidth - The target width
     * @param {number} targetHeight - The target height (optional, defaults to targetWidth for square)
     * @returns {{width: number, height: number}} - Display width and height
     */
    _getAspectFitSize(texture, targetWidth, targetHeight) {
        const frame = texture.get();
        const srcWidth = frame.width;
        const srcHeight = frame.height;
        
        // If only one parameter provided, assume square target (backward compatibility)
        if (targetHeight === undefined) {
            targetHeight = targetWidth;
        }
        
        // Calculate scale factors for both dimensions
        const scaleX = targetWidth / srcWidth;
        const scaleY = targetHeight / srcHeight;
        
        // Use the smaller scale to fit within the rectangle while preserving aspect ratio
        const scale = Math.min(scaleX, scaleY);
        
        // Apply scale to both dimensions to preserve aspect ratio
        return {
            width: srcWidth * scale,
            height: srcHeight * scale
        };
    }

    loadGadgets(gadgetData) {
        this.clearGadgets();
        this.gadgetAnimationsComplete = false; // Reset flag for new level
        
        // Stop charging interval while gadgets are loading/animating
        if (this.chargingInterval) {
            this.chargingInterval.remove();
            this.chargingInterval = null;
        }
        
        // Restart the charging polling for the new level
        this.startCharging();
        
        const P = CONFIG.PLATFORM;
        for (let i = 0; i < 3; i++) {
            const p        = this.platforms[i];
            const capacity = gadgetData.capacity[i];
            
            // Debug rect - shows the maximum area for gadget display
            let debugRect = null;
            if (P.DEBUG_RECT_SHOW) {
                debugRect = this.add.rectangle(
                    p.debugRectX, p.debugRectY, 
                    P.DEBUG_RECT_WIDTH, P.DEBUG_RECT_HEIGHT, 
                    P.DEBUG_RECT_COLOR, P.DEBUG_RECT_ALPHA
                );
                debugRect.setDepth(3.9);
            }

            // Calculate actual gadget display size within debug rect bounds
            const normalKey = `gadget_${gadgetData.name}_normal`;
            let gadgetDisplayWidth, gadgetDisplayHeight;
            
            if (this.textures.exists(normalKey)) {
                const size = this._getAspectFitSize(
                    this.textures.get(normalKey), 
                    P.DEBUG_RECT_WIDTH, 
                    P.DEBUG_RECT_HEIGHT
                );
                gadgetDisplayWidth = size.width;
                gadgetDisplayHeight = size.height;
            } else {
                gadgetDisplayWidth = P.DEBUG_RECT_WIDTH;
                gadgetDisplayHeight = P.DEBUG_RECT_HEIGHT;
            }
            
            // Gadget position: horizontally centered in debug rect, vertically touching bottom
            const gadgetX = p.debugRectX;
            const gadgetY = p.debugRectY + P.DEBUG_RECT_HEIGHT / 2 - gadgetDisplayHeight / 2;

            // Capacity text above gadget with controllable size and gap
            const capText = this.add.text(
                gadgetX, 
                gadgetY - gadgetDisplayHeight / 2 - P.CAPACITY_TEXT_GAP, 
                `${capacity}`, 
                {
                    fontSize: P.CAPACITY_TEXT_SIZE, 
                    fontFamily: CONFIG.FONT_FAMILY,
                    color: '#000000', 
                    fontStyle: 'bold',
                    stroke: '#FFFFFF', 
                    strokeThickness: 3,
                }
            ).setOrigin(0.5, 1).setDepth(5);

            // Create gadget sprite
            const gadgetSprite = this.textures.exists(normalKey)
                ? this.add.image(gadgetX, gadgetY, normalKey)
                : this.add.rectangle(gadgetX, gadgetY, gadgetDisplayWidth, gadgetDisplayHeight, 0x888888);
            
            gadgetSprite.setDisplaySize(gadgetDisplayWidth, gadgetDisplayHeight);
            gadgetSprite.setDepth(4);

            p.gadgetSprite        = gadgetSprite;
            p.gadgetCapacity      = capacity;
            p.gadgetCurrentCharge = 0;
            p.gadgetCapacityText  = capText;
            p.gadgetChargeText    = null;
            p.isDefeated          = false;
            p.reachedZeroCapacity = false;
            p._gadgetName         = gadgetData.name;
            p._gadgetOriginX      = gadgetX;
            p._gadgetOriginY      = gadgetY;
            p._gadgetDisplayWidth = gadgetDisplayWidth;
            p._gadgetDisplayHeight= gadgetDisplayHeight;
            p._shakeActive        = false;
            p._pulseActive        = false;
            p.smokeTimer          = null;
            p.smokePuffs          = [];
            p.explosionEffects    = [];
            p._debugRect          = debugRect;

            // ── Wire connection ────────────────────────────────────────────────
            const socketX = p.slotX + P.SLOT_SIZE / 2 + P.SOCKET_GAP_FROM_SLOT;
            const socketY = p.slotY;
            
            // connection_height: fraction from bottom (0=bottom, 1=top), default 0.5 = centre
            // connection_left_padding: horizontal inset into gadget as fraction of width, default 0.1
            const connH      = gadgetData.connection_height      ?? 0.5;
            const connLPad   = gadgetData.connection_left_padding ?? 0.1;
            const plugEndX   = gadgetX - gadgetDisplayWidth / 2 + connLPad * gadgetDisplayWidth;
            const plugEndY   = gadgetY + gadgetDisplayHeight / 2 - connH * gadgetDisplayHeight;

            // socket behind wire; plug on top of wire; gadget (depth 4) on top of all
            const socketSprite = this.textures.exists('gadget_socket')
                ? this.add.image(socketX, socketY, 'gadget_socket').setDisplaySize(P.SOCKET_SIZE, P.SOCKET_SIZE)
                : this.add.circle(socketX, socketY, P.SOCKET_SIZE / 2, 0x556677);
            socketSprite.setDepth(3.4);

            const wireGfx = this.add.graphics().setDepth(3.55);
            // Wire: from bottom-centre of plug icon to gadget connection point
            // Extend wire upward by 6px to close gap with plug visual
            this._drawWire(wireGfx, socketX, socketY + P.PLUG_SIZE / 2 - 6, plugEndX, plugEndY);

            const plugSprite = this.textures.exists('gadget_plug_in')
                ? this.add.image(socketX, socketY, 'gadget_plug_in').setDisplaySize(P.PLUG_SIZE, P.PLUG_SIZE)
                : this.add.circle(socketX, socketY, P.PLUG_SIZE / 2, 0x778899);
            plugSprite.setDepth(3.7);

            p.socketSprite = socketSprite;
            p.plugSprite   = plugSprite;
            p.wireGraphics = wireGfx;
            p._wireStartX  = socketX;
            p._wireStartY  = socketY;
            p._wireEndX    = plugEndX;
            p._wireEndY    = plugEndY;

            // ── Analog meter ──────────────────────────────────────────────────
            if (P.SHOW_ANALOG_METER) {
                // Calculate meter pivot position based on actual gadget display size
                const mpx = gadgetX + gadgetDisplayWidth / 2 + P.METER_PADDING_FROM_GADGET + P.METER_RADIUS;
                const mpy = gadgetY + gadgetDisplayHeight / 2 + P.METER_Y_OFFSET;

                const meterBg = this.add.graphics().setDepth(4.2);
                // Draw at full size (unscaled), then scale the entire graphics object
                this._drawMeterBg(meterBg, 0, 0);  // Draw at origin
                meterBg.setPosition(mpx, mpy);      // Position the pivot point
                meterBg.setScale(P.METER_SCALE);    // Scale around the pivot

                // Needle: thin rect, origin at pivot (bottom-centre), initial angle -90 = far-left
                const meterNeedle = this.add.rectangle(
                    0, 0, 3, P.METER_RADIUS - 10, 0xF0F0F0)
                    .setOrigin(0.5, 1).setAngle(-90).setDepth(4.6);
                meterNeedle.setPosition(mpx, mpy);
                meterNeedle.setScale(P.METER_SCALE);

                // Pivot dot on top of everything
                const meterPivot = this.add.circle(0, 0, 5, 0x223344).setDepth(4.8);
                meterPivot.setPosition(mpx, mpy);
                meterPivot.setScale(P.METER_SCALE);

                p.meterBg     = meterBg;
                p.meterNeedle = meterNeedle;
                p.meterPivot  = meterPivot;
            } else {
                p.meterBg     = null;
                p.meterNeedle = null;
                p.meterPivot  = null;
            }
        }
        
        // Animate gadgets appearing one by one with slight delay
        this.animateGadgetsAppearance();
    }

    animateGadgetsAppearance() {
        const P = CONFIG.PLATFORM;
        const ANIMATION_DURATION = 400;  // Duration of popup animation
        const STAGGER_DELAY = 150;       // Delay between each gadget starting its animation
        
        // Calculate total time for all animations to complete
        const lastGadgetStartDelay = 2 * STAGGER_DELAY; // Third gadget (index 2)
        const totalAnimationTime = lastGadgetStartDelay + ANIMATION_DURATION;
        
        // Set flag when all animations complete (with optional delay)
        // The startCharging() polling mechanism will handle creating the charging interval
        this.time.delayedCall(totalAnimationTime, () => {
            const chargingDelay = CONFIG.GADGET_LOAD.DELAY_BEFORE_CHARGING;
            this.time.delayedCall(chargingDelay, () => {
                this.gadgetAnimationsComplete = true;
            });
        });
        
        for (let i = 0; i < 3; i++) {
            const p = this.platforms[i];
            const delay = i * STAGGER_DELAY;
            
            // Elements to show after animation: wire and plug
            const delayedElements = [
                p.wireGraphics,
                p.plugSprite
            ].filter(Boolean);
            
            // Store target dimensions for gadget sprite (already set via setDisplaySize)
            const targetWidth = p._gadgetDisplayWidth;
            const targetHeight = p._gadgetDisplayHeight;
            
            // Set initial state for gadget sprite: invisible and small (using displayWidth/Height)
            if (p.gadgetSprite) {
                p.gadgetSprite.setAlpha(0);
                p.gadgetSprite.displayWidth = targetWidth * 0.5;
                p.gadgetSprite.displayHeight = targetHeight * 0.5;
            }
            
            // Set initial state for capacity text: invisible and scaled down
            if (p.gadgetCapacityText) {
                p.gadgetCapacityText.setAlpha(0);
                p.gadgetCapacityText.setScale(0.5);
            }
            
            // Set initial state for meter elements: invisible and scaled down from their original scale
            const meterOriginalScale = P.SHOW_ANALOG_METER ? P.METER_SCALE : 1;
            if (p.meterBg) {
                p.meterBg.setAlpha(0);
                p.meterBg.setScale(meterOriginalScale * 0.5);
            }
            if (p.meterNeedle) {
                p.meterNeedle.setAlpha(0);
                p.meterNeedle.setScale(meterOriginalScale * 0.5);
            }
            if (p.meterPivot) {
                p.meterPivot.setAlpha(0);
                p.meterPivot.setScale(meterOriginalScale * 0.5);
            }
            
            // Set initial state for wire/plug: invisible at normal scale
            delayedElements.forEach(el => {
                el.setAlpha(0);
            });
            
            // Animate gadget elements to pop in
            this.time.delayedCall(delay, () => {
                // Animate gadget sprite (using displayWidth/displayHeight to preserve setDisplaySize)
                if (p.gadgetSprite) {
                    this.tweens.add({
                        targets: p.gadgetSprite,
                        alpha: 1,
                        displayWidth: targetWidth,
                        displayHeight: targetHeight,
                        duration: ANIMATION_DURATION,
                        ease: 'Back.easeOut'
                    });
                }
                
                // Animate capacity text
                if (p.gadgetCapacityText) {
                    this.tweens.add({
                        targets: p.gadgetCapacityText,
                        alpha: 1,
                        scaleX: 1,
                        scaleY: 1,
                        duration: ANIMATION_DURATION,
                        ease: 'Back.easeOut'
                    });
                }
                
                // Animate meter elements to their original scale
                const meterElements = [p.meterBg, p.meterNeedle, p.meterPivot].filter(Boolean);
                meterElements.forEach(el => {
                    this.tweens.add({
                        targets: el,
                        alpha: 1,
                        scaleX: meterOriginalScale,
                        scaleY: meterOriginalScale,
                        duration: ANIMATION_DURATION,
                        ease: 'Back.easeOut'
                    });
                });
                
                // Show wire and plug after gadget animation completes
                this.time.delayedCall(ANIMATION_DURATION, () => {
                    delayedElements.forEach(el => {
                        this.tweens.add({
                            targets: el,
                            alpha: 1,
                            duration: 200,
                            ease: 'Linear'
                        });
                    });
                });
            });
        }
    }

    clearGadgets() {
        for (const p of this.platforms) {
            this._stopSmoke(p);
            this._stopEnergyEffects(p);
            
            // Clean up all smoke puffs and their tweens
            if (p.smokePuffs) {
                for (const puff of p.smokePuffs) {
                    if (puff && puff.scene) {
                        this.tweens.killTweensOf(puff);
                        puff.destroy();
                    }
                }
                p.smokePuffs = [];
            }
            
            // Clean up all explosion effects and their tweens
            if (p.explosionEffects) {
                for (const effect of p.explosionEffects) {
                    if (effect && effect.scene) {
                        this.tweens.killTweensOf(effect);
                        effect.destroy();
                    }
                }
                p.explosionEffects = [];
            }
            
            if (p.gadgetSprite) this.tweens.killTweensOf(p.gadgetSprite);
            if (p.meterNeedle) this.tweens.killTweensOf(p.meterNeedle);
            [p.gadgetSprite, p.gadgetCapacityText, p.gadgetChargeText,
             p.meterBg, p.meterNeedle, p.meterPivot,
             p.wireGraphics, p.socketSprite, p.plugSprite, p._debugRect]
                .forEach(o => { if (o) o.destroy(); });
            p.gadgetSprite = p.gadgetCapacityText = p.gadgetChargeText =
            p.meterBg = p.meterNeedle = p.meterPivot = null;
            p.wireGraphics = p.socketSprite = p.plugSprite = p._debugRect = null;
            p.gadgetCurrentCharge = 0;
            p.isDefeated = false;
            p._shakeActive = false;
            p._pulseActive = false;
            p.smokeTimer = null;
            p._smokeDelay = null;
            p.coinAnimationComplete = true;  // Reset coin animation state
            p.reachedZeroCapacity = false;  // Reset charging stop flag
        }
    }

    addBatteryToSlot(slotIndex, level) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (this.chargingSlots[slotIndex] !== null) return;
        const p   = this.platforms[slotIndex];
        const chargePerMinute  = getBatteryChargeValue(level);
        const batteryIconLevel = getBatteryIconLevel(level);
        const yOff  = CONFIG.CELL.BATTERY_Y_OFFSET;
        const tOff  = CONFIG.CELL.LEVEL_TEXT_Y_OFFSET;

        // Transparent draggable overlay that covers the whole slot cell —
        // gives a reliable pick-up region independent of sprite texture.
        const draggableBg = this.add.rectangle(
            p.slotX, p.slotY, p.slotSize, p.slotSize, 0xFFFFFF, 0)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        const batterySprite = this.add.image(p.slotX, p.slotY + yOff, `battery${batteryIconLevel}`);
        batterySprite.setDisplaySize(CONFIG.CELL.BATTERY_DISPLAY_SIZE, CONFIG.CELL.BATTERY_DISPLAY_SIZE);
        batterySprite.setDepth(11);

        const levelText = this.add.text(p.slotX, p.slotY + yOff + tOff, `LVL ${level}`, {
            fontSize: CONFIG.CELL.LEVEL_TEXT_SIZE, fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(12);

        p.slotBg.setVisible(false);
        p.slotBgFilled.setVisible(true);
        p.batterySprite    = batterySprite;
        p.batteryLevelText = levelText;

        // Show charge-rate label above the slot
        p.chargeRateText.setText(`${chargePerMinute}`).setVisible(true);
        p.chargeRateBolt.setVisible(true);

        const batteryData = {
            sprite: batterySprite, levelText,
            draggableBg, level,
            slotIndex,
            originalX: p.slotX,
            originalY: p.slotY + yOff,
            inGrid: false, inChargingSlot: true,
        };
        draggableBg.setData('batteryData', batteryData);
        this.chargingSlots[slotIndex] = { level, chargePerMinute, batteryData };
    }

    removeBatteryFromSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (!this.chargingSlots[slotIndex]) return;
        const slot = this.chargingSlots[slotIndex];
        const bd   = slot.batteryData;
        const p    = this.platforms[slotIndex];
        if (bd && bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
        if (p.batterySprite)    p.batterySprite.destroy();
        if (p.batteryLevelText) p.batteryLevelText.destroy();
        p.batterySprite = p.batteryLevelText = null;
        p.slotBg.setVisible(true);
        p.slotBgFilled.setVisible(false);
        p.chargeRateText.setVisible(false);
        p.chargeRateBolt.setVisible(false);
        this.chargingSlots[slotIndex] = null;
    }

    // ================================================================
    // CHARGING / GADGET SYSTEM
    // ================================================================
    startCharging() {
        // Wait for gadget animations to complete before starting charge cycle
        const checkAnimationsComplete = () => {
            if (this.gadgetAnimationsComplete) {
                // Only create interval if one doesn't already exist
                if (!this.chargingInterval) {
                    this.chargingInterval = this.time.addEvent({
                        delay: 1000, callback: this.chargeCycle, callbackScope: this, loop: true,
                    });
                }
            } else {
                // Check again in 100ms
                this.time.delayedCall(100, checkAnimationsComplete);
            }
        };
        checkAnimationsComplete();
    }

    chargeCycle() {
        // Don't charge if gadget animations are not complete yet
        if (!this.gadgetAnimationsComplete) return;
        
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (!slot) continue;
            const p = this.platforms[i];
            if (p.isDefeated || !p.gadgetSprite) continue;
            
            // Stop charging if gadget has already reached 0 capacity
            if (p.reachedZeroCapacity) continue;

            p.gadgetCurrentCharge = Math.min(
                p.gadgetCurrentCharge + slot.chargePerMinute, p.gadgetCapacity);
            this.updateGadgetChargeBar(p);
            this._applyTensionEffects(p);
            
            // Check if we've reached or exceeded capacity
            if (p.gadgetCurrentCharge >= p.gadgetCapacity) {
                // Mark that we've reached zero capacity - stop all future charging
                p.reachedZeroCapacity = true;
                
                // Visual effects one last time before stopping
                this._pulseBatteryIcon(p);
                this._animateEnergyFlow(p);
                this._animateEnergyBeam(p);
                this._animateGadgetGlow(p);
                
                // Wait for all charging animations to complete before explosion
                this._waitForChargingAnimations(p, () => {
                    this.explodeGadget(p);
                });
            } else {
                // Normal charging - show visual effects
                this._pulseBatteryIcon(p);
                this._animateEnergyFlow(p);
                this._animateEnergyBeam(p);
                this._animateGadgetGlow(p);
            }
        }
    }

    updateGadgetChargeBar(p) {
        const P = CONFIG.PLATFORM;
        const progress = Math.min(p.gadgetCurrentCharge / p.gadgetCapacity, 1);
        if (p.gadgetCapacityText) {
            const remaining = Math.max(0, Math.ceil(p.gadgetCapacity - p.gadgetCurrentCharge));
            // Hide text when at 0 instead of showing empty or '0'
            if (remaining === 0) {
                p.gadgetCapacityText.setVisible(false);
            } else {
                p.gadgetCapacityText.setText(`${remaining}`);
                p.gadgetCapacityText.setVisible(true);
                p.gadgetCapacityText.setAlpha(0.35 + 0.65 * (1 - progress));
            }
        }
        this._animateMeterNeedle(p, progress * CONFIG.PLATFORM.METER_EXPLOSION_ANGLE);
    }

    _waitForChargingAnimations(p, callback) {
        // Wait for all active charging animations to complete before triggering explosion
        const P = CONFIG.PLATFORM;
        
        // Calculate total time for charging animations
        const energyParticleTime = P.CHARGE_PARTICLE_SPEED + P.CHARGE_FLASH_DURATION;
        const glowTime = P.USE_GADGET_AURA ? 1500 : (P.GADGET_ENERGY_GLOW_ENABLED ? P.GADGET_ENERGY_GLOW_DURATION : 0);
        const maxAnimationTime = Math.max(energyParticleTime, glowTime);
        
        // Wait for animations to complete
        this.time.delayedCall(maxAnimationTime, callback);
    }

    _stopEnergyEffects(p) {
        // Stop all active aura animations and effects
        if (p.activeAuraEvents) {
            p.activeAuraEvents.forEach(({ event, layers }) => {
                if (event) event.remove();
                layers.forEach(layer => { if (layer && layer.scene) layer.destroy(); });
            });
            p.activeAuraEvents = [];
        }
        
        // Stop all active sparks
        if (p.activeSparks) {
            p.activeSparks.forEach(spark => {
                if (spark && spark.scene) {
                    this.tweens.killTweensOf(spark);
                    spark.destroy();
                }
            });
            p.activeSparks = [];
        }
    }

    _pulseBatteryIcon(p) {
        // Subtle pulse effect on the battery sprite when it charges the gadget
        if (!p.batterySprite) return;
        
        const P = CONFIG.PLATFORM;
        this.tweens.add({
            targets: p.batterySprite,
            scale: P.BATTERY_PULSE_SCALE,
            duration: P.BATTERY_PULSE_DURATION,
            yoyo: true,
            ease: 'Sine.easeInOut'
        });
    }

    // ================================================================
    // ADVANCED VFX: ARCING WIRE EFFECT (Lightning-style)
    // ================================================================
    _animateEnergyBeam(p) {
        if (!p._wireStartX || !p._wireEndX) return;
        const P = CONFIG.PLATFORM;
        
        if (P.USE_ARCING_WIRE) {
            this._createArcingWire(p);
        } else if (P.ENERGY_BEAM_ENABLED) {
            this._createSimpleBeam(p);
        }
    }
    
    _createArcingWire(p) {
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        // Build wire path array
        const wirePath = this._buildWirePath(x1, y1, x2, y2, P.ARCING_WIRE_SEGMENTS);
        
        // Create graphics object
        const arcGfx = this.add.graphics().setDepth(3.6);
        
        // Animation state - arc vibrates in place, doesn't travel
        const duration = P.ARCING_WIRE_PULSE_DURATION / 1000;
        const state = {
            time: 0,
            duration: duration
        };
        
        // Store cleanup reference
        const updateEvent = this.time.addEvent({
            delay: 16, // ~60fps
            callback: () => {
                state.time += 0.016;
                
                // Regenerate jagged path every frame for flickering effect
                // Always show full wire (progress = 1.0) with vibrating spikes
                const jaggedPath = this._applyAdvancedDisplacement(wirePath, P);
                
                // Clear and redraw full arc
                arcGfx.clear();
                this._drawLayeredArc(arcGfx, jaggedPath, 1.0); // Always full wire visible
                
                // Cleanup when duration complete
                if (state.time >= state.duration) {
                    updateEvent.remove();
                    this.tweens.add({
                        targets: arcGfx,
                        alpha: 0,
                        duration: 150,
                        onComplete: () => arcGfx.destroy()
                    });
                }
            },
            loop: true
        });
        
        // Auto-cleanup after duration
        this.time.delayedCall(P.ARCING_WIRE_PULSE_DURATION + 200, () => {
            if (updateEvent) updateEvent.remove();
            if (arcGfx.scene) arcGfx.destroy();
        });
    }
    
    _buildWirePath(x1, y1, x2, y2, segments) {
        const P = CONFIG.PLATFORM;
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return [[x1, y1], [x2, y2]];
        
        // Rigid vertical segment
        const rigidLen = P.WIRE_RIGID_LENGTH;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        // Quadratic bezier control point for sag
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        // Build path array
        const path = [[x1, y1], [rx, ry]];
        
        // Sample curved section
        for (let i = 1; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const bx = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
            const by = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
            path.push([bx, by]);
        }
        
        return path;
    }
    
    _applyAdvancedDisplacement(path, P) {
        // Apply aggressive displacement for spiky lightning effect
        let jaggedPath = [...path];
        
        // Multiple passes for more jaggedness
        for (let pass = 0; pass < P.ARCING_WIRE_JITTER_PASSES; pass++) {
            const newPath = [jaggedPath[0]];
            
            for (let i = 0; i < jaggedPath.length - 1; i++) {
                const [x1, y1] = jaggedPath[i];
                const [x2, y2] = jaggedPath[i + 1];
                
                // Midpoint with aggressive random displacement
                const mx = (x1 + x2) / 2;
                const my = (y1 + y2) / 2;
                const dist = Math.hypot(x2 - x1, y2 - y1);
                const displacement = (Math.random() - 0.5) * dist * P.ARCING_WIRE_ROUGHNESS * P.ARCING_WIRE_DISPLACEMENT_SCALE;
                
                // Perpendicular offset for spike
                const dx = x2 - x1;
                const dy = y2 - y1;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length > 0) {
                    const offsetX = -dy / length * displacement;
                    const offsetY = dx / length * displacement;
                    
                    // Add random jitter to make it less smooth
                    const jitterX = (Math.random() - 0.5) * P.ARCING_WIRE_RANDOM_OFFSET;
                    const jitterY = (Math.random() - 0.5) * P.ARCING_WIRE_RANDOM_OFFSET;
                    
                    newPath.push([mx + offsetX + jitterX, my + offsetY + jitterY]);
                }
                newPath.push([x2, y2]);
            }
            
            jaggedPath = newPath;
        }
        
        return jaggedPath;
    }
    
    _drawLayeredArc(gfx, path, progress) {
        const P = CONFIG.PLATFORM;
        
        // Calculate visible segment based on progress
        const visiblePoints = Math.floor(progress * path.length);
        if (visiblePoints < 2) return;
        
        const visiblePath = path.slice(0, visiblePoints);
        
        // Layer 1: Thick semi-transparent glow (Cyan/Blue)
        gfx.lineStyle(P.ARCING_WIRE_GLOW_THICKNESS, P.ARCING_WIRE_GLOW_COLOR, 0.3);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
        
        // Layer 2: Medium bright blue stroke
        gfx.lineStyle(P.ARCING_WIRE_MEDIUM_THICKNESS, P.ARCING_WIRE_BRIGHT_COLOR, 0.8);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
        
        // Layer 3: Thin white core
        gfx.lineStyle(P.ARCING_WIRE_CORE_THICKNESS, P.ARCING_WIRE_CORE_COLOR, 1.0);
        gfx.beginPath();
        gfx.moveTo(visiblePath[0][0], visiblePath[0][1]);
        for (let i = 1; i < visiblePath.length; i++) {
            gfx.lineTo(visiblePath[i][0], visiblePath[i][1]);
        }
        gfx.strokePath();
    }
    
    _createSimpleBeam(p) {
        // Fallback simple beam (original implementation)
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;
        
        const rigidLen = P.WIRE_RIGID_LENGTH;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        const beam = this.add.graphics().setDepth(3.5).setAlpha(0);
        beam.lineStyle(P.ENERGY_BEAM_THICKNESS, P.ENERGY_BEAM_COLOR, P.ENERGY_BEAM_ALPHA);
        
        beam.beginPath();
        beam.moveTo(x1, y1);
        beam.lineTo(rx, ry);
        
        const segments = 20;
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const mt = 1 - t;
            const bx = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
            const by = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
            beam.lineTo(bx, by);
        }
        beam.strokePath();
        
        this.tweens.add({
            targets: beam,
            alpha: P.ENERGY_BEAM_ALPHA,
            duration: P.ENERGY_BEAM_DURATION / 2,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: beam,
                    alpha: 0,
                    duration: P.ENERGY_BEAM_DURATION / 2,
                    ease: 'Cubic.easeIn',
                    onComplete: () => beam.destroy()
                });
            }
        });
    }
    
    // ================================================================
    // ADVANCED VFX: GADGET AURA EFFECT
    // ================================================================
    _animateGadgetGlow(p) {
        if (!p.gadgetSprite) return;
        const P = CONFIG.PLATFORM;
        
        if (P.USE_GADGET_AURA) {
            this._createGadgetAura(p);
        } else if (P.GADGET_ENERGY_GLOW_ENABLED) {
            this._createSimpleGlow(p);
        }
    }
    
    _createGadgetAura(p) {
        const P = CONFIG.PLATFORM;
        const gx = p._gadgetOriginX;
        const gy = p._gadgetOriginY;
        
        // Create container for aura layers
        const auraLayers = [];
        const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
        const baseSize = maxDim / 2 + P.GADGET_AURA_BASE_SIZE;
        
        // Create concentric glow layers
        for (let i = 0; i < P.GADGET_AURA_LAYERS; i++) {
            const layerSize = baseSize + (i * 15);
            const layer = this.add.circle(gx, gy, layerSize, P.GADGET_AURA_COLOR, 0).setDepth(4.0 + i * 0.1);
            auraLayers.push(layer);
        }
        
        // Animation state
        const state = {
            time: 0,
            duration: 1.5 // Total effect duration
        };
        
        // Breathing animation with sine wave
        const updateEvent = this.time.addEvent({
            delay: 16,
            callback: () => {
                if (p.isDefeated) {
                    // Stop animation if gadget is defeated
                    updateEvent.remove();
                    auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
                    return;
                }
                
                state.time += 0.016;
                const progress = state.time / state.duration;
                const pulsePhase = state.time * P.GADGET_AURA_PULSE_SPEED * Math.PI * 2;
                const pulseValue = (Math.sin(pulsePhase) + 1) / 2; // 0 to 1
                
                // Update each layer
                auraLayers.forEach((layer, i) => {
                    if (!layer.scene) return;
                    const phaseOffset = i * 0.3;
                    const layerPulse = (Math.sin(pulsePhase + phaseOffset) + 1) / 2;
                    const baseAlpha = 0.4 - (i * 0.1);
                    layer.setAlpha(baseAlpha * layerPulse * (1 - progress));
                    
                    const baseSize = maxDim / 2 + P.GADGET_AURA_BASE_SIZE + (i * 15);
                    layer.setRadius(baseSize * (1 + layerPulse * 0.2));
                });
                
                // Cleanup when complete
                if (progress >= 1) {
                    updateEvent.remove();
                    auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
                }
            },
            loop: true
        });
        
        // Store reference for cleanup
        if (!p.activeAuraEvents) p.activeAuraEvents = [];
        p.activeAuraEvents.push({ event: updateEvent, layers: auraLayers });
        
        // Spawn electric sparks (reuse maxDim from function scope)
        this._spawnElectricSparks(p, gx, gy, maxDim / 2);
        
        // Auto-cleanup
        this.time.delayedCall(state.duration * 1000, () => {
            if (updateEvent) updateEvent.remove();
            auraLayers.forEach(layer => { if (layer.scene) layer.destroy(); });
            // Remove from active events
            if (p.activeAuraEvents) {
                const idx = p.activeAuraEvents.findIndex(e => e.event === updateEvent);
                if (idx > -1) p.activeAuraEvents.splice(idx, 1);
            }
        });
    }
    
    _spawnElectricSparks(p, cx, cy, radius) {
        const P = CONFIG.PLATFORM;
        const sparkCount = P.GADGET_AURA_SPARK_COUNT;
        
        if (!p.activeSparks) p.activeSparks = [];
        
        for (let i = 0; i < sparkCount; i++) {
            const angle = (i / sparkCount) * Math.PI * 2 + Math.random() * 0.5;
            const startRadius = radius + 40;
            const sx = cx + Math.cos(angle) * startRadius;
            const sy = cy + Math.sin(angle) * startRadius;
            
            // Create spark
            const spark = this.add.circle(sx, sy, 2, 0xFFFFFF, 0.9).setDepth(4.5);
            p.activeSparks.push(spark);
            
            // Animate toward center
            const durationRange = P.GADGET_AURA_SPARK_DURATION_MAX - P.GADGET_AURA_SPARK_DURATION_MIN;
            const duration = P.GADGET_AURA_SPARK_DURATION_MIN + Math.random() * durationRange;
            this.tweens.add({
                targets: spark,
                x: cx + Math.cos(angle) * (radius * 0.5),
                y: cy + Math.sin(angle) * (radius * 0.5),
                radius: 0.5,
                alpha: 0,
                duration: duration,
                ease: 'Cubic.easeIn',
                onComplete: () => {
                    spark.destroy();
                    // Remove from active sparks
                    if (p.activeSparks) {
                        const idx = p.activeSparks.indexOf(spark);
                        if (idx > -1) p.activeSparks.splice(idx, 1);
                    }
                }
            });
        }
    }
    
    _createSimpleGlow(p) {
        // Add glowing halo around gadget during charge pulse
        if (!p.gadgetSprite) return;
        const P = CONFIG.PLATFORM;
        if (!P.GADGET_ENERGY_GLOW_ENABLED) return;
        
        const gx = p._gadgetOriginX;
        const gy = p._gadgetOriginY;
        
        // Create glow circle around gadget
        const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
        const glowSize = maxDim / 2 + P.GADGET_ENERGY_GLOW_SIZE;
        const glow = this.add.circle(gx, gy, glowSize, P.GADGET_ENERGY_GLOW_COLOR, 0).setDepth(4.1);
        
        // Fade in and out with slight scale pulse
        this.tweens.add({
            targets: glow,
            alpha: P.GADGET_ENERGY_GLOW_ALPHA,
            radius: glowSize * 1.1,
            duration: P.GADGET_ENERGY_GLOW_DURATION / 2,
            ease: 'Cubic.easeOut',
            onComplete: () => {
                this.tweens.add({
                    targets: glow,
                    alpha: 0,
                    radius: glowSize * 1.3,
                    duration: P.GADGET_ENERGY_GLOW_DURATION / 2,
                    ease: 'Cubic.easeIn',
                    onComplete: () => glow.destroy()
                });
            }
        });
    }

    _animateEnergyFlow(p) {
        // Animate a glowing particle from the socket/plug through the wire to the gadget
        if (!p._wireStartX || !p._wireEndX) return;
        
        const P = CONFIG.PLATFORM;
        const x1 = p._wireStartX;
        const y1 = p._wireStartY;
        const x2 = p._wireEndX;
        const y2 = p._wireEndY;
        
        // Calculate wire path (same as _drawWire)
        const d = Math.hypot(x2 - x1, y2 - y1);
        if (d < 1) return;
        
        // Rigid vertical segment
        const rigidLen = P.WIRE_RIGID_LENGTH;
        const rx = x1;
        const ry = y1 + rigidLen;
        
        // Quadratic bezier control point for sag
        const excess = Math.max(0, d * P.WIRE_SAG_PERCENT / 100 - d);
        const sagDepth = Math.sqrt(0.75 * d * excess);
        const cx = (rx + x2) / 2;
        const cy = (ry + y2) / 2 + sagDepth;
        
        // Calculate total path length (approximate)
        const rigidDist = rigidLen;
        const curveDist = d * P.WIRE_SAG_PERCENT / 100;
        const totalDist = rigidDist + curveDist;
        const rigidFraction = rigidDist / totalDist;
        
        // Create glowing energy particle
        const particle = this.add.circle(x1, y1, P.CHARGE_PARTICLE_SIZE, 0xFFFF00, 0.9).setDepth(3.8);
        
        // Animate along the wire path using progress from 0 to 1
        this.tweens.add({
            targets: { progress: 0 },
            progress: 1,
            duration: P.CHARGE_PARTICLE_SPEED,
            ease: 'Linear',
            onUpdate: (tween) => {
                const progress = tween.getValue();
                
                if (progress <= rigidFraction) {
                    // Moving down rigid segment
                    const t = progress / rigidFraction;
                    particle.x = x1;
                    particle.y = y1 + t * rigidLen;
                } else {
                    // Moving along curved segment
                    const t = (progress - rigidFraction) / (1 - rigidFraction);
                    const mt = 1 - t;
                    particle.x = mt * mt * rx + 2 * mt * t * cx + t * t * x2;
                    particle.y = mt * mt * ry + 2 * mt * t * cy + t * t * y2;
                }
            },
            onComplete: () => {
                // Flash effect at gadget when energy arrives - bolt icon
                const flash = this.add.image(x2, y2, 'bolt')
                    .setDisplaySize(P.CHARGE_FLASH_INITIAL_SIZE, P.CHARGE_FLASH_INITIAL_SIZE)
                    .setAlpha(0.9)
                    .setDepth(5);
                    
                this.tweens.add({
                    targets: flash,
                    displayWidth: P.CHARGE_FLASH_FINAL_SIZE,
                    displayHeight: P.CHARGE_FLASH_FINAL_SIZE,
                    alpha: 0,
                    duration: P.CHARGE_FLASH_DURATION,
                    ease: 'Cubic.easeOut',
                    onComplete: () => flash.destroy()
                });
                particle.destroy();
            }
        });
    }

    explodeGadget(p) {
        if (p.isDefeated) return;
        const P  = CONFIG.PLATFORM;
        const ex = p._gadgetOriginX;
        const ey = p._gadgetOriginY;

        // Start a final intense shake sequence, swap sprite in the middle
        if (p.gadgetSprite) {
            this.tweens.killTweensOf(p.gadgetSprite);
            const burnedKey = `gadget_${p._gadgetName}_burnedout`;
            
            if (this.textures.exists(burnedKey)) {
                // Final tension shake sequence: progressive buildup, peak at sprite swap, then decay
                const finalShakeDur = 30; // Fast, violent
                let shakeCount = 0;
                const totalShakes = 6; // Extended: 2 buildup, 1 peak (swap), 3 decay
                
                const doFinalShake = () => {
                    if (!p.gadgetSprite) return;
                    
                    shakeCount++;
                    
                    // Calculate shake intensity: builds to peak at shake 3 (sprite swap)
                    let currentAmt;
                    if (shakeCount === 1) currentAmt = 8;   // Build up
                    else if (shakeCount === 2) currentAmt = 14;  // Stronger build up
                    else if (shakeCount === 3) currentAmt = 20;  // MAXIMUM at sprite swap
                    else if (shakeCount === 4) currentAmt = 12;  // Decay
                    else if (shakeCount === 5) currentAmt = 7;   // Further decay
                    else currentAmt = 3;                          // Final settle shake
                    
                    // Swap sprite at peak shake (shake 3)
                    if (shakeCount === 3) {
                        // Stop all energy flow effects (sparks, auras) when sprite switches
                        this._stopEnergyEffects(p);
                        
                        // Spawn coins behind the gadget sprite
                        if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                            p.coinAnimationComplete = false;
                            const totalDelay = P.BURNEDOUT_DISPLAY_DURATION + P.BURNEDOUT_FADE_DURATION + CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                            this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
                        } else {
                            // No coins to spawn, mark as complete
                            p.coinAnimationComplete = true;
                        }
                        
                        if(P.GADGET_SPRITE_SWITCH_ON_TENSION_ENABLED){
                            // Switch texture mid-shake for continuity
                        p.gadgetSprite.setTexture(burnedKey);
                        p.gadgetSprite.setTint(0xffffff);
                        p.gadgetSprite.setScale(1);
                        // Apply aspect-ratio-preserving scaling for burned out sprite
                        if (this.textures.exists(burnedKey)) {
                            const size = this._getAspectFitSize(this.textures.get(burnedKey), p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                            p.gadgetSprite.setDisplaySize(size.width, size.height);
                        } else {
                            p.gadgetSprite.setDisplaySize(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                        }
                        p.gadgetSprite.setAlpha(1);

                        }
                        else{
                            p.gadgetSprite.setVisible(false);

                        }
                        
                        p.isDefeated = true;
                        p._shakeActive = false;
                        p._pulseActive = false;
                        
                        // Schedule removal of burnedout sprite after configured duration
                        if (P.BURNEDOUT_DISPLAY_DURATION > 0) {
                            this.time.delayedCall(P.BURNEDOUT_DISPLAY_DURATION, () => {
                                if (p.gadgetSprite && p.gadgetSprite.scene) {
                                    // Stop smoke generation
                                    this._stopSmoke(p);
                                    
                                    // Clean up all smoke puffs
                                    if (p.smokePuffs) {
                                        for (const puff of p.smokePuffs) {
                                            if (puff && puff.scene) {
                                                this.tweens.killTweensOf(puff);
                                                puff.destroy();
                                            }
                                        }
                                        p.smokePuffs = [];
                                    }
                                    
                                // Clean up wire, plug, meter if still present (socket stays on charging slot)
                                const cleanupItems = [
                                    p.wireGraphics, p.plugSprite,
                                    p.meterBg, p.meterNeedle, p.meterPivot
                                ].filter(Boolean);
                                cleanupItems.forEach(item => {
                                    if (item.scene) {
                                        this.tweens.killTweensOf(item);
                                        item.destroy();
                                    }
                                });
                                p.wireGraphics = p.plugSprite = null;
                                    this.tweens.add({
                                        targets: p.gadgetSprite,
                                        alpha: 0,
                                        duration: P.BURNEDOUT_FADE_DURATION,
                                        ease: 'Cubic.easeOut',
                                        onComplete: () => {
                                            if (p.gadgetSprite && p.gadgetSprite.scene) {
                                                p.gadgetSprite.destroy();
                                                p.gadgetSprite = null;
                                            }
                                        }
                                    });
                                }
                            });
                        }
                        
                        // CODE EXPLOSION - Radial rings and burst lines
                        if (P.USE_CODE_EXPLOSION) {
                            const maxDim = Math.max(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                            const spriteRadius = maxDim / 2;
                            const maxRadius = spriteRadius * 1.5; // 150% of sprite radius
                            const numRings = 4;
                            const colors = [0xFFFFAA, 0xFFDD77, 0xFFAA44, 0xFF8822];
                            
                            for (let i = 0; i < numRings; i++) {
                                const ring = this.add.circle(ex, ey, 8, colors[i], 0.95).setDepth(100); // Much higher depth
                                // Track this explosion effect for cleanup
                                if (p.explosionEffects) p.explosionEffects.push(ring);
                                const delay = i * 15; // Stagger the rings
                                
                                this.time.delayedCall(delay, () => {
                                    if (!ring.scene) return; // Already destroyed
                                    this.tweens.add({
                                        targets: ring,
                                        radius: maxRadius,
                                        alpha: 0,
                                        duration: 350,
                                        ease: 'Cubic.easeOut',
                                        onComplete: () => {
                                            // Remove from tracking array
                                            if (p.explosionEffects) {
                                                const idx = p.explosionEffects.indexOf(ring);
                                                if (idx > -1) p.explosionEffects.splice(idx, 1);
                                            }
                                            ring.destroy();
                                        }
                                    });
                                });
                            }
                            
                            // Add radial burst lines for extra impact
                            const numLines = 12;
                            for (let i = 0; i < numLines; i++) {
                                const angle = (i / numLines) * Math.PI * 2;
                                const line = this.add.graphics().setDepth(99);
                                const startLen = 10;
                                const targetLen = maxRadius * 1.3;
                                
                                this.tweens.add({
                                    targets: line,
                                    alpha: 0,
                                    duration: 250,
                                    ease: 'Cubic.easeOut',
                                    onUpdate: (tween) => {
                                        const progress = tween.progress;
                                        const currentLen = startLen + (targetLen - startLen) * progress;
                                        const thickness = 5 * (1 - progress * 0.7); // Start thicker
                                        line.clear();
                                        line.lineStyle(thickness, 0xFFDD66, 1.0 * (1 - progress));
                                        line.beginPath();
                                        line.moveTo(ex, ey);
                                        line.lineTo(ex + Math.cos(angle) * currentLen, ey + Math.sin(angle) * currentLen);
                                        line.strokePath();
                                    },
                                    onComplete: () => line.destroy()
                                });
                            }
                            
                            // Add bright flash circle at center
                            const flash = this.add.circle(ex, ey, spriteRadius * 0.6, 0xFFFFFF, 1).setDepth(101);
                            this.tweens.add({
                                targets: flash,
                                radius: spriteRadius * 1.8,
                                alpha: 0,
                                duration: 200,
                                ease: 'Power3',
                                onComplete: () => flash.destroy()
                            });
                        }
                        
                        // SPRITE EXPLOSION - Animated sprite frames
                        if (P.USE_SPRITE_EXPLOSION) {
                            const explosionSprite = this.add.sprite(ex, ey, 'explosion_01')
                                .setOrigin(0.5, 0.5)
                                .setScale(P.SPRITE_EXPLOSION_SCALE)
                                .setDepth(100);
                            
                            // Track this explosion effect for cleanup
                            if (p.explosionEffects) p.explosionEffects.push(explosionSprite);
                            
                            // Play the explosion animation
                            explosionSprite.play('explode');
                            
                            // Remove sprite after animation completes
                            this.time.delayedCall(P.SPRITE_EXPLOSION_DURATION, () => {
                                if (explosionSprite && explosionSprite.scene) {
                                    // Remove from tracking array
                                    if (p.explosionEffects) {
                                        const idx = p.explosionEffects.indexOf(explosionSprite);
                                        if (idx > -1) p.explosionEffects.splice(idx, 1);
                                    }
                                    explosionSprite.destroy();
                                }
                            });
                        }
                    }
                    
                    if (shakeCount >= totalShakes) {
                        // Final settle
                        this.tweens.add({
                            targets: p.gadgetSprite, x: ex, y: ey,
                            duration: 100, ease: 'Sine.easeOut'
                        });
                        return;
                    }
                    
                    // Apply shake
                    const dx = (Math.random() - 0.5) * currentAmt * 2;
                    const dy = (Math.random() - 0.5) * currentAmt;
                    
                    this.tweens.add({
                        targets: p.gadgetSprite, x: ex + dx, y: ey + dy,
                        duration: finalShakeDur, ease: 'Sine.easeInOut',
                        onComplete: doFinalShake
                    });
                };
                
                doFinalShake();
                
            } else {
                // Fallback: darken in place
                // Stop all energy flow effects (sparks, auras) when sprite switches
                this._stopEnergyEffects(p);
                
                // Spawn coins behind the gadget sprite
                if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                    p.coinAnimationComplete = false;
                    const totalDelay = P.BURNEDOUT_DISPLAY_DURATION + P.BURNEDOUT_FADE_DURATION + CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                    this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
                } else {
                    // No coins to spawn, mark as complete
                    p.coinAnimationComplete = true;
                }
                
                p.gadgetSprite.setTint(0x444444);
                p.gadgetSprite.setAlpha(1);
                // Apply aspect-ratio-preserving scaling
                if (this.textures.exists(burnedKey)) {
                    const size = this._getAspectFitSize(this.textures.get(burnedKey), p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                    p.gadgetSprite.setDisplaySize(size.width, size.height);
                } else {
                    p.gadgetSprite.setDisplaySize(p._gadgetDisplayWidth, p._gadgetDisplayHeight);
                }
                p.gadgetSprite.setPosition(ex, ey);
                p.isDefeated = true;
                p._shakeActive = false;
                p._pulseActive = false;
                
                // Schedule removal of burnedout sprite after configured duration
                if (P.BURNEDOUT_DISPLAY_DURATION > 0) {
                    this.time.delayedCall(P.BURNEDOUT_DISPLAY_DURATION, () => {
                        if (p.gadgetSprite && p.gadgetSprite.scene) {
                            // Stop smoke generation
                            this._stopSmoke(p);
                            
                            // Clean up all smoke puffs
                            if (p.smokePuffs) {
                                for (const puff of p.smokePuffs) {
                                    if (puff && puff.scene) {
                                        this.tweens.killTweensOf(puff);
                                        puff.destroy();
                                    }
                                }
                                p.smokePuffs = [];
                            }
                            
                            // Clean up wire, plug, meter if still present (socket stays on charging slot)
                            const cleanupItems = [
                                p.wireGraphics, p.plugSprite,
                                p.meterBg, p.meterNeedle, p.meterPivot
                            ].filter(Boolean);
                            cleanupItems.forEach(item => {
                                if (item.scene) {
                                    this.tweens.killTweensOf(item);
                                    item.destroy();
                                }
                            });
                            p.wireGraphics = p.plugSprite = null;
                            p.meterBg = p.meterNeedle = p.meterPivot = null;
                            
                            // Fade out the burnedout sprite
                            this.tweens.add({
                                targets: p.gadgetSprite,
                                alpha: 0,
                                duration: P.BURNEDOUT_FADE_DURATION,
                                ease: 'Cubic.easeOut',
                                onComplete: () => {
                                    if (p.gadgetSprite && p.gadgetSprite.scene) {
                                        p.gadgetSprite.destroy();
                                        p.gadgetSprite = null;
                                    }
                                }
                            });
                        }
                    });
                }
            }
        } else {
            // No gadget sprite - spawn coins immediately with short delay
            if (p.gadgetCapacity && p.gadgetCapacity > 0) {
                p.coinAnimationComplete = false;
                const totalDelay = CONFIG.COIN_REWARD_ANIMATION.DELAY_BEFORE_FLY;
                this.animateCoinReward(ex, ey, p.gadgetCapacity, totalDelay, p);
            } else {
                // No coins to spawn, mark as complete
                p.coinAnimationComplete = true;
            }
            
            p.isDefeated = true;
            p._shakeActive = false;
            p._pulseActive = false;
        }

        // Screen shake on burnout
        this.cameras.main.shake(P.EXPLODE_SHAKE_DURATION, P.EXPLODE_SHAKE_INTENSITY);

        // Max smoke burst then settle to idle
        this._setSmokeBurst(p);

        // Disconnect wire + plug on burnout (socket stays on battery)
        const connFade = [p.wireGraphics, p.plugSprite].filter(Boolean);
        if (connFade.length) {
            this.tweens.add({
                targets: connFade, alpha: 0, duration: 220, ease: 'Power2',
                onComplete: () => {
                    connFade.forEach(o => o.destroy());
                    p.wireGraphics = p.plugSprite = null;
                },
            });
        }

        // Fade capacity text and meter (smoke keeps running after burnout)
        if (p.meterNeedle) this.tweens.killTweensOf(p.meterNeedle);
        const toFade = [p.gadgetCapacityText, p.gadgetChargeText,
                        p.meterBg, p.meterNeedle, p.meterPivot].filter(Boolean);
        if (toFade.length) {
            this.tweens.add({
                targets: toFade, alpha: 0, duration: 350,
                onComplete: () => {
                    toFade.forEach(o => o.destroy());
                    p.gadgetCapacityText = p.gadgetChargeText =
                    p.meterBg = p.meterNeedle = p.meterPivot = null;
                },
            });
        }

        this.time.delayedCall(350, () => this.checkAllDefeated());
    }

    checkAllDefeated() {
        if (this.platforms.every(p => p.isDefeated)) {
            // Wait for all coin animations to complete
            this._waitForCoinAnimations(() => {
                // Add buffer time after all coins collected before next level
                const bufferTime = CONFIG.LEVEL_COMPLETION.BUFFER_TIME;
                this.time.delayedCall(bufferTime, () => {
                    this.advanceToNextGadget();
                });
            });
        }
    }

    _waitForCoinAnimations(callback) {
        // Check if all coin animations are complete
        const allComplete = this.platforms.every(p => p.coinAnimationComplete);
        
        if (allComplete) {
            callback();
        } else {
            // Check again in 100ms
            this.time.delayedCall(100, () => {
                this._waitForCoinAnimations(callback);
            });
        }
    }

    advanceToNextGadget() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const flash = this.add.rectangle(W / 2, H / 2, W, H, 0xFFFFFF)
            .setDepth(1000).setAlpha(0);
        this.tweens.add({
            targets: flash, alpha: 1, duration: 140, ease: 'Linear', yoyo: true,
            onYoyoComplete: () => {
                flash.destroy();
                this.currentGadgetIndex = (this.currentGadgetIndex + 1) % this.gadgetsData.length;
                this.loadGadgets(this.gadgetsData[this.currentGadgetIndex]);
            },
        });
    }

    // ================================================================
    // BATTERY MERGE GRID (BOTTOM HALF)
    // ================================================================
    createGrid() {
        const W = window.innerWidth || this.cameras.main.width;
        const H = window.innerHeight || this.cameras.main.height;
        const L = this.layoutConfig;
        
        const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        
        let gridCenterX, gridStartX, gridStartY;
        
        if (L.isPortrait) {
            // Portrait: center horizontally, position below platforms
            const buttonY    = L.gridTop + L.gridHeight - CONFIG.BUTTON.BOTTOM_PADDING;
            const gridBotY   = buttonY - CONFIG.BUTTON.SPAWN_HEIGHT / 2 - CONFIG.MERGE_GRID.PADDING_FROM_BUTTON_TOP;
            gridStartY  = gridBotY - gridH + this.CELL_SIZE / 2;
            gridStartX  = (W - gridW) / 2 + this.CELL_SIZE / 2;
            gridCenterX = W / 2;
        } else {
            // Landscape: position on left half, vertically centered
            const availHeight = L.gridHeight;
            const gridTopMargin = (availHeight - gridH) / 2;
            gridStartY = L.gridTop + gridTopMargin + this.CELL_SIZE / 2;
            gridStartX = L.gridLeft + (L.gridWidth - gridW) / 2 + this.CELL_SIZE / 2;
            gridCenterX = L.gridLeft + L.gridWidth / 2;
        }

        this.gridStartX = gridStartX;
        this.gridStartY = gridStartY;

        const pad  = CONFIG.CELL.GRID_PANEL_PADDING;
        const panW = gridW + 2 * pad;
        const panH = gridH + 2 * pad;
        const cx   = gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const cy   = gridStartY - this.CELL_SIZE / 2 + gridH / 2;

        const panel = this.add.image(cx, cy, 'grid_panel');
        panel.setDisplaySize(panW, panH).setDepth(1.5);

        const inset = CONFIG.CELL.INSET_BORDER_WIDTH;
        for (let row = 0; row < this.GRID_ROWS; row++) {
            this.gridCells[row] = [];
            for (let col = 0; col < this.GRID_COLS; col++) {
                const x = gridStartX + col * (this.CELL_SIZE + this.CELL_GAP);
                const y = gridStartY + row * (this.CELL_SIZE + this.CELL_GAP);

                const emptyCell = this.add.graphics().setDepth(2);
                emptyCell.fillStyle(hexColor(CONFIG.CELL.INSET_SHADOW_COLOR), 1);
                emptyCell.fillRoundedRect(x - this.CELL_SIZE / 2, y - this.CELL_SIZE / 2,
                    this.CELL_SIZE, this.CELL_SIZE, this.CELL_RADIUS);
                emptyCell.fillStyle(hexColor(CONFIG.CELL.EMPTY_BG_COLOR), 1);
                emptyCell.fillRoundedRect(x - this.CELL_SIZE / 2 + inset, y - this.CELL_SIZE / 2 + inset,
                    this.CELL_SIZE - inset * 2, this.CELL_SIZE - inset * 2, this.CELL_RADIUS - inset);

                const filledBg = this.add.graphics().setDepth(2);
                filledBg.fillStyle(hexColor(CONFIG.CELL.INSET_SHADOW_COLOR), 1);
                filledBg.fillRoundedRect(x - this.CELL_SIZE / 2, y - this.CELL_SIZE / 2,
                    this.CELL_SIZE, this.CELL_SIZE, this.CELL_RADIUS);
                filledBg.fillStyle(hexColor(CONFIG.CELL.FILLED_BG_COLOR), 1);
                filledBg.fillRoundedRect(x - this.CELL_SIZE / 2 + inset, y - this.CELL_SIZE / 2 + inset,
                    this.CELL_SIZE - inset * 2, this.CELL_SIZE - inset * 2, this.CELL_RADIUS - inset);
                filledBg.setVisible(false);

                this.gridCells[row][col] = { x, y, row, col, isEmpty: true, cell: emptyCell, filledBg };
            }
        }
    }

    createCoinDisplay() {
        const W = window.innerWidth || this.cameras.main.width;
        const H = window.innerHeight || this.cameras.main.height;
        const L = this.layoutConfig;
        
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = CONFIG.CELL.GRID_PANEL_PADDING;
        const panW   = gridW + 2 * pad;
        const panH   = gridH + 2 * pad;
        
        let coinY, rightEdge;
        
        if (L.isPortrait) {
            // Portrait: above grid panel
            const panCX  = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
            const panCY  = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
            coinY = panCY - panH / 2 - 40;
            rightEdge = panCX + panW / 2;
        } else {
            // Landscape: position above grid in left half
            const panCX = L.gridLeft + L.gridWidth / 2;
            const availHeight = L.gridHeight;
            const gridTopMargin = (availHeight - gridH) / 2;
            const panCY = L.gridTop + gridTopMargin + gridH / 2;
            
            coinY = panCY - panH / 2 - 40;
            rightEdge = L.gridLeft + L.gridWidth - 20;
        }

        const iconX = rightEdge - CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2
                      - CONFIG.COIN_COUNTER.PADDING_FROM_SCREEN_RIGHT;
        this.coinIcon = this.add.image(iconX, coinY, 'coin')
            .setDisplaySize(CONFIG.COIN_COUNTER.COIN_ICON_WIDTH, CONFIG.COIN_COUNTER.COIN_ICON_HEIGHT)
            .setDepth(10);

        const textX = iconX - CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2
                      - CONFIG.COIN_COUNTER.TEXT_ICON_SPACING;
        this.coinText = this.add.text(textX, coinY, `${this.coins}`, {
            fontSize: CONFIG.COIN_COUNTER.TEXT_SIZE,
            fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.COIN_COUNTER.TEXT_COLOR,
            fontStyle: 'bold',
            stroke: CONFIG.COIN_COUNTER.TEXT_STROKE_COLOR,
            strokeThickness: CONFIG.COIN_COUNTER.TEXT_STROKE_THICKNESS,
        }).setOrigin(1, 0.5).setDepth(10);
    }

    createBatteryUnlockDisplay() {
        if (!CONFIG.BATTERY_UNLOCK_DISPLAY.DISPLAY_CROWN_PANEL) {
            this.unlockDisplayContainer = this.unlockDisplayText = this.unlockDisplayBatteryIcon = null;
            return;
        }
        
        const L = this.layoutConfig;
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = CONFIG.CELL.GRID_PANEL_PADDING;
        const panH   = gridH + 2 * pad;
        const panW   = gridW + 2 * pad;
        
        let displayY, leftEdge;
        
        if (L.isPortrait) {
            // Portrait: below grid panel
            const panCX  = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
            const panCY  = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
            displayY  = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
            leftEdge  = panCX - panW / 2;
        } else {
            // Landscape: position above grid in left half
            const availHeight = L.gridHeight;
            const gridTopMargin = (availHeight - gridH) / 2;
            const panCY = L.gridTop + gridTopMargin + gridH / 2;
            displayY = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
            leftEdge = L.gridLeft + 20;
        }

        this.unlockDisplayContainer = this.add.container(0, displayY).setDepth(10);
        const elems = [];
        let curX = leftEdge + CONFIG.BATTERY_UNLOCK_DISPLAY.PADDING_FROM_LEFT;
        const U = CONFIG.BATTERY_UNLOCK_DISPLAY;

        if (U.SHOW_CROWN_ICON) {
            const crown = this.add.image(curX + U.CROWN_ICON_SIZE / 2, 0, 'battery_crown')
                .setDisplaySize(U.CROWN_ICON_SIZE, U.CROWN_ICON_SIZE);
            elems.push(crown);
            curX += U.CROWN_ICON_SIZE + U.CROWN_BATTERY_SPACING;
        }
        if (U.SHOW_BATTERY_ICON) {
            this.unlockDisplayBatteryIcon = this.add.image(
                curX + U.BATTERY_ICON_SIZE / 2, 0,
                `battery${getBatteryIconLevel(CONFIG.BATTERY_START_LEVEL)}`)
                .setDisplaySize(U.BATTERY_ICON_SIZE, U.BATTERY_ICON_SIZE);
            elems.push(this.unlockDisplayBatteryIcon);
            curX += U.BATTERY_ICON_SIZE + U.BATTERY_TEXT_SPACING;
        } else {
            this.unlockDisplayBatteryIcon = null;
        }
        this.unlockDisplayText = this.add.text(curX, 0, '', {
            fontFamily: CONFIG.FONT_FAMILY, fontSize: U.TEXT_SIZE,
            // color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
            color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
            strokeThickness: U.TEXT_STROKE_THICKNESS,
        }).setOrigin(0, 0.5);
        elems.push(this.unlockDisplayText);
        this.unlockDisplayContainer.add(elems);
        this.updateBatteryUnlockDisplay(CONFIG.BATTERY_START_LEVEL);
    }

    updateBatteryUnlockDisplay(batteryLevel) {
        if (!this.unlockDisplayContainer || !this.unlockDisplayText) return;
        const bd = getBatteryData(batteryLevel);
        if (!bd || !bd.displayName) return;
        this.unlockDisplayText.setText(`${bd.displayName} Battery`);
        if (CONFIG.BATTERY_UNLOCK_DISPLAY.SHOW_BATTERY_ICON && this.unlockDisplayBatteryIcon) {
            this.unlockDisplayBatteryIcon.setTexture(`battery${getBatteryIconLevel(batteryLevel)}`);
        }
        this.highestUnlockedBatteryLevel = batteryLevel;
    }

    showBatteryUnlockDisplay(batteryLevel) {
        if (!this.unlockDisplayContainer) return;
        if (batteryLevel > this.highestUnlockedBatteryLevel) {
            this.updateBatteryUnlockDisplay(batteryLevel);
        }
    }

    spawnBatteryInGrid(row, col, level) {
        const cell    = this.gridCells[row][col];
        const iconLvl = getBatteryIconLevel(level);

        const draggableBg = this.add.rectangle(
            cell.x, cell.y, this.CELL_SIZE, this.CELL_SIZE,
            hexColor(CONFIG.CELL.DRAGGABLE_BG_COLOR), CONFIG.CELL.DRAGGABLE_BG_ALPHA)
            .setDepth(10)
            .setInteractive({ draggable: true, useHandCursor: true });

        const battery = this.add.image(cell.x, cell.y + CONFIG.CELL.BATTERY_Y_OFFSET, `battery${iconLvl}`)
            .setDisplaySize(CONFIG.CELL.BATTERY_DISPLAY_SIZE, CONFIG.CELL.BATTERY_DISPLAY_SIZE)
            .setDepth(11);

        const levelText = this.add.text(
            cell.x, cell.y + CONFIG.CELL.BATTERY_Y_OFFSET + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET,
            `LVL ${level}`,
            { fontSize: CONFIG.CELL.LEVEL_TEXT_SIZE, fontFamily: CONFIG.FONT_FAMILY,
              color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: 'bold' })
            .setOrigin(0.5).setDepth(12);

        const batteryData = {
            draggableBg, sprite: battery, levelText, level, row, col,
            originalX: cell.x,
            originalY: cell.y + CONFIG.CELL.BATTERY_Y_OFFSET,
            inGrid: true, inChargingSlot: false,
        };
        draggableBg.setData('batteryData', batteryData);
        this.batteries.push(batteryData);
        this.grid[row][col] = batteryData;
        cell.filledBg.setVisible(true);
        cell.isEmpty = false;
        this.playSpawnAnimation(batteryData);
        return batteryData;
    }

    playSpawnAnimation(bd) {
        const base = CONFIG.CELL.BATTERY_DISPLAY_SIZE;
        const a    = CONFIG.SPAWN_ANIMATION;
        bd.sprite.setDisplaySize(base * a.INITIAL_SCALE_X, base * a.INITIAL_SCALE_Y);
        bd.levelText.setScale(a.INITIAL_SCALE_X, a.INITIAL_SCALE_Y);
        const seq = [
            [a.STRETCH_SCALE_X, a.STRETCH_SCALE_Y, a.STRETCH_DURATION],
            [a.BOUNCE_SCALE_X,  a.BOUNCE_SCALE_Y,  a.BOUNCE_DURATION],
            [1, 1, a.SETTLE_DURATION],
        ];
        let chain = Promise.resolve();
        seq.forEach(([sx, sy, dur]) => {
            chain = chain.then(() => new Promise(res => {
                this.tweens.add({
                    targets: bd.sprite,
                    displayWidth: base * sx, displayHeight: base * sy,
                    duration: dur, ease: 'Cubic.easeOut', onComplete: res,
                });
                this.tweens.add({
                    targets: bd.levelText, scaleX: sx, scaleY: sy,
                    duration: dur, ease: 'Cubic.easeOut',
                });
            }));
        });
    }

    createButtons() {
        const W = window.innerWidth || this.cameras.main.width;
        const H = window.innerHeight || this.cameras.main.height;
        const L = this.layoutConfig;
        
        let spawnButtonX, spawnButtonY, levelUpButtonX, levelUpButtonY;
        
        if (L.isPortrait) {
            // Portrait: buttons at bottom, spawn and level-up side-by-side
            spawnButtonX = W / 2;
            spawnButtonY = H - CONFIG.BUTTON.BOTTOM_PADDING;
            levelUpButtonX = W / 2 - CONFIG.BUTTON.BUTTON_SPACING;
            levelUpButtonY = spawnButtonY;
        } else {
            // Landscape: buttons in left half, stacked vertically
            const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
            const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
            const availHeight = L.gridHeight;
            const gridTopMargin = (availHeight - gridH) / 2;
            const gridBottomY = L.gridTop + gridTopMargin + gridH + this.CELL_SIZE / 2;
            
            spawnButtonX = L.gridLeft + L.gridWidth / 2;
            spawnButtonY = gridBottomY + 30;  // Spacing below grid
            
            levelUpButtonX = spawnButtonX;
            levelUpButtonY = spawnButtonY + CONFIG.BUTTON.SPAWN_HEIGHT + 30;  // Below spawn button
        }

        // Spawn button
        const spawnBtn = this.add.container(spawnButtonX, spawnButtonY).setDepth(100);
        const spawnBg  = this.add.image(0, 0, 'button')
            .setDisplaySize(CONFIG.BUTTON.SPAWN_WIDTH + 30, CONFIG.BUTTON.SPAWN_HEIGHT + 30)
            .setInteractive({ useHandCursor: true });
        const iconLvl  = getBatteryIconLevel(this.spawnButtonLevel);
        const spawnIcon = this.add.image(CONFIG.BUTTON.BATTERY_ICON_X, CONFIG.BUTTON.BATTERY_ICON_Y,
            `battery${iconLvl}`)
            .setDisplaySize(CONFIG.BUTTON.BATTERY_ICON_WIDTH, CONFIG.BUTTON.BATTERY_ICON_HEIGHT);
        this.spawnButtonText = this.add.text(
            CONFIG.BUTTON.COIN_TEXT_X, CONFIG.BUTTON.COIN_TEXT_Y, `${this.spawnCost}`, {
                fontSize: CONFIG.BUTTON.COIN_TEXT_SIZE, fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF', fontStyle: 'bold',
            }).setOrigin(0.5);
        const spawnCoinIcon = this.add.image(CONFIG.BUTTON.COIN_ICON_X, CONFIG.BUTTON.COIN_ICON_Y, 'coin')
            .setDisplaySize(CONFIG.BUTTON.COIN_ICON_WIDTH, CONFIG.BUTTON.COIN_ICON_HEIGHT);
        spawnBtn.add([spawnBg, spawnIcon, this.spawnButtonText, spawnCoinIcon]);
        spawnBg.on('pointerdown', () => this.spawnBattery());
        this.spawnButton   = spawnBtn;
        this.spawnButtonBg = spawnBg;
        this.spawnButtonIcon = spawnIcon;

        // Level-up button
        const lvlBtn = this.add.container(levelUpButtonX, levelUpButtonY).setDepth(100);
        const lvlBg  = this.add.rectangle(0, 0,
            CONFIG.BUTTON.LEVELUP_WIDTH, CONFIG.BUTTON.LEVELUP_HEIGHT,
            hexColor(CONFIG.BUTTON.LEVELUP_COLOR))
            .setStrokeStyle(CONFIG.BUTTON.LEVELUP_BORDER_WIDTH,
                hexColor(CONFIG.BUTTON.LEVELUP_BORDER_COLOR))
            .setInteractive({ useHandCursor: true });
        const lvlTxt = this.add.text(0, 0, 'LVL UP\nALL', {
            fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY,
            align: 'center', color: '#FFFFFF', fontStyle: 'bold',
        }).setOrigin(0.5);
        lvlBtn.add([lvlBg, lvlTxt]);
        lvlBg.on('pointerdown', () => { if (this.levelUpButtonVisible) this.levelUpAll(); });
        this.levelUpButton   = lvlBtn;
        this.levelUpButtonBg = lvlBg;
        this.levelUpButton.setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonShowTime = null;

        this.time.addEvent({
            delay: 1000, callback: this.checkLevelUpTimer, callbackScope: this, loop: true,
        });
    }

    createStartOverlay() {
        const W = window.innerWidth || this.cameras.main.width;
        const H = window.innerHeight || this.cameras.main.height;
        const L = this.layoutConfig;
        
        // Use actual camera/game dimensions for the overlay rect to ensure full coverage
        const gameW = this.cameras.main.width;
        const gameH = this.cameras.main.height;
        
        const maskColor = parseInt(CONFIG.POINTER.TUTORIAL_MASK_COLOR.substring(1), 16);
        this.startOverlay = this.add.rectangle(gameW / 2, gameH / 2, gameW, gameH, maskColor,
            CONFIG.POINTER.TUTORIAL_MASK_OPACITY).setAlpha(0).setDepth(99);

        // Position pointer based on spawn button location
        let pointerX = this.spawnButton.x;
        const pY = this.spawnButton.y + CONFIG.POINTER.OFFSET_Y;
        
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pCont = this.add.container(pointerX, pY).setAlpha(0).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pCont.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pCont.add(fp);
        this.startPointer = pCont;

        this.time.delayedCall(CONFIG.POINTER.TUTORIAL_START_DELAY, () => {
            if (!this.startOverlay || !pCont.active) return;
            this.tweens.add({
                targets: this.startOverlay, alpha: 1,
                duration: CONFIG.POINTER.TUTORIAL_FADE_DURATION, ease: 'Linear',
                onComplete: () => {
                    if (!pCont.active) return;
                    pCont.setAlpha(1);
                    this.tweens.add({
                        targets: pCont,
                        y: pY - CONFIG.POINTER.ANIMATION_MOVE_UP,
                        scaleX: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        scaleY: CONFIG.POINTER.SCALE * CONFIG.POINTER.ANIMATION_SCALE_DOWN,
                        duration: CONFIG.POINTER.ANIMATION_DURATION,
                        yoyo: CONFIG.POINTER.ANIMATION_YOYO,
                        repeat: CONFIG.POINTER.ANIMATION_REPEAT,
                    });
                },
            });
        });
    }

    removeStartOverlay() {
        if (!this.startOverlay) return;
        this.startOverlay.destroy();
        if (this.startPointer) this.startPointer.destroy();
        this.startOverlay = null;
        this.hasStartedPlaying = true;
        this.levelUpTimer = this.time.now;
        this.firstLevelUpTimer = true;
    }

    checkAndShowMergeTutorial() {
        if (!this.mergeTutorialShown && this.batteries.length === 2 && !this.mergePointer) {
            this.createMergeTutorial();
        }
    }

    createMergeTutorial() {
        const x1 = this.gridStartX;
        const y1 = this.gridStartY;
        const x2 = this.gridStartX + (this.CELL_SIZE + this.CELL_GAP);
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pc = this.add.container(x1, y1).setDepth(102);
        for (let a = 0; a < 360; a += 45) {
            const rad = a * Math.PI / 180;
            const sc  = this.add.image(
                Math.cos(rad) * CONFIG.POINTER.STROKE_WIDTH,
                Math.sin(rad) * CONFIG.POINTER.STROKE_WIDTH, 'point')
                .setScale(CONFIG.POINTER.SCALE).setTint(strokeColor).setOrigin(0.5, 0);
            pc.add(sc);
        }
        const fp = this.add.image(0, 0, 'point')
            .setScale(CONFIG.POINTER.SCALE).setTint(fillColor).setOrigin(0.5, 0);
        pc.add(fp);
        this.tweens.add({
            targets: pc, x: x2,
            duration: CONFIG.MERGE_TUTORIAL.ANIMATION_DURATION,
            ease: CONFIG.MERGE_TUTORIAL.ANIMATION_EASE,
            yoyo: false, repeat: -1, repeatDelay: 200,
        });
        this.mergePointer = pc;
    }

    removeMergeTutorial() {
        if (this.mergePointer) {
            this.mergePointer.destroy();
            this.mergePointer = null;
            this.mergeTutorialShown = true;
        }
    }

    spawnBattery() {
        if (this.isWatchingAd) return;  // Block spawning during ad
        if (this.coins < this.spawnCost) return;
        let emptyCell = null;
        outer: for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                if (!this.grid[row][col]) { emptyCell = { row, col }; break outer; }
            }
        }
        if (!emptyCell) return;
        this.coins -= this.spawnCost;
        this.updateCoinDisplay();
        this.spawnBatteryInGrid(emptyCell.row, emptyCell.col, this.spawnButtonLevel);
        if (this.startOverlay) this.removeStartOverlay();
        this.checkAndShowMergeTutorial();
        this.updateSpawnButton();
    }

    updateSpawnButton() {
        if (this.highestBatteryLevel >= 9) {
            const nl = this.highestBatteryLevel - 7;
            if (nl > this.spawnButtonLevel) {
                this.spawnButtonLevel = nl;
                this.spawnCost = nl * 10;
                this.spawnButtonText.setText(`${this.spawnCost}`);
                this.spawnButtonIcon.setTexture(`battery${getBatteryIconLevel(nl)}`);
            }
        }
        if (this.coins < this.spawnCost) {
            this.spawnButtonBg.setTint(0x888888).disableInteractive();
        } else {
            this.spawnButtonBg.setTint(0xffffff).setInteractive({ useHandCursor: true });
        }
    }

    // ================================================================
    // DRAG / DROP
    // ================================================================
    onDragStart(pointer, gameObject) {
        if (this.isWatchingAd) return;  // Block dragging during ad
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        this.draggingBattery = bd;

        if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.chargeRateText.setVisible(false);
            p.chargeRateBolt.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
        if (bd.draggableBg) bd.draggableBg.setDepth(10000);
        bd.sprite.setDepth(10001);
        bd.levelText.setDepth(10002);
        if (this.startOverlay) this.removeStartOverlay();
    }

    onDrag(pointer, gameObject, dragX, dragY) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        if (bd.draggableBg) { bd.draggableBg.x = dragX; bd.draggableBg.y = dragY; }
        bd.sprite.setPosition(dragX, dragY);
        bd.levelText.setPosition(dragX, dragY + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET);
        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            const b  = new Phaser.Geom.Rectangle(
                cd.x - this.CELL_SIZE / 2, cd.y - this.CELL_SIZE / 2,
                this.CELL_SIZE, this.CELL_SIZE);
            cd.filledBg.setVisible(Phaser.Geom.Rectangle.Contains(b, dragX, dragY));
        }
    }

    onDragEnd(pointer, gameObject) {
        const bd = gameObject.getData('batteryData');
        if (!bd) return;
        const dx = bd.sprite.x;
        const dy = bd.sprite.y;

        // Check platform slots first
        for (let i = 0; i < this.platforms.length; i++) {
            const p    = this.platforms[i];
            const half = p.slotSize / 2;
            if (Math.abs(dx - p.slotX) <= half && Math.abs(dy - p.slotY) <= half) {
                this.handleDropOnPlatformSlot(i, bd);
                this.draggingBattery = null;
                return;
            }
        }

        // Check grid cells
        for (let row = 0; row < this.GRID_ROWS; row++) {
            for (let col = 0; col < this.GRID_COLS; col++) {
                const cd = this.gridCells[row][col];
                if (Math.abs(dx - cd.x) <= this.CELL_SIZE / 2 &&
                    Math.abs(dy - cd.y) <= this.CELL_SIZE / 2) {
                    this.handleDrop(bd, { row, col, cellData: cd });
                    this.draggingBattery = null;
                    return;
                }
            }
        }
        this.returnBatteryToPosition(bd);
        this.draggingBattery = null;
    }

    handleDropOnPlatformSlot(slotIndex, bd) {
        const slot = this.chargingSlots[slotIndex];
        if (slot === null) {
            this.moveBatteryToSlot(bd, slotIndex);
        } else if (bd.inChargingSlot && bd.slotIndex === slotIndex) {
            this.returnBatteryToPosition(bd);
        } else if (slot.batteryData.level === bd.level) {
            this.mergeBatteriesInSlot(bd, slot.batteryData, slotIndex);
        } else {
            this.swapBatteryWithSlot(bd, slot.batteryData, slotIndex);
        }
    }

    handleDrop(bd, target) {
        const tBat = this.grid[target.row][target.col];
        if (!tBat)              this.moveBattery(bd, target.row, target.col);
        else if (tBat === bd)   this.returnBatteryToPosition(bd);
        else if (tBat.level === bd.level) this.mergeBatteries(bd, tBat, target.row, target.col);
        else                    this.swapBatteries(bd, tBat);
    }

    // ================================================================
    // BATTERY OPERATIONS
    // ================================================================
    _clearBatterySource(bd) {
        if (bd.inGrid) {
            this.grid[bd.row][bd.col] = null;
            this.gridCells[bd.row][bd.col].filledBg.setVisible(false);
            this.gridCells[bd.row][bd.col].isEmpty = true;
        } else if (bd.inChargingSlot) {
            const p = this.platforms[bd.slotIndex];
            this.chargingSlots[bd.slotIndex] = null;
            p.slotBg.setVisible(true);
            p.slotBgFilled.setVisible(false);
            p.batterySprite = p.batteryLevelText = null;
        }
    }

    moveBattery(bd, newRow, newCol) {
        this._clearBatterySource(bd);
        bd.row  = newRow; bd.col = newCol;
        bd.inGrid = true; bd.inChargingSlot = false;
        this.grid[newRow][newCol] = bd;
        if (!this.batteries.includes(bd)) this.batteries.push(bd);
        const cd = this.gridCells[newRow][newCol];
        bd.originalX = cd.x;
        bd.originalY = cd.y + CONFIG.CELL.BATTERY_Y_OFFSET;
        this.returnBatteryToPosition(bd);
        cd.filledBg.setVisible(true);
        cd.isEmpty = false;
    }

    mergeBatteries(dragged, target, tRow, tCol) {
        if (this.mergePointer) this.removeMergeTutorial();
        this.removeBattery(dragged);
        this.removeBattery(target);
        const newLevel = target.level + 1;
        this.spawnBatteryInGrid(tRow, tCol, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
        }
        this.showBatteryUnlockDisplay(newLevel);
        this.createMergeEffect(this.gridCells[tRow][tCol].x, this.gridCells[tRow][tCol].y);
    }

    swapBatteries(b1, b2) {
        const r1 = b1.row, c1 = b1.col, r2 = b2.row, c2 = b2.col;
        this.grid[r1][c1] = b2; this.grid[r2][c2] = b1;
        b1.row = r2; b1.col = c2;
        b1.originalX = this.gridCells[r2][c2].x;
        b1.originalY = this.gridCells[r2][c2].y + CONFIG.CELL.BATTERY_Y_OFFSET;
        b2.row = r1; b2.col = c1;
        b2.originalX = this.gridCells[r1][c1].x;
        b2.originalY = this.gridCells[r1][c1].y + CONFIG.CELL.BATTERY_Y_OFFSET;
        this.returnBatteryToPosition(b1);
        this.returnBatteryToPosition(b2);
    }

    moveBatteryToSlot(bd, slotIndex) {
        if (bd.inGrid) {
            this.removeBattery(bd);
        } else if (bd.inChargingSlot) {
            const oldSI = bd.slotIndex;
            const oldP  = this.platforms[oldSI];
            this.chargingSlots[oldSI] = null;
            oldP.slotBg.setVisible(true);
            oldP.slotBgFilled.setVisible(false);
            oldP.chargeRateText.setVisible(false);
            oldP.chargeRateBolt.setVisible(false);
            oldP.batterySprite = oldP.batteryLevelText = null;
            if (bd.draggableBg) { bd.draggableBg.destroy(); bd.draggableBg = null; }
            if (bd.sprite)    bd.sprite.destroy();
            if (bd.levelText) bd.levelText.destroy();
        }
        this.addBatteryToSlot(slotIndex, bd.level);
    }

    swapBatteryWithSlot(b1, b2, slotIndex) {
        if (b1.inGrid) {
            const r1 = b1.row, c1 = b1.col;
            const lv2 = b2.level;
            this.removeBattery(b1);
            const p2 = this.platforms[slotIndex];
            this.chargingSlots[slotIndex] = null;
            p2.slotBg.setVisible(true);
            p2.slotBgFilled.setVisible(false);
            p2.chargeRateText.setVisible(false);
            p2.chargeRateBolt.setVisible(false);
            if (b2.draggableBg) { b2.draggableBg.destroy(); b2.draggableBg = null; }
            if (b2.sprite)    b2.sprite.destroy();
            if (b2.levelText) b2.levelText.destroy();
            p2.batterySprite = p2.batteryLevelText = null;
            this.spawnBatteryInGrid(r1, c1, lv2);
            this.addBatteryToSlot(slotIndex, b1.level);
        } else if (b1.inChargingSlot) {
            const si1 = b1.slotIndex, si2 = slotIndex;
            const lv1 = b1.level, lv2 = b2.level;
            [b1, b2].forEach(b => {
                if (b.draggableBg) { b.draggableBg.destroy(); b.draggableBg = null; }
                if (b.sprite)    b.sprite.destroy();
                if (b.levelText) b.levelText.destroy();
            });
            const p1 = this.platforms[si1], p2 = this.platforms[si2];
            this.chargingSlots[si1] = this.chargingSlots[si2] = null;
            p1.batterySprite = p1.batteryLevelText = null;
            p2.batterySprite = p2.batteryLevelText = null;
            p1.slotBg.setVisible(true); p1.slotBgFilled.setVisible(false);
            p2.slotBg.setVisible(true); p2.slotBgFilled.setVisible(false);
            p1.chargeRateText.setVisible(false); p1.chargeRateBolt.setVisible(false);
            p2.chargeRateText.setVisible(false); p2.chargeRateBolt.setVisible(false);
            this.addBatteryToSlot(si1, lv2);
            this.addBatteryToSlot(si2, lv1);
        }
    }

    mergeBatteriesInSlot(dragged, target, targetSlotIndex) {
        if (this.mergePointer) this.removeMergeTutorial();
        if (dragged.inGrid) {
            this.removeBattery(dragged);
        } else if (dragged.inChargingSlot) {
            const si = dragged.slotIndex;
            const op = this.platforms[si];
            this.chargingSlots[si] = null;
            if (dragged.draggableBg) { dragged.draggableBg.destroy(); dragged.draggableBg = null; }
            if (dragged.sprite)    dragged.sprite.destroy();
            if (dragged.levelText) dragged.levelText.destroy();
            op.batterySprite = op.batteryLevelText = null;
            op.slotBg.setVisible(true); op.slotBgFilled.setVisible(false);
            op.chargeRateText.setVisible(false); op.chargeRateBolt.setVisible(false);
        }
        const tp = this.platforms[targetSlotIndex];
        this.chargingSlots[targetSlotIndex] = null;
        if (target.draggableBg) { target.draggableBg.destroy(); target.draggableBg = null; }
        if (target.sprite)    target.sprite.destroy();
        if (target.levelText) target.levelText.destroy();
        tp.batterySprite = tp.batteryLevelText = null;
        tp.slotBg.setVisible(true); tp.slotBgFilled.setVisible(false);
        tp.chargeRateText.setVisible(false); tp.chargeRateBolt.setVisible(false);

        const newLevel = target.level + 1;
        this.addBatteryToSlot(targetSlotIndex, newLevel);
        if (newLevel > this.highestBatteryLevel) {
            this.highestBatteryLevel = newLevel; this.updateSpawnButton();
        }
        this.showBatteryUnlockDisplay(newLevel);
        this.createMergeEffect(tp.slotX, tp.slotY);
    }

    removeBattery(bd) {
        this._clearBatterySource(bd);
        const idx = this.batteries.indexOf(bd);
        if (idx > -1) this.batteries.splice(idx, 1);
        if (bd.draggableBg) bd.draggableBg.destroy();
        bd.sprite.destroy();
        bd.levelText.destroy();
    }

    returnBatteryToPosition(bd) {
        if (bd.draggableBg) bd.draggableBg.setDepth(10);
        bd.sprite.setDepth(11);
        bd.levelText.setDepth(12);

        if (bd.inChargingSlot) {
            const p  = this.platforms[bd.slotIndex];
            const cpm = getBatteryChargeValue(bd.level);
            this.chargingSlots[bd.slotIndex] = { level: bd.level, chargePerMinute: cpm, batteryData: bd };
            p.slotBg.setVisible(false);
            p.slotBgFilled.setVisible(true);
            p.batterySprite    = bd.sprite;
            p.batteryLevelText = bd.levelText;
            p.chargeRateText.setText(`${cpm}`).setVisible(true);
            p.chargeRateBolt.setVisible(true);
        }

        if (bd.inGrid) {
            const cd = this.gridCells[bd.row][bd.col];
            cd.filledBg.setVisible(true);
            cd.isEmpty = false;
        }

        const tY = bd.originalY + CONFIG.CELL.LEVEL_TEXT_Y_OFFSET;
        if (bd.draggableBg) {
            this.tweens.add({
                targets: bd.draggableBg,
                x: bd.originalX,
                y: bd.originalY - CONFIG.CELL.BATTERY_Y_OFFSET,
                duration: 200, ease: 'Back.easeOut',
            });
        }
        this.tweens.add({ targets: bd.sprite,    x: bd.originalX, y: bd.originalY, duration: 200, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bd.levelText, x: bd.originalX, y: tY,           duration: 200, ease: 'Back.easeOut' });
    }

    createMergeEffect(x, y) {
        const c = this.add.circle(x, y, 50, 0xFFFFFF, 0.8).setDepth(20);
        this.tweens.add({ targets: c, scaleX: 2, scaleY: 2, alpha: 0, duration: 300, onComplete: () => c.destroy() });
    }

    // ================================================================
    // LEVEL-UP TIMER
    // ================================================================
    checkLevelUpTimer() {
        if (!this.hasStartedPlaying) return;
        const now = this.time.now;
        if (this.levelUpButtonVisible && this.levelUpButtonShowTime) {
            if (now - this.levelUpButtonShowTime >= 30000) {
                this.tweens.killTweensOf(this.levelUpButton);
                this.levelUpButton.setScale(1).setVisible(false);
                this.levelUpButtonVisible = false;
                this.levelUpButtonBg.setAlpha(0.5);
                this.levelUpTimer = now;
            }
        } else if (!this.levelUpButtonVisible && this.levelUpTimer) {
            const wait = this.firstLevelUpTimer ? 20000 : 30000;
            if (now - this.levelUpTimer >= wait) {
                this.levelUpButton.setVisible(true);
                this.levelUpButtonVisible = true;
                this.levelUpButtonBg.setAlpha(1);
                this.levelUpButtonShowTime = now;
                this.firstLevelUpTimer = false;
                this.tweens.add({
                    targets: this.levelUpButton,
                    scaleX: 1.05, scaleY: 1.05, duration: 300,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
                });
            }
        }
    }

    levelUpAll() {
        if (this.isWatchingAd) return;  // Prevent multiple ad triggers
        // Show mock ad before upgrading
        this.showMockAd(() => {
            this.performLevelUpAll();
        });
    }

    showMockAd(onComplete) {
        this.isWatchingAd = true;  // Block all interactions during ad
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const A = CONFIG.AD;
        
        // Create overlay
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 
            parseInt(A.OVERLAY_COLOR.substring(1), 16), A.OVERLAY_ALPHA)
            .setDepth(10000)
            .setInteractive();  // Block clicks from passing through overlay
        
        // Create countdown timer text in center
        const timerText = this.add.text(W / 2, H / 2, `${A.DURATION}`, {
            fontSize: A.TIMER_TEXT_SIZE,
            fontFamily: CONFIG.FONT_FAMILY,
            color: A.TIMER_TEXT_COLOR,
            fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(10001);
        
        // Countdown from AD.DURATION to 0
        let timeLeft = A.DURATION;
        const countdownEvent = this.time.addEvent({
            delay: 1000,
            repeat: A.DURATION,
            callback: () => {
                timeLeft--;
                if (timeLeft > 0) {
                    timerText.setText(`${timeLeft}`);
                } else {
                    // Ad complete - destroy immediately and upgrade
                    countdownEvent.remove();  // Stop the countdown to prevent multiple calls
                    overlay.destroy();
                    timerText.destroy();
                    this.isWatchingAd = false;  // Re-enable interactions
                    onComplete();  // Instant upgrade after ad
                }
            }
        });
    }

    performLevelUpAll() {
        for (const bd of this.batteries) {
            if (bd.inGrid) {
                bd.level += 1;
                bd.levelText.setText(`LVL ${bd.level}`);
                bd.sprite.setTexture(`battery${getBatteryIconLevel(bd.level)}`);
                if (bd.level > this.highestBatteryLevel) this.highestBatteryLevel = bd.level;
            }
        }
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (slot) {
                const p = this.platforms[i];
                slot.level += 1;
                slot.chargePerMinute = getBatteryChargeValue(slot.level);
                if (slot.batteryData) slot.batteryData.level = slot.level;
                if (p.batterySprite)    p.batterySprite.setTexture(`battery${getBatteryIconLevel(slot.level)}`);
                if (p.batteryLevelText) p.batteryLevelText.setText(`LVL ${slot.level}`);
                p.chargeRateText.setText(`${slot.chargePerMinute}`);
            }
        }
        this.updateSpawnButton();
        if (this.highestBatteryLevel > this.highestUnlockedBatteryLevel) {
            this.showBatteryUnlockDisplay(this.highestBatteryLevel);
        }
        this.tweens.killTweensOf(this.levelUpButton);
        this.levelUpButton.setScale(1).setVisible(false);
        this.levelUpButtonVisible = false;
        this.levelUpButtonBg.setAlpha(0.5);
        this.levelUpTimer = this.time.now;
    }

    // ================================================================
    // COIN DISPLAY
    // ================================================================
    updateCoinDisplay() {
        this.coinText.setText(`${this.coins}`);
        const iconX = this.coinText.x + this.coinText.width / 2
            + CONFIG.COIN_COUNTER.TEXT_ICON_SPACING
            + CONFIG.COIN_COUNTER.COIN_ICON_WIDTH / 2;
        this.coinIcon.setX(iconX);
        this.updateSpawnButton();
    }

    animateCoinReward(startX, startY, amount, delayBeforeFly = 0, platform = null) {
        const C   = CONFIG.COIN_REWARD_ANIMATION;
        const tX  = this.coinIcon.x, tY = this.coinIcon.y;
        let done  = 0;
        
        // Spawn all coins immediately at the gadget position behind the sprite
        const coins = [];
        for (let i = 0; i < C.COIN_COUNT; i++) {
            const coin = this.add.image(startX, startY - i * C.INITIAL_STACK_OFFSET, 'coin')
                .setDisplaySize(C.REWARD_COIN_SIZE, C.REWARD_COIN_SIZE)
                .setDepth(2.5 + i * 0.01);  // Behind gadget sprite (which is at depth 4)
            coins.push(coin);
        }
        
        // Wait for sprite to disappear + additional delay, then animate coins to icon
        this.time.delayedCall(delayBeforeFly, () => {
            coins.forEach((coin, i) => {
                // Set coins to high depth so they fly over everything
                coin.setDepth(100 + i);
                
                const dur = C.TOP_SPEED_DURATION * (1 + i * C.SPEED_VARIATION / (C.COIN_COUNT - 1));
                this.time.delayedCall(i * C.STAGGER_DELAY, () => {
                    if (!coin.scene) return; // Already destroyed
                    this.tweens.add({
                        targets: coin, x: tX, y: tY,
                        displayWidth: C.REWARD_COIN_SIZE * 0.6, displayHeight: C.REWARD_COIN_SIZE * 0.6,
                        duration: dur, ease: C.EASE,
                        onComplete: () => {
                            coin.destroy();
                            if (++done === C.COIN_COUNT) { 
                                this.coins += amount; 
                                this.updateCoinDisplay();
                                // Mark coin animation complete for this platform
                                if (platform) platform.coinAnimationComplete = true;
                            }
                        },
                    });
                });
            });
        });
    }

    // ================================================================
    // UPDATE
    // ================================================================
    update() { /* driven by events */ }
}

// ================================================================
// PHASER CONFIG + BOOT
// ================================================================
const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

const GAME_WIDTH = isMobile ? 720 : 1280;
const GAME_HEIGHT = isMobile ? 1280 : 720;
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#7B68EE',
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
        resolution: window.devicePixelRatio || 1,
        expandParent: true,
    },
    render: { antialias: true, pixelArt: false },
};

if (typeof window !== 'undefined' && !window.__LEVEL_VIEWER__) {
    initBatteryImagePaths().then(() => {
        const indicator = document.getElementById('loading-indicator');
        if (indicator) indicator.style.display = 'none';
        new Phaser.Game(config);
    });
}
