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
        this.load.json('levels', 'levels.json');
        this.load.on('filecomplete-json-levels', (_key, _type, data) => {
            (data.gadgets || []).forEach(g => {
                this.load.image(`gadget_${g.name}`, `graphics/gadgets/${g.sprite}`);
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

            // Stripe
            const stripe = this.add.graphics();
            stripe.fillStyle(hexColor(P.STRIPE_COLOR), P.STRIPE_ALPHA);
            stripe.fillRoundedRect(0, cy - P.STRIPE_HEIGHT / 2, P.STRIPE_WIDTH, P.STRIPE_HEIGHT, 6);
            stripe.setDepth(2);

            // Slot backgrounds
            const slotBg = this.add.graphics();
            this._drawSlot(slotBg, sx, cy, ssz, false);
            slotBg.setDepth(3);

            const slotBgFilled = this.add.graphics();
            this._drawSlot(slotBgFilled, sx, cy, ssz, true);
            slotBgFilled.setDepth(3);
            slotBgFilled.setVisible(false);

            // Slot label
            const slotLabel = this.add.text(sx, cy + ssz / 2 + 12, 'SLOT', {
                fontSize: '14px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFD700', fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setDepth(3);

            this.platforms.push({
                index: i,
                centerY: cy,
                stripe,
                slotX: sx, slotY: cy, slotSize: ssz,
                slotBg, slotBgFilled, slotLabel,
                batterySprite: null, batteryLevelText: null,
                gadgetX: P.GADGET_X,
                gadgetSprite: null,
                gadgetCapacity: 0, gadgetCurrentCharge: 0,
                gadgetCapacityText: null,
                gadgetChargeBarBg: null, gadgetChargeBarFill: null,
                gadgetChargeText: null,
                gadgetChargeBarY: 0,
                gadgetChargeBarW: P.CHARGE_BAR_WIDTH,
                gadgetChargeBarH: P.CHARGE_BAR_HEIGHT,
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

    loadGadgets(gadgetData) {
        this.clearGadgets();
        const P = CONFIG.PLATFORM;
        for (let i = 0; i < 3; i++) {
            const p   = this.platforms[i];
            const cy  = p.centerY;
            const gx  = P.GADGET_X;
            const gsz = P.GADGET_SIZE;
            const capacity = gadgetData.capacity[i];
            const barW = P.CHARGE_BAR_WIDTH;
            const barH = P.CHARGE_BAR_HEIGHT;
            const barY = cy + gsz / 2 + barH / 2 + 8;

            const capText = this.add.text(gx, cy - gsz / 2 - 12, `${capacity}`, {
                fontSize: '20px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF', fontStyle: 'bold',
                stroke: '#000000', strokeThickness: 3,
            }).setOrigin(0.5, 1).setDepth(5);

            const key = `gadget_${gadgetData.name}`;
            const gadgetSprite = this.textures.exists(key)
                ? this.add.image(gx, cy, key)
                : this.add.rectangle(gx, cy, gsz, gsz, 0x888888);
            if (gadgetSprite.setDisplaySize) gadgetSprite.setDisplaySize(gsz, gsz);
            gadgetSprite.setDepth(4);

            const barBg = this.add.graphics();
            barBg.fillStyle(0x333333, 0.8);
            barBg.fillRoundedRect(gx - barW / 2, barY - barH / 2, barW, barH, barH / 2);
            barBg.setDepth(4);

            const barFill = this.add.graphics();
            barFill.setDepth(5);

            const chargeText = this.add.text(gx, barY + barH / 2 + 6, `0 / ${capacity}`, {
                fontSize: '13px', fontFamily: CONFIG.FONT_FAMILY,
                color: '#FFFFFF', stroke: '#000000', strokeThickness: 2,
            }).setOrigin(0.5, 0).setDepth(5);

            p.gadgetSprite          = gadgetSprite;
            p.gadgetCapacity        = capacity;
            p.gadgetCurrentCharge   = 0;
            p.gadgetCapacityText    = capText;
            p.gadgetChargeBarBg     = barBg;
            p.gadgetChargeBarFill   = barFill;
            p.gadgetChargeText      = chargeText;
            p.gadgetChargeBarY      = barY;
            p.isDefeated            = false;
        }
    }

    clearGadgets() {
        for (const p of this.platforms) {
            [p.gadgetSprite, p.gadgetCapacityText, p.gadgetChargeBarBg,
             p.gadgetChargeBarFill, p.gadgetChargeText].forEach(o => { if (o) o.destroy(); });
            p.gadgetSprite = p.gadgetCapacityText = p.gadgetChargeBarBg =
            p.gadgetChargeBarFill = p.gadgetChargeText = null;
            p.gadgetCurrentCharge = 0;
            p.isDefeated = false;
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

        const batterySprite = this.add.image(p.slotX, p.slotY + yOff, `battery${batteryIconLevel}`);
        batterySprite.setDisplaySize(CONFIG.CELL.BATTERY_DISPLAY_SIZE, CONFIG.CELL.BATTERY_DISPLAY_SIZE);
        batterySprite.setDepth(6);
        batterySprite.setInteractive({
            hitArea: new Phaser.Geom.Rectangle(-65, -65, 130, 130),
            hitAreaCallback: Phaser.Geom.Rectangle.Contains,
            draggable: true, useHandCursor: true,
        });

        const levelText = this.add.text(p.slotX, p.slotY + yOff + tOff, `LVL ${level}`, {
            fontSize: CONFIG.CELL.LEVEL_TEXT_SIZE, fontFamily: CONFIG.FONT_FAMILY,
            color: CONFIG.CELL.LEVEL_TEXT_COLOR, fontStyle: 'bold',
        }).setOrigin(0.5).setDepth(7);

        p.slotBg.setVisible(false);
        p.slotBgFilled.setVisible(true);
        p.batterySprite    = batterySprite;
        p.batteryLevelText = levelText;

        const batteryData = {
            sprite: batterySprite, levelText,
            draggableBg: null, level,
            slotIndex,
            originalX: p.slotX,
            originalY: p.slotY + yOff,
            inGrid: false, inChargingSlot: true,
        };
        batterySprite.setData('batteryData', batteryData);
        this.chargingSlots[slotIndex] = { level, chargePerMinute, batteryData };
    }

    removeBatteryFromSlot(slotIndex) {
        if (slotIndex < 0 || slotIndex >= 3) return;
        if (!this.chargingSlots[slotIndex]) return;
        const p = this.platforms[slotIndex];
        if (p.batterySprite)    p.batterySprite.destroy();
        if (p.batteryLevelText) p.batteryLevelText.destroy();
        p.batterySprite = p.batteryLevelText = null;
        p.slotBg.setVisible(true);
        p.slotBgFilled.setVisible(false);
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

            if (p.gadgetSprite) {
                this.tweens.add({ targets: p.gadgetSprite, alpha: 0.3, duration: 80, yoyo: true });
            }
            if (p.gadgetCurrentCharge >= p.gadgetCapacity) {
                this.explodeGadget(p);
            }
        }
    }

    updateGadgetChargeBar(p) {
        if (!p.gadgetChargeBarFill) return;
        const progress = Math.min(p.gadgetCurrentCharge / p.gadgetCapacity, 1);
        const barX = p.gadgetX - p.gadgetChargeBarW / 2;
        const barY = p.gadgetChargeBarY - p.gadgetChargeBarH / 2;
        const color = progress < 0.5 ? 0x00E676 : progress < 0.8 ? 0xFFD600 : 0xFF5252;
        p.gadgetChargeBarFill.clear();
        p.gadgetChargeBarFill.fillStyle(color, 1);
        p.gadgetChargeBarFill.fillRoundedRect(
            barX, barY, p.gadgetChargeBarW * progress, p.gadgetChargeBarH,
            p.gadgetChargeBarH / 2);
        if (p.gadgetChargeText) {
            p.gadgetChargeText.setText(`${Math.floor(p.gadgetCurrentCharge)} / ${p.gadgetCapacity}`);
        }
    }

    explodeGadget(p) {
        if (p.isDefeated) return;
        p.isDefeated = true;
        const ex = p.gadgetSprite ? p.gadgetSprite.x : p.gadgetX;
        const ey = p.gadgetSprite ? p.gadgetSprite.y : p.centerY;

        if (p.gadgetSprite) {
            this.tweens.add({
                targets: p.gadgetSprite, scaleX: 2.5, scaleY: 2.5, alpha: 0,
                duration: 400, ease: 'Power2',
                onComplete: () => { if (p.gadgetSprite) { p.gadgetSprite.destroy(); p.gadgetSprite = null; } },
            });
        }

        // Burst circle
        const burst = this.add.circle(ex, ey, 10, 0xFFFF44, 0.9).setDepth(20);
        this.tweens.add({
            targets: burst, radius: 90, alpha: 0, duration: 450, ease: 'Power2',
            onComplete: () => burst.destroy(),
        });

        // Fade supporting UI
        const toFade = [p.gadgetCapacityText, p.gadgetChargeBarBg,
                        p.gadgetChargeBarFill, p.gadgetChargeText].filter(Boolean);
        if (toFade.length) {
            this.tweens.add({
                targets: toFade, alpha: 0, duration: 350,
                onComplete: () => {
                    toFade.forEach(o => o.destroy());
                    p.gadgetCapacityText = p.gadgetChargeBarBg =
                    p.gadgetChargeBarFill = p.gadgetChargeText = null;
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
            oldP.batterySprite = oldP.batteryLevelText = null;
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
            if (b2.sprite)    b2.sprite.destroy();
            if (b2.levelText) b2.levelText.destroy();
            p2.batterySprite = p2.batteryLevelText = null;
            this.spawnBatteryInGrid(r1, c1, lv2);
            this.addBatteryToSlot(slotIndex, b1.level);
        } else if (b1.inChargingSlot) {
            const si1 = b1.slotIndex, si2 = slotIndex;
            const lv1 = b1.level, lv2 = b2.level;
            [b1, b2].forEach(b => {
                if (b.sprite)    b.sprite.destroy();
                if (b.levelText) b.levelText.destroy();
            });
            const p1 = this.platforms[si1], p2 = this.platforms[si2];
            this.chargingSlots[si1] = this.chargingSlots[si2] = null;
            p1.batterySprite = p1.batteryLevelText = null;
            p2.batterySprite = p2.batteryLevelText = null;
            p1.slotBg.setVisible(true); p1.slotBgFilled.setVisible(false);
            p2.slotBg.setVisible(true); p2.slotBgFilled.setVisible(false);
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
            if (dragged.sprite)    dragged.sprite.destroy();
            if (dragged.levelText) dragged.levelText.destroy();
            op.batterySprite = op.batteryLevelText = null;
            op.slotBg.setVisible(true); op.slotBgFilled.setVisible(false);
        }
        const tp = this.platforms[targetSlotIndex];
        this.chargingSlots[targetSlotIndex] = null;
        if (target.sprite)    target.sprite.destroy();
        if (target.levelText) target.levelText.destroy();
        tp.batterySprite = tp.batteryLevelText = null;
        tp.slotBg.setVisible(true); tp.slotBgFilled.setVisible(false);

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
