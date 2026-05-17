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

        this.CELL_SIZE  = CONFIG.CELL.SIZE;
        this.CELL_GAP   = CONFIG.CELL.GAP;
        this.CELL_RADIUS= CONFIG.CELL.RADIUS;
        this.GRID_COLS  = 3;
        this.GRID_ROWS  = 3;

        this.chargingSlots    = [null, null, null];
        this.chargingInterval = null;
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
        this.load.json('levels', 'levels.json');
        this.load.on('filecomplete-json-levels', (_key, _type, data) => {
            (data.gadgets || []).forEach(g => {
                this.load.image(`gadget_${g.name}_normal`,   `graphics/gadgets/${g.normal_sprite}`);
                this.load.image(`gadget_${g.name}_burnedout`, `graphics/gadgets/${g.burnedout_sprite}`);
            });
        });
    }

    // ================================================================
    // CREATE
    // ================================================================
    create() {
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;

        // Background
        const bgGfx = this.add.graphics();
        const sc = parseInt(CONFIG.BACKGROUND.GRADIENT_START_COLOR.substring(1), 16);
        const ec = parseInt(CONFIG.BACKGROUND.GRADIENT_END_COLOR.substring(1), 16);
        bgGfx.fillGradientStyle(sc, sc, ec, ec, 1);
        bgGfx.fillRect(0, 0, W, H);
        bgGfx.setDepth(0);

        // Load gadget data
        const levelsCache = this.cache.json.get('levels');
        this.gadgetsData = (levelsCache && levelsCache.gadgets) ? levelsCache.gadgets : [];

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
        for (let i = 0; i < 3; i++) {
            const cy  = P.Y_POSITIONS[i];
            const sx  = P.SLOT_X;
            const ssz = P.SLOT_SIZE;

            // Position each element above the stripe using its own gap config
            const slotAboveY   = cy - P.STRIPE_HEIGHT / 2 - P.SLOT_ABOVE_STRIPE - ssz / 2;
            const gadgetAboveY = cy - P.STRIPE_HEIGHT / 2 - P.GADGET_ABOVE_STRIPE - P.GADGET_SIZE / 2;

            // Stripe — plain background bar, nothing drawn on it
            const stripe = this.add.graphics();
            stripe.fillStyle(hexColor(P.STRIPE_COLOR), P.STRIPE_ALPHA);
            stripe.fillRoundedRect(P.STRIPE_X, cy - P.STRIPE_HEIGHT / 2, P.STRIPE_WIDTH, P.STRIPE_HEIGHT, 6);
            stripe.setDepth(2);

            // Slot backgrounds
            const slotBg = this.add.graphics();
            this._drawSlot(slotBg, sx, slotAboveY, ssz, false);
            slotBg.setDepth(3);

            const slotBgFilled = this.add.graphics();
            this._drawSlot(slotBgFilled, sx, slotAboveY, ssz, true);
            slotBgFilled.setDepth(3);
            slotBgFilled.setVisible(false);

            // Charge-rate label above slot (shown when a battery is present)
            const rateTextY = slotAboveY - ssz / 2 - P.CHARGE_RATE_GAP;
            const chargeRateText = this.add.text(sx - 2, rateTextY, '', {
                fontSize: '22px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFD700', fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(1, 0.5).setDepth(5).setVisible(false);

            const chargeRateBolt = this.add.image(sx + 2, rateTextY, 'bolt')
                .setDisplaySize(24, 24).setOrigin(0, 0.5).setDepth(5).setVisible(false);

            this.platforms.push({
                index: i,
                centerY: cy,
                stripe,
                slotX: sx, slotY: slotAboveY, slotSize: ssz,
                slotBg, slotBgFilled,
                chargeRateText, chargeRateBolt,
                batterySprite: null, batteryLevelText: null,
                gadgetX: P.GADGET_X, gadgetAboveY,
                gadgetSprite: null,
                gadgetCapacity: 0, gadgetCurrentCharge: 0,
                gadgetCapacityText: null, gadgetChargeText: null,
                isDefeated: false,
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
        const redThresh    = P.METER_RED_ZONE_ANGLE / P.METER_EXPLOSION_ANGLE;

        if (progress < yellowThresh) {
            // Normal range — clear any leftover tint, soft pulse on each charge tick
            p.gadgetSprite.clearTint();
            this.tweens.add({ targets: p.gadgetSprite, alpha: 0.35, duration: 80, yoyo: true });
            return;
        }

        const inRed        = progress >= redThresh;
        const redIntensity = inRed ? (progress - redThresh) / (1 - redThresh) : 0;

        // ── Tint: warm-yellow → orange → deep red ────────────────────────────
        if (inRed) {
            const g = Math.round(0x6B * (1 - redIntensity * 0.85));
            p.gadgetSprite.setTint((0xFF << 16) | (g << 8));
        } else {
            p.gadgetSprite.setTint(0xFFCC44);
        }

        // ── Flash (more violent in red zone) ─────────────────────────────────
        const flashAlpha = inRed ? 0.15 : 0.35;
        const flashDur   = inRed ? 45  : 70;
        this.tweens.add({ targets: p.gadgetSprite, alpha: flashAlpha, duration: flashDur, yoyo: true });

        // ── Shake ─────────────────────────────────────────────────────────────
        if (!p._shakeActive) {
            p._shakeActive = true;
            const shakeAmt = inRed ? 3 + redIntensity * 7 : 2;
            const shakeDur = inRed ? Math.round(55 - redIntensity * 20) : 72;
            const numSteps = inRed ? 6 : 4;
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
        if (inRed && !p._pulseActive) {
            p._pulseActive = true;
            const sz    = P.GADGET_SIZE;
            const bulge = sz * (1.05 + 0.04 * redIntensity);
            this.tweens.add({
                targets: p.gadgetSprite, displayWidth: bulge, displayHeight: bulge,
                duration: 110, ease: 'Quad.easeOut', yoyo: true,
                onComplete: () => {
                    p._pulseActive = false;
                    if (p.gadgetSprite && !p.isDefeated) p.gadgetSprite.setDisplaySize(sz, sz);
                },
            });
        }

        // ── Camera shake in red zone ──────────────────────────────────────────
        if (inRed) {
            this.cameras.main.shake(75, 0.0015 + 0.003 * redIntensity);
        }

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
        const oy = p._gadgetOriginY - P.GADGET_SIZE / 2;  // top of gadget
        const r  = P.SMOKE_RADIUS_MIN + Math.random() * (P.SMOKE_RADIUS_MAX - P.SMOKE_RADIUS_MIN);
        const sx = ox + (Math.random() - 0.5) * P.SMOKE_SPREAD_X;
        const puff = this.add.circle(sx, oy, r, P.SMOKE_COLOR, 0.45).setDepth(25);
        this.tweens.add({
            targets: puff,
            y: oy - P.SMOKE_DRIFT_Y - Math.random() * 20,
            x: sx + (Math.random() - 0.5) * 16,
            alpha: 0,
            scaleX: 2.2, scaleY: 2.2,
            duration: P.SMOKE_LIFESPAN_MS,
            ease: 'Sine.easeOut',
            onComplete: () => puff.destroy(),
        });
    }

    loadGadgets(gadgetData) {
        this.clearGadgets();
        const P = CONFIG.PLATFORM;
        for (let i = 0; i < 3; i++) {
            const p        = this.platforms[i];
            const gx       = P.GADGET_X;
            const gsz      = P.GADGET_SIZE;
            const gy       = p.gadgetAboveY;   // sits above the stripe
            const capacity = gadgetData.capacity[i];

            const capText = this.add.text(gx, gy - gsz / 2 - P.CAPACITY_TEXT_GAP, `${capacity}`, {
                fontSize: '18px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#AADDFF', fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5, 1).setDepth(5);

            const normalKey = `gadget_${gadgetData.name}_normal`;
            const gadgetSprite = this.textures.exists(normalKey)
                ? this.add.image(gx, gy, normalKey)
                : this.add.rectangle(gx, gy, gsz, gsz, 0x888888);
            gadgetSprite.setDisplaySize(gsz, gsz);
            gadgetSprite.setDepth(4);

            p.gadgetSprite        = gadgetSprite;
            p.gadgetCapacity      = capacity;
            p.gadgetCurrentCharge = 0;
            p.gadgetCapacityText  = capText;
            p.gadgetChargeText    = null;
            p.isDefeated          = false;
            p._gadgetName         = gadgetData.name;
            p._gadgetOriginX      = gx;
            p._gadgetOriginY      = gy;
            p._shakeActive        = false;
            p._pulseActive        = false;
            p.smokeTimer          = null;

            // ── Wire connection ────────────────────────────────────────────────
            const socketX    = P.SLOT_X + P.SLOT_SIZE / 2 + P.SOCKET_GAP_RIGHT;
            const socketY    = p.slotY;  // vertically centred with the slot
            // connection_height: fraction from bottom (0=bottom, 1=top), default 0.5 = centre
            // connection_left_padding: horizontal inset into gadget as fraction of width, default 0.1
            const connH      = gadgetData.connection_height      ?? 0.5;
            const connLPad   = gadgetData.connection_left_padding ?? 0.1;
            const plugEndX   = gx - gsz / 2 + connLPad * gsz; // inset from left edge
            const plugEndY   = gy + gsz / 2 - connH * gsz;    // measured from gadget bottom

            // socket behind wire; plug on top of wire; gadget (depth 4) on top of all
            const socketSprite = this.textures.exists('gadget_socket')
                ? this.add.image(socketX, socketY, 'gadget_socket').setDisplaySize(P.SOCKET_SIZE, P.SOCKET_SIZE)
                : this.add.circle(socketX, socketY, P.SOCKET_SIZE / 2, 0x556677);
            socketSprite.setDepth(3.4);

            const wireGfx = this.add.graphics().setDepth(3.55);  // over socket, under plug & gadget
            // Wire: from bottom-centre of plug icon to gadget connection point
            this._drawWire(wireGfx, socketX, socketY + P.PLUG_SIZE / 2, plugEndX, plugEndY);

            const plugSprite = this.textures.exists('gadget_plug_in')
                ? this.add.image(socketX, socketY, 'gadget_plug_in').setDisplaySize(P.PLUG_SIZE, P.PLUG_SIZE)
                : this.add.circle(socketX, socketY, P.PLUG_SIZE / 2, 0x778899);
            plugSprite.setDepth(3.7);

            p.socketSprite = socketSprite;
            p.plugSprite   = plugSprite;
            p.wireGraphics = wireGfx;

            // ── Analog meter ──────────────────────────────────────────────────
            const mpx = P.GADGET_X + P.GADGET_SIZE / 2 + P.METER_GAP + P.METER_RADIUS;
            const mpy = gy + gsz / 2 + P.METER_Y_OFFSET;

            const meterBg = this.add.graphics().setDepth(4.2);
            this._drawMeterBg(meterBg, mpx, mpy);

            // Needle: thin rect, origin at pivot (bottom-centre), initial angle -90 = far-left
            const meterNeedle = this.add.rectangle(
                mpx, mpy, 3, P.METER_RADIUS - 10, 0xF0F0F0)
                .setOrigin(0.5, 1).setAngle(-90).setDepth(4.6);

            // Pivot dot on top of everything
            const meterPivot = this.add.circle(mpx, mpy, 5, 0x223344).setDepth(4.8);

            p.meterBg     = meterBg;
            p.meterNeedle = meterNeedle;
            p.meterPivot  = meterPivot;
        }
    }

    clearGadgets() {
        for (const p of this.platforms) {
            this._stopSmoke(p);
            if (p.gadgetSprite) this.tweens.killTweensOf(p.gadgetSprite);
            if (p.meterNeedle) this.tweens.killTweensOf(p.meterNeedle);
            [p.gadgetSprite, p.gadgetCapacityText, p.gadgetChargeText,
             p.meterBg, p.meterNeedle, p.meterPivot,
             p.wireGraphics, p.socketSprite, p.plugSprite]
                .forEach(o => { if (o) o.destroy(); });
            p.gadgetSprite = p.gadgetCapacityText = p.gadgetChargeText =
            p.meterBg = p.meterNeedle = p.meterPivot = null;
            p.wireGraphics = p.socketSprite = p.plugSprite = null;
            p.gadgetCurrentCharge = 0;
            p.isDefeated = false;
            p._shakeActive = false;
            p._pulseActive = false;
            p.smokeTimer = null;
            p._smokeDelay = null;
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
        this.chargingInterval = this.time.addEvent({
            delay: 1000, callback: this.chargeCycle, callbackScope: this, loop: true,
        });
    }

    chargeCycle() {
        for (let i = 0; i < 3; i++) {
            const slot = this.chargingSlots[i];
            if (!slot) continue;
            const p = this.platforms[i];
            if (p.isDefeated || !p.gadgetSprite) continue;

            p.gadgetCurrentCharge = Math.min(
                p.gadgetCurrentCharge + slot.chargePerMinute, p.gadgetCapacity);
            this.updateGadgetChargeBar(p);
            this._applyTensionEffects(p);

            if (p.gadgetCurrentCharge >= p.gadgetCapacity) {
                this.explodeGadget(p);
            }
        }
    }

    updateGadgetChargeBar(p) {
        const P = CONFIG.PLATFORM;
        const progress = Math.min(p.gadgetCurrentCharge / p.gadgetCapacity, 1);
        if (p.gadgetCapacityText) {
            const remaining = Math.max(0, Math.ceil(p.gadgetCapacity - p.gadgetCurrentCharge));
            p.gadgetCapacityText.setText(remaining > 0 ? `${remaining}` : '');
            p.gadgetCapacityText.setAlpha(0.35 + 0.65 * (1 - progress));
        }
        this._animateMeterNeedle(p, progress * CONFIG.PLATFORM.METER_EXPLOSION_ANGLE);
    }

    explodeGadget(p) {
        if (p.isDefeated) return;
        p.isDefeated = true;
        p._shakeActive = false;
        p._pulseActive = false;
        const P  = CONFIG.PLATFORM;
        const ex = p._gadgetOriginX;
        const ey = p._gadgetOriginY;

        // Swap normal sprite → burned-out sprite
        if (p.gadgetSprite) {
            this.tweens.killTweensOf(p.gadgetSprite);
            p.gadgetSprite.clearTint();
            p.gadgetSprite.setScale(1);
            const burnedKey = `gadget_${p._gadgetName}_burnedout`;
            if (this.textures.exists(burnedKey)) {
                // Fade out normal sprite, then snap to burned image at full alpha (no fade-in overlay)
                this.tweens.add({
                    targets: p.gadgetSprite, alpha: 0, duration: 180, ease: 'Power2',
                    onComplete: () => {
                        if (!p.gadgetSprite) return;
                        this.tweens.killTweensOf(p.gadgetSprite);
                        p.gadgetSprite.setTexture(burnedKey);
                        p.gadgetSprite.clearTint();
                        p.gadgetSprite.setScale(1);
                        p.gadgetSprite.setDisplaySize(P.GADGET_SIZE, P.GADGET_SIZE);
                        p.gadgetSprite.setPosition(ex, ey);
                        p.gadgetSprite.setAlpha(1); // show directly, no fade-in
                    },
                });
            } else {
                // Fallback: darken in place
                p.gadgetSprite.clearTint();
                p.gadgetSprite.setTint(0x444444);
                p.gadgetSprite.setAlpha(1);
                p.gadgetSprite.setDisplaySize(P.GADGET_SIZE, P.GADGET_SIZE);
                p.gadgetSprite.setPosition(ex, ey);
            }
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
            this.time.delayedCall(500, () => this.advanceToNextGadget());
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
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const gridW = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const buttonY    = H - CONFIG.BUTTON.BOTTOM_PADDING;
        const gridBotY   = buttonY - CONFIG.BUTTON.SPAWN_HEIGHT / 2 - CONFIG.MERGE_GRID.PADDING_FROM_BUTTON_TOP;
        this.gridStartY  = gridBotY - gridH + this.CELL_SIZE / 2;
        this.gridStartX  = (W - gridW) / 2 + this.CELL_SIZE / 2;

        const pad  = CONFIG.CELL.GRID_PANEL_PADDING;
        const panW = gridW + 2 * pad;
        const panH = gridH + 2 * pad;
        const cx   = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const cy   = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;

        const panel = this.add.image(cx, cy, 'grid_panel');
        panel.setDisplaySize(panW, panH).setDepth(1.5);

        const inset = CONFIG.CELL.INSET_BORDER_WIDTH;
        for (let row = 0; row < this.GRID_ROWS; row++) {
            this.gridCells[row] = [];
            for (let col = 0; col < this.GRID_COLS; col++) {
                const x = this.gridStartX + col * (this.CELL_SIZE + this.CELL_GAP);
                const y = this.gridStartY + row * (this.CELL_SIZE + this.CELL_GAP);

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
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = CONFIG.CELL.GRID_PANEL_PADDING;
        const panW   = gridW + 2 * pad;
        const panH   = gridH + 2 * pad;
        const panCX  = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const panCY  = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
        const coinY  = panCY - panH / 2 - 40;
        const rightEdge = panCX + panW / 2;

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
        const gridW  = this.GRID_COLS * this.CELL_SIZE + (this.GRID_COLS - 1) * this.CELL_GAP;
        const gridH  = this.GRID_ROWS * this.CELL_SIZE + (this.GRID_ROWS - 1) * this.CELL_GAP;
        const pad    = CONFIG.CELL.GRID_PANEL_PADDING;
        const panH   = gridH + 2 * pad;
        const panW   = gridW + 2 * pad;
        const panCX  = this.gridStartX - this.CELL_SIZE / 2 + gridW / 2;
        const panCY  = this.gridStartY - this.CELL_SIZE / 2 + gridH / 2;
        const displayY  = panCY - panH / 2 - CONFIG.BATTERY_UNLOCK_DISPLAY.VERTICAL_OFFSET;
        const leftEdge  = panCX - panW / 2;

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
            color: U.TEXT_COLOR, stroke: U.TEXT_STROKE_COLOR,
            strokeThickness: U.TEXT_STROKE_THICKNESS,
        }).setOrigin(0, 0.5);
        elems.push(this.unlockDisplayText);
        this.unlockDisplayContainer.add(elems);
        this.updateBatteryUnlockDisplay(CONFIG.BATTERY_START_LEVEL);
    }

    updateBatteryUnlockDisplay(batteryLevel) {
        if (!this.unlockDisplayContainer || !this.unlockDisplayText) return;
        const bd = BATTERY_DATA.find(b => b.level === batteryLevel);
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
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const bY = H - CONFIG.BUTTON.BOTTOM_PADDING;

        // Spawn button
        const spawnBtn = this.add.container(W / 2, bY).setDepth(100);
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
        const lvlBtn = this.add.container(W / 2 - CONFIG.BUTTON.BUTTON_SPACING, bY).setDepth(100);
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
        const W = this.cameras.main.width;
        const H = this.cameras.main.height;
        const maskColor = parseInt(CONFIG.POINTER.TUTORIAL_MASK_COLOR.substring(1), 16);
        this.startOverlay = this.add.rectangle(W / 2, H / 2, W, H, maskColor,
            CONFIG.POINTER.TUTORIAL_MASK_OPACITY).setAlpha(0).setDepth(99);

        const pY = this.spawnButton.y + CONFIG.POINTER.OFFSET_Y;
        const strokeColor = parseInt(CONFIG.POINTER.STROKE_COLOR.substring(1), 16);
        const fillColor   = parseInt(CONFIG.POINTER.FILL_COLOR.substring(1), 16);
        const pCont = this.add.container(this.spawnButton.x, pY).setAlpha(0).setDepth(102);
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
            this.spawnButtonBg.clearTint().setInteractive({ useHandCursor: true });
        }
    }

    // ================================================================
    // DRAG / DROP
    // ================================================================
    onDragStart(pointer, gameObject) {
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

    animateCoinReward(startX, startY, amount) {
        const C   = CONFIG.COIN_REWARD_ANIMATION;
        const tX  = this.coinIcon.x, tY = this.coinIcon.y;
        let done  = 0;
        for (let i = 0; i < C.COIN_COUNT; i++) {
            const coin = this.add.image(startX, startY - i * C.INITIAL_STACK_OFFSET, 'coin')
                .setDisplaySize(C.REWARD_COIN_SIZE, C.REWARD_COIN_SIZE).setDepth(100 + i);
            const dur = C.TOP_SPEED_DURATION * (1 + i * C.SPEED_VARIATION / (C.COIN_COUNT - 1));
            this.time.delayedCall(i * C.STAGGER_DELAY, () => {
                this.tweens.add({
                    targets: coin, x: tX, y: tY,
                    displayWidth: C.REWARD_COIN_SIZE * 0.6, displayHeight: C.REWARD_COIN_SIZE * 0.6,
                    duration: dur, ease: C.EASE,
                    onComplete: () => {
                        coin.destroy();
                        if (++done === C.COIN_COUNT) { this.coins += amount; this.updateCoinDisplay(); }
                    },
                });
            });
        }
    }

    // ================================================================
    // UPDATE
    // ================================================================
    update() { /* driven by events */ }
}

// ================================================================
// PHASER CONFIG + BOOT
// ================================================================
const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: '#7B68EE',
    scene: [GameScene],
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: 720,
        height: 1280,
        resolution: window.devicePixelRatio || 1,
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
