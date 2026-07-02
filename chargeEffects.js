/**
 * CHARGE EFFECTS REGISTRY
 *
 * Per-gadget charging visuals that LAYER ON TOP of the shared effects (smoke,
 * tension shake, meter, explosion). A gadget picks an effect by name via the
 * `charge_effect` field in gadgetData.js, tuned by `charge_effect_params`.
 *
 * Each effect is an object with this lifecycle (all methods optional):
 *   assets(params)                       -> { logicalName: filename } extra art to preload
 *   init(scene, p, params)               -> create sprites/state on platform `p`
 *   onProgress(scene, p, progress, params) -> called every charge tick, progress 0..1
 *   onOvercharge(scene, p, params)       -> called once when capacity is reached
 *   cleanup(scene, p)                    -> destroy sprites/tweens (level change / explode)
 *
 * Effects store their objects under `p._fx` so cleanup is self-contained.
 *
 * NOTE: effects reach MAX by CONFIG.PLATFORM.OPERATING_CAPACITY_MARK (~0.882) and
 * hold steady through the overload zone up to explosion at progress = 1.0.
 */

var CHARGE_EFFECTS = {

    // No custom effect — gadget behaves exactly as before.
    none: {
        assets() { return {}; },
        init() {},
        onProgress() {},
        onOvercharge() {},
        cleanup() {}
    },

    // ── GLOW ────────────────────────────────────────────────────────────────
    // A soft additive light that fades in from 0 → max as the gadget charges.
    // Anchored to a point on the sprite (e.g. a bulb's filament) via params.anchor,
    // expressed as fractions (0..1) of the gadget's display size.
    glow: {
        // Uses a shared white glow texture preloaded globally as 'glow' (see game.js
        // preload). Override with params.texture if a gadget needs its own.
        assets(params) { return params.assets || {}; },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const texKey = params.texture
                || (params.assets && params.assets.glow ? `fx_${p._gadgetName}_glow` : 'glow');
            if (!scene.textures.exists(texKey)) return; // no art -> skip silently

            const pos = _fxAnchorPos(p, params.anchor);
            const baseW = p._gadgetDisplayWidth * (params.sizeScale ?? 1.3);

            const glow = scene.add.image(pos.x, pos.y, texKey)
                .setBlendMode(Phaser.BlendModes.ADD)
                .setDepth((p.gadgetSprite ? p.gadgetSprite.depth : 4) + 0.1)
                .setAlpha(0);
            glow.setDisplaySize(baseW, baseW); // glow art is square
            if (params.tint !== undefined) glow.setTint(params.tint);

            p._fx.glow = glow;
            p._fx.glowBaseW = baseW;
        },

        onProgress(scene, p, progress, params) {
            const glow = p._fx && p._fx.glow;
            if (!glow) return;

            const mark      = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t         = Math.min(progress / mark, 1);     // 0 → 1 by the mark, then held
            const maxAlpha  = params.maxAlpha ?? 1.0;
            const startS    = params.startScale ?? 0.85;
            const endS      = params.endScale ?? 1.15;
            const scale     = startS + (endS - startS) * t;

            scene.tweens.killTweensOf(glow);
            scene.tweens.add({
                targets: glow,
                alpha: t * maxAlpha,
                displayWidth:  p._fx.glowBaseW * scale,
                displayHeight: p._fx.glowBaseW * scale,
                duration: 450,
                ease: 'Sine.easeOut'
            });
        },

        onOvercharge(scene, p, params) {
            const glow = p._fx && p._fx.glow;
            if (!glow) return;
            // brief over-bright flash right before the explosion takes over
            scene.tweens.killTweensOf(glow);
            scene.tweens.add({
                targets: glow,
                alpha: 1.0,
                displayWidth:  p._fx.glowBaseW * 1.35,
                displayHeight: p._fx.glowBaseW * 1.35,
                duration: 120,
                ease: 'Quad.easeOut'
            });
        },

        cleanup(scene, p) {
            if (p._fx && p._fx.glow) {
                scene.tweens.killTweensOf(p._fx.glow);
                p._fx.glow.destroy();
                p._fx.glow = null;
            }
        }
    },

    // ── FAN ─────────────────────────────────────────────────────────────────
    // A table fan rendered as three stacked layers: the base gadget sprite is the
    // BODY (bottom, used for size), and this effect adds the BLADE (middle) and the
    // FRONT_GRILL (top). Both secondary layers are smaller than the body and are
    // pinned to the body's top-left at offset (0,0), scaled by the same factor the
    // body was scaled by — so they stay inside the body's rect.
    //
    // As charge goes 0 → 1 the blade spins clockwise, easing from a slow crawl up
    // to ~`maxRpm` (a real-fan-ish top speed). Body and grill stay still.
    fan: {
        assets(params) {
            return {
                blade: (params.blade || 'table_fan/blade.png'),
                grill: (params.grill || 'table_fan/front_grill.png')
            };
        },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const bladeKey = `fx_${p._gadgetName}_blade`;
            const grillKey = `fx_${p._gadgetName}_grill`;
            const bodyKey  = `gadget_${p._gadgetName}_normal`;
            if (!scene.textures.exists(bladeKey) || !scene.textures.exists(bodyKey)) return;

            // Same scale the body was drawn at (display / native), so the secondary
            // art keeps its real proportions relative to the body.
            const bodyImg = scene.textures.get(bodyKey).getSourceImage();
            const scale   = p._gadgetDisplayWidth / bodyImg.width;

            // Body's top-left in world space (body is centered on the origin).
            const bodyLeft = p._gadgetOriginX - p._gadgetDisplayWidth  / 2;
            const bodyTop  = p._gadgetOriginY - p._gadgetDisplayHeight / 2;

            const baseDepth = (p.gadgetSprite ? p.gadgetSprite.depth : 4);

            // Pin a centered-origin sprite so its top-left lands at the body's
            // top-left plus `off` (an offset in body-native pixels, scaled to match).
            const place = (key, depth, off) => {
                const img = scene.textures.get(key).getSourceImage();
                const w  = img.width  * scale;
                const h  = img.height * scale;
                const ox = (off && off.x ? off.x : 0) * scale;
                const oy = (off && off.y ? off.y : 0) * scale;
                const s = scene.add.image(bodyLeft + ox + w / 2, bodyTop + oy + h / 2, key)
                    .setDepth(depth);
                s.setDisplaySize(w, h);   // origin 0.5 → rotates about its own center
                return s;
            };

            // Blade is offset (36,41) from the body's top-left; grill stays at (0,0).
            const blade = place(bladeKey, baseDepth + 0.05, params.bladeOffset || { x: 36, y: 41 });
            const grill = scene.textures.exists(grillKey)
                ? place(grillKey, baseDepth + 0.10, params.grillOffset || { x: 0, y: 0 })
                : null;

            // Fade the layers in alongside the body's pop-in animation so they don't
            // flash at full size while the body is still growing.
            const idx = (scene.platforms ? scene.platforms.indexOf(p) : 0);
            [blade, grill].forEach(s => {
                if (!s) return;
                s.setAlpha(0);
                scene.tweens.add({
                    targets: s, alpha: 1, duration: 400,
                    delay: Math.max(0, idx) * 150, ease: 'Sine.easeOut'
                });
            });

            // Continuous clockwise spin driven by an infinite angle tween whose
            // timeScale we throttle from 0 (still) up to maxRpm as charge fills.
            // At timeScale 1 the tween does one revolution per `baseRevMs` = 60 rpm.
            const baseRevMs = 1000;
            const spin = scene.tweens.add({
                targets: blade, angle: '+=360',
                duration: baseRevMs, repeat: -1, ease: 'Linear'
            });
            spin.timeScale = 0;

            p._fx.fanBlade     = blade;
            p._fx.fanGrill     = grill;
            p._fx.fanSpin      = spin;
            p._fx.fanSpeedTween = null;
            p._fx.fanMaxRpm    = params.maxRpm ?? 700;  // top speed (lowered for readability)
            p._fx.fanRampExp   = params.rampExp ?? 2.0; // >1 = ease in (slow early, ramps later)
            p._fx.fanSmoothMs  = params.speedSmoothMs ?? 1100; // glide-to-target time
            p._fx.fanBaseRpm   = 60000 / baseRevMs;     // rpm at timeScale 1
        },

        onProgress(scene, p, progress, params) {
            const spin = p._fx && p._fx.fanSpin;
            if (!spin) return;
            const mark = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t    = Math.min(progress / mark, 1);  // 0 → 1 by the mark, then held

            // Hold still until `spinStart` of charge, then remap so the spin begins at
            // 0 right at that threshold and scales to 1 at full charge.
            const start = params.spinStart ?? 0.1;
            const tt    = start >= 1 ? 0 : Math.max(0, (t - start) / (1 - start));

            // Charge arrives in discrete per-second steps, but speed shouldn't jump.
            // Ease the curve (tt^rampExp) so the spin keeps accelerating across the
            // whole fill, then glide the spin's timeScale toward the new target like
            // Unity's Mathf.MoveTowards instead of snapping to it.
            const eased  = Math.pow(tt, p._fx.fanRampExp);
            const target = (p._fx.fanMaxRpm * eased) / p._fx.fanBaseRpm;

            if (p._fx.fanSpeedTween) p._fx.fanSpeedTween.remove();
            p._fx.fanSpeedTween = scene.tweens.add({
                targets: spin, timeScale: target,
                duration: p._fx.fanSmoothMs, ease: 'Linear'  // constant-rate, MoveTowards-like
            });
        },

        onOvercharge() { /* keep spinning until the explosion/cleanup tears it down */ },

        cleanup(scene, p) {
            if (!p._fx) return;
            if (p._fx.fanSpeedTween) { p._fx.fanSpeedTween.remove(); p._fx.fanSpeedTween = null; }
            if (p._fx.fanSpin)  { p._fx.fanSpin.remove(); p._fx.fanSpin = null; }
            if (p._fx.fanBlade) { scene.tweens.killTweensOf(p._fx.fanBlade); p._fx.fanBlade.destroy(); p._fx.fanBlade = null; }
            if (p._fx.fanGrill) { scene.tweens.killTweensOf(p._fx.fanGrill); p._fx.fanGrill.destroy(); p._fx.fanGrill = null; }
        }
    },

    // ── BLENDER ───────────────────────────────────────────────────────────────
    // A blender whose base sprite (blender.png) shows the jar, with six "swirl"
    // images (swirl1..swirl6) stacked on top — the fruit/contents being blended.
    // All six swirls share a single spinning angle (so the spin speed never jumps),
    // and we alpha-blend between consecutive swirls as charge fills: swirl1 is shown
    // near empty, swirl6 near full, cross-fading through the middle instead of hard
    // switching at every 1/6 of the phase. The spin starts slow and accelerates with
    // charge, just like a real blender ramping up.
    blender: {
        assets(params) {
            const out = {};
            for (let i = 1; i <= 6; i++) {
                out[`swirl${i}`] = (params.swirls && params.swirls[i - 1]) || `blender/swirl${i}.png`;
            }
            return out;
        },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const bodyKey = `gadget_${p._gadgetName}_normal`;
            if (!scene.textures.exists(bodyKey)) return;

            // Match the scale the body sprite was drawn at, so the swirls keep their
            // real proportions relative to the jar.
            const bodyImg = scene.textures.get(bodyKey).getSourceImage();
            const scale   = p._gadgetDisplayWidth / bodyImg.width;

            // Body's top-left in world space (body is centred on the origin). Each
            // swirl is pinned to the body's top-left at offset (0,0) — its top-left
            // lands on the jar's top-left — while still rotating about its own centre.
            const bodyLeft = p._gadgetOriginX - p._gadgetDisplayWidth  / 2;
            const bodyTop  = p._gadgetOriginY - p._gadgetDisplayHeight / 2;
            const baseDepth = (p.gadgetSprite ? p.gadgetSprite.depth : 4);

            const swirls = [];
            for (let i = 1; i <= 6; i++) {
                const key = `fx_${p._gadgetName}_swirl${i}`;
                if (!scene.textures.exists(key)) { swirls.push(null); continue; }
                const img = scene.textures.get(key).getSourceImage();
                const w = img.width  * scale;
                const h = img.height * scale;
                // origin 0.5 → centre placed so the top-left sits at the body's top-left
                const s = scene.add.image(bodyLeft + w / 2, bodyTop + h / 2, key)
                    .setDepth(baseDepth + 0.05 + i * 0.001)
                    .setAlpha(0);
                s.setDisplaySize(w, h);
                swirls.push(s);
            }
            // swirl1 is the initial contents, visible from the start.
            if (swirls[0]) swirls[0].setAlpha(1);

            // One infinite spin shared by every swirl: a single tween over all of them
            // guarantees they rotate in lock-step, so cross-fading never reveals a speed
            // mismatch. We throttle its timeScale from ~0 up to maxRpm as charge fills.
            // At timeScale 1 the tween turns once per baseRevMs (= 60 rpm).
            const baseRevMs = 1000;
            const spinnable = swirls.filter(Boolean);
            const spin = spinnable.length ? scene.tweens.add({
                targets: spinnable, angle: '+=360',
                duration: baseRevMs, repeat: -1, ease: 'Linear'
            }) : null;
            if (spin) spin.timeScale = 0;

            p._fx.blenderSwirls   = swirls;
            p._fx.blenderSpin     = spin;
            p._fx.blenderSpeedTween = null;
            p._fx.blenderMinRpm   = params.minRpm  ?? 18;    // small starting crawl
            p._fx.blenderMaxRpm   = params.maxRpm  ?? 900;   // full-blast top speed
            p._fx.blenderRampExp  = params.rampExp ?? 2.0;   // >1 = slow early, ramps later
            p._fx.blenderSmoothMs = params.speedSmoothMs ?? 1000; // glide-to-target time
            p._fx.blenderBaseRpm  = 60000 / baseRevMs;       // rpm at timeScale 1
        },

        onProgress(scene, p, progress, params) {
            if (!p._fx) return;
            const swirls = p._fx.blenderSwirls;
            const mark = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t    = Math.min(progress / mark, 1);   // 0 → 1 by the mark, then held

            // ── Switch the contents ──────────────────────────────────────────────
            // Show exactly one swirl for the current 1/6 division, switching instantly
            // at each 1/6 boundary (swirl1 in [0,1/6), … swirl6 in [5/6,1]).
            if (swirls) {
                const n = swirls.length;                 // 6
                const active = Math.min(n - 1, Math.floor(t * n));
                for (let i = 0; i < n; i++) {
                    if (!swirls[i]) continue;
                    swirls[i].setAlpha(i === active ? 1 : 0);
                }
            }

            // ── Spin speed ───────────────────────────────────────────────────────
            // Ease the curve (t^rampExp) so the blade keeps accelerating across the
            // whole fill, then glide the spin's timeScale toward the new target
            // (MoveTowards-style) instead of snapping when charge arrives in steps.
            const spin = p._fx.blenderSpin;
            if (!spin) return;
            // Hold still until `spinStart` of charge, then remap so the spin begins at
            // 0 right at that threshold and scales to 1 at full charge.
            const start  = params.spinStart ?? 0.1;
            const tt     = start >= 1 ? 0 : Math.max(0, (t - start) / (1 - start));
            const eased  = Math.pow(tt, p._fx.blenderRampExp);
            const rpm    = p._fx.blenderMinRpm + (p._fx.blenderMaxRpm - p._fx.blenderMinRpm) * eased;
            const target = rpm / p._fx.blenderBaseRpm;

            if (p._fx.blenderSpeedTween) p._fx.blenderSpeedTween.remove();
            p._fx.blenderSpeedTween = scene.tweens.add({
                targets: spin, timeScale: target,
                duration: p._fx.blenderSmoothMs, ease: 'Linear'
            });
        },

        onOvercharge() { /* keep blending until the explosion/cleanup tears it down */ },

        cleanup(scene, p) {
            if (!p._fx) return;
            if (p._fx.blenderSpeedTween) { p._fx.blenderSpeedTween.remove(); p._fx.blenderSpeedTween = null; }
            if (p._fx.blenderSpin) { p._fx.blenderSpin.remove(); p._fx.blenderSpin = null; }
            if (p._fx.blenderSwirls) {
                p._fx.blenderSwirls.forEach(s => {
                    if (!s) return;
                    scene.tweens.killTweensOf(s);
                    s.destroy();
                });
                p._fx.blenderSwirls = null;
            }
        }
    },

    // ── WASHER ──────────────────────────────────────────────────────────────
    // A washing machine whose base sprite (washing_machine.png) shows the body,
    // with two "swirl" images (swirl0, swirl1) — the rotating drum — pinned on top
    // at a fixed offset from the body's top-left. swirl0 shows below half speed,
    // swirl1 takes over once the spin passes 50% of its top speed. They share one
    // spin tween (so swapping never reveals a speed mismatch) that accelerates from
    // stationary to full speed as charge fills.
    washer: {
        assets(params) {
            return {
                swirl0: (params.swirls && params.swirls[0]) || `washing_machine/swirl0.png`,
                swirl1: (params.swirls && params.swirls[1]) || `washing_machine/swirl1.png`
            };
        },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const bodyKey = `gadget_${p._gadgetName}_normal`;
            if (!scene.textures.exists(bodyKey)) return;

            // Match the scale the body sprite was drawn at, so the swirls keep their
            // real proportions relative to the body.
            const bodyImg = scene.textures.get(bodyKey).getSourceImage();
            const scale   = p._gadgetDisplayWidth / bodyImg.width;

            // Body's top-left in world space (body is centred on the origin). Each
            // swirl is pinned at `offset` (body-native px, scaled to match) from the
            // top-left, while still rotating about its own centre.
            const bodyLeft = p._gadgetOriginX - p._gadgetDisplayWidth  / 2;
            const bodyTop  = p._gadgetOriginY - p._gadgetDisplayHeight / 2;
            const baseDepth = (p.gadgetSprite ? p.gadgetSprite.depth : 4);

            const off = params.offset || { x: 35, y: 77 };
            const ox  = (off.x || 0) * scale;
            const oy  = (off.y || 0) * scale;

            const swirls = [];
            for (let i = 0; i < 2; i++) {
                const key = `fx_${p._gadgetName}_swirl${i}`;
                if (!scene.textures.exists(key)) { swirls.push(null); continue; }
                const img = scene.textures.get(key).getSourceImage();
                const w = img.width  * scale;
                const h = img.height * scale;
                // origin 0.5 → centre placed so the top-left sits at body top-left + offset
                const s = scene.add.image(bodyLeft + ox + w / 2, bodyTop + oy + h / 2, key)
                    .setDepth(baseDepth + 0.05 + i * 0.001)
                    .setAlpha(0);
                s.setDisplaySize(w, h);
                swirls.push(s);
            }
            // swirl0 is the initial (stationary) drum, visible from the start.
            if (swirls[0]) swirls[0].setAlpha(1);

            // One infinite spin shared by both swirls so swapping never reveals a
            // speed mismatch. timeScale throttled from 0 up to maxRpm as charge fills.
            // At timeScale 1 the tween turns once per baseRevMs (= 60 rpm).
            const baseRevMs = 1000;
            const spinnable = swirls.filter(Boolean);
            const spin = spinnable.length ? scene.tweens.add({
                targets: spinnable, angle: '+=360',
                duration: baseRevMs, repeat: -1, ease: 'Linear'
            }) : null;
            if (spin) spin.timeScale = 0;

            p._fx.washerSwirls    = swirls;
            p._fx.washerSpin      = spin;
            p._fx.washerSpeedTween = null;
            p._fx.washerMinRpm    = params.minRpm  ?? 0;     // starts stationary
            p._fx.washerMaxRpm    = params.maxRpm  ?? 400;   // full-spin top speed
            p._fx.washerRampExp   = params.rampExp ?? 2.0;   // >1 = slow early, ramps later
            p._fx.washerSmoothMs  = params.speedSmoothMs ?? 1000; // glide-to-target time
            p._fx.washerBaseRpm   = 60000 / baseRevMs;       // rpm at timeScale 1
        },

        onProgress(scene, p, progress, params) {
            if (!p._fx) return;
            const mark = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t    = Math.min(progress / mark, 1);   // 0 → 1 by the mark, then held

            // Spin speed: ease the curve (t^rampExp) so it keeps accelerating across
            // the whole fill, then glide timeScale toward the target (MoveTowards-style)
            // instead of snapping when charge arrives in steps.
            const spin = p._fx.washerSpin;
            if (!spin) return;
            // Hold still until `spinStart` of charge, then remap so the spin begins at
            // 0 right at that threshold and scales to 1 at full charge.
            const start  = params.spinStart ?? 0.1;
            const tt     = start >= 1 ? 0 : Math.max(0, (t - start) / (1 - start));
            const eased  = Math.pow(tt, p._fx.washerRampExp);
            const rpm    = p._fx.washerMinRpm + (p._fx.washerMaxRpm - p._fx.washerMinRpm) * eased;
            const target = rpm / p._fx.washerBaseRpm;

            // Swap the drum image once the spin passes 50% of its top speed:
            // swirl0 below half speed, swirl1 at/above it.
            const swirls = p._fx.washerSwirls;
            if (swirls) {
                const active = eased >= 0.5 ? 1 : 0;
                for (let i = 0; i < swirls.length; i++) {
                    if (swirls[i]) swirls[i].setAlpha(i === active ? 1 : 0);
                }
            }

            if (p._fx.washerSpeedTween) p._fx.washerSpeedTween.remove();
            p._fx.washerSpeedTween = scene.tweens.add({
                targets: spin, timeScale: target,
                duration: p._fx.washerSmoothMs, ease: 'Linear'
            });
        },

        onOvercharge() { /* keep spinning until the explosion/cleanup tears it down */ },

        cleanup(scene, p) {
            if (!p._fx) return;
            if (p._fx.washerSpeedTween) { p._fx.washerSpeedTween.remove(); p._fx.washerSpeedTween = null; }
            if (p._fx.washerSpin) { p._fx.washerSpin.remove(); p._fx.washerSpin = null; }
            if (p._fx.washerSwirls) {
                p._fx.washerSwirls.forEach(s => {
                    if (!s) return;
                    scene.tweens.killTweensOf(s);
                    s.destroy();
                });
                p._fx.washerSwirls = null;
            }
        }
    },

    // ── RECORD PLAYER ─────────────────────────────────────────────────────────
    // A reel-to-reel player: record_player.png is the body; on top sit two reels,
    // each a tape disc made of a "tape" image (lower) and a "disc" image (upper),
    // pinned at fixed offsets from the body's top-left. Layer order top→bottom is
    // disc, tape, body.
    //
    // While charging, both discs spin up from 0 to a small CONSTANT speed and hold
    // it (not proportional to charge). The reels mimic tape transferring left→right:
    // tape1 starts full (scale 1) and shrinks to ~0.1, while tape2 grows from ~0.1
    // to full, linearly with charge.
    record_player: {
        assets(params) {
            return {
                disc: (params.disc || `record_player/disc.png`),
                tape: (params.tape || `record_player/tape.png`)
            };
        },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const bodyKey = `gadget_${p._gadgetName}_normal`;
            const discKey = `fx_${p._gadgetName}_disc`;
            const tapeKey = `fx_${p._gadgetName}_tape`;
            if (!scene.textures.exists(bodyKey)) return;

            // Match the scale the body was drawn at, so layers keep their proportions.
            const bodyImg = scene.textures.get(bodyKey).getSourceImage();
            const scale   = p._gadgetDisplayWidth / bodyImg.width;

            const bodyLeft = p._gadgetOriginX - p._gadgetDisplayWidth  / 2;
            const bodyTop  = p._gadgetOriginY - p._gadgetDisplayHeight / 2;
            const baseDepth = (p.gadgetSprite ? p.gadgetSprite.depth : 4);

            // Place a centered-origin sprite so its top-left lands at body top-left +
            // offset (offset & size in body-native px, scaled to display). Returns the
            // sprite plus its full (scale-1) display size for later reel scaling.
            const place = (key, depth, size, off) => {
                if (!scene.textures.exists(key)) return null;
                const w  = size.w * scale;
                const h  = size.h * scale;
                const ox = (off.x || 0) * scale;
                const oy = (off.y || 0) * scale;
                const s = scene.add.image(bodyLeft + ox + w / 2, bodyTop + oy + h / 2, key)
                    .setDepth(depth);
                s.setDisplaySize(w, h);
                s._baseW = w; s._baseH = h;   // full size, for reel scale animation
                return s;
            };

            const discSize = params.discSize || { w: 110, h: 110 };
            const tapeSize = params.tapeSize || { w: 78,  h: 78  };
            const off = params.offsets || {
                disc1: { x: 6.5, y: 11 }, disc2: { x: 136, y: 11 },
                tape1: { x: 22.5, y: 27 }, tape2: { x: 152, y: 27 }
            };

            // Layer order top→bottom: disc (top), tape, body (bottom).
            const tape1 = place(tapeKey, baseDepth + 0.05, tapeSize, off.tape1);
            const tape2 = place(tapeKey, baseDepth + 0.05, tapeSize, off.tape2);
            const disc1 = place(discKey, baseDepth + 0.10, discSize, off.disc1);
            const disc2 = place(discKey, baseDepth + 0.10, discSize, off.disc2);

            // Punch a circular hole in each reel: a geometry mask with inverted alpha
            // hides the tape INSIDE the circle. Centre & radius are in body-native px
            // relative to the body's top-left, scaled by the same factor as the body
            // so the holes stay aligned with the (also-scaled) reels at any slot size.
            const maskCfg = params.tapeMask || {
                left:  { x: 61,  y: 65 },
                right: { x: 191, y: 65 },
                radius: 15
            };
            const maskGfx = [];
            const applyHole = (sprite, c) => {
                if (!sprite || !c) return;
                const g = scene.add.graphics();
                g.fillStyle(0xffffff);
                g.fillCircle(bodyLeft + c.x * scale, bodyTop + c.y * scale, (maskCfg.radius || 15) * scale);
                g.setVisible(false);
                const mask = g.createGeometryMask();
                mask.invertAlpha = true;   // visible OUTSIDE the circle → hole inside
                sprite.setMask(mask);
                maskGfx.push(g);
            };
            applyHole(tape1, maskCfg.left);
            applyHole(tape2, maskCfg.right);
            p._fx.rpMaskGfx = maskGfx;

            // DEBUG: red 50%-alpha circles marking where the mask holes are.
            // Toggle with `debugMask: true` in charge_effect_params.
            if (params.debugMask) {
                const dbg = scene.add.graphics().setDepth(baseDepth + 1);
                dbg.fillStyle(0xff0000, 0.5);
                [maskCfg.left, maskCfg.right].forEach(c => {
                    if (c) dbg.fillCircle(bodyLeft + c.x * scale, bodyTop + c.y * scale, (maskCfg.radius || 15) * scale);
                });
                p._fx.rpDebugGfx = dbg;
            }

            // Reels start at tape1 = full, tape2 = min, then cross-fade in size.
            const minScale = params.tapeMinScale ?? 0.1;
            const maxScale = params.tapeMaxScale ?? 1.0;
            const setReel = (s, f) => { if (s) s.setDisplaySize(s._baseW * f, s._baseH * f); };
            setReel(tape1, maxScale);
            setReel(tape2, minScale);

            // Infinite spin for the discs — both turn anticlockwise. Separate tweens,
            // but their timeScale is driven together in onProgress so they stay in
            // lock-step. timeScale 0 at rest; first onProgress glides it up to the
            // constant small speed. At timeScale 1 = 60 rpm.
            const baseRevMs = 1000;
            const mkSpin = (disc, dir) => disc ? scene.tweens.add({
                targets: disc, angle: `${dir}=360`,
                duration: baseRevMs, repeat: -1, ease: 'Linear'
            }) : null;
            const spinL = mkSpin(disc1, '-');   // left disc: anticlockwise
            const spinR = mkSpin(disc2, '-');   // right disc: anticlockwise
            const spins = [spinL, spinR].filter(Boolean);
            spins.forEach(s => s.timeScale = 0);

            p._fx.rpTape1     = tape1;
            p._fx.rpTape2     = tape2;
            p._fx.rpDiscs     = [disc1, disc2].filter(Boolean);
            p._fx.rpSpins     = spins;
            p._fx.rpSpeedTween = null;
            p._fx.rpDiscRpm   = params.discRpm ?? 45;   // small constant spin speed
            p._fx.rpMinScale  = minScale;
            p._fx.rpMaxScale  = maxScale;
            p._fx.rpSmoothMs  = params.speedSmoothMs ?? 800;
            p._fx.rpBaseRpm   = 60000 / baseRevMs;
        },

        onProgress(scene, p, progress, params) {
            if (!p._fx) return;
            const mark = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t    = Math.min(progress / mark, 1);   // 0 → 1 by the mark, then held

            // Reels: tape1 full→min, tape2 min→full, linearly with charge. Glide the
            // display size toward the target (instead of snapping every charge tick)
            // so big per-tick charge steps on low-capacity levels still look gradual.
            const min = p._fx.rpMinScale, max = p._fx.rpMaxScale;
            const f1 = max + (min - max) * t;   // 1 → 0.1
            const f2 = min + (max - min) * t;   // 0.1 → 1
            const glideReel = (s, f, tweenKey) => {
                if (!s) return;
                if (p._fx[tweenKey]) p._fx[tweenKey].remove();
                p._fx[tweenKey] = scene.tweens.add({
                    targets: s,
                    displayWidth:  s._baseW * f,
                    displayHeight: s._baseH * f,
                    duration: p._fx.rpSmoothMs, ease: 'Linear'
                });
            };
            glideReel(p._fx.rpTape1, f1, 'rpTapeTween1');
            glideReel(p._fx.rpTape2, f2, 'rpTapeTween2');

            // Discs: glide up to a small constant speed once charging starts, then hold.
            const spins = p._fx.rpSpins;
            if (!spins || !spins.length) return;
            const target = (progress > 0 ? p._fx.rpDiscRpm : 0) / p._fx.rpBaseRpm;
            if (p._fx.rpSpeedTween) p._fx.rpSpeedTween.remove();
            p._fx.rpSpeedTween = scene.tweens.add({
                targets: spins, timeScale: target,
                duration: p._fx.rpSmoothMs, ease: 'Linear'
            });
        },

        onOvercharge() { /* keep spinning until the explosion/cleanup tears it down */ },

        cleanup(scene, p) {
            if (!p._fx) return;
            if (p._fx.rpSpeedTween) { p._fx.rpSpeedTween.remove(); p._fx.rpSpeedTween = null; }
            if (p._fx.rpTapeTween1) { p._fx.rpTapeTween1.remove(); p._fx.rpTapeTween1 = null; }
            if (p._fx.rpTapeTween2) { p._fx.rpTapeTween2.remove(); p._fx.rpTapeTween2 = null; }
            if (p._fx.rpSpins) { p._fx.rpSpins.forEach(s => s && s.remove()); p._fx.rpSpins = null; }
            [p._fx.rpTape1, p._fx.rpTape2, ...(p._fx.rpDiscs || [])].forEach(s => {
                if (!s) return;
                scene.tweens.killTweensOf(s);
                if (s.clearMask) s.clearMask(true);   // destroys the geometry mask too
                s.destroy();
            });
            if (p._fx.rpMaskGfx) { p._fx.rpMaskGfx.forEach(g => g && g.destroy()); p._fx.rpMaskGfx = null; }
            if (p._fx.rpDebugGfx) { p._fx.rpDebugGfx.destroy(); p._fx.rpDebugGfx = null; }
            p._fx.rpTape1 = p._fx.rpTape2 = null;
            p._fx.rpDiscs = null;
        }
    },

    // ── RECIPROCATING SAW ─────────────────────────────────────────────────────
    // handle.png is the base gadget (sized to the LEFT HALF of the max-area rect);
    // blade.png is layered BEHIND the handle at offset (100,27) from the handle's
    // top-left (handle-native px, scaled with the handle) so the blade's shank
    // disappears into the housing. The blade rests at its spawn x until charging
    // begins, then reciprocates: sliding right to `extendX` (max extension) and back
    // to `retractX` (retracted into the handle), with the stroke speed ramping from
    // `minSpm` up to `maxSpm` strokes/min as charge fills.
    reciprocating_saw: {
        assets(params) {
            return { blade: (params.blade || 'reciprocating_saw/blade.png') };
        },

        init(scene, p, params) {
            p._fx = p._fx || {};

            const bodyKey  = `gadget_${p._gadgetName}_normal`;
            const bladeKey = `fx_${p._gadgetName}_blade`;
            if (!scene.textures.exists(bodyKey) || !scene.textures.exists(bladeKey)) return;

            // Match the scale the handle was drawn at, so the blade & its offset keep
            // their real proportions relative to the handle.
            const bodyImg = scene.textures.get(bodyKey).getSourceImage();
            const scale   = p._gadgetDisplayWidth / bodyImg.width;

            // Handle's top-left in world space (handle is centred on the origin).
            const bodyLeft = p._gadgetOriginX - p._gadgetDisplayWidth  / 2;
            const bodyTop  = p._gadgetOriginY - p._gadgetDisplayHeight / 2;
            const baseDepth = (p.gadgetSprite ? p.gadgetSprite.depth : 4);

            const off  = params.offset || { x: 100, y: 27 };
            const outX = params.extendX  ?? 112;   // max extension (blade slides right)
            const inX  = params.retractX ?? 90;     // retracted into handle (slides left)

            // Blade drawn BEHIND the handle so its shank is hidden inside the housing
            // and only the protruding length shows. Origin 0,0 → x/y map straight to
            // the given handle-native-pixel offset.
            const bladeImg = scene.textures.get(bladeKey).getSourceImage();
            const blade = scene.add.image(bodyLeft + off.x * scale, bodyTop + off.y * scale, bladeKey)
                .setOrigin(0, 0)
                .setDepth(baseDepth - 0.05);
            blade.setDisplaySize(bladeImg.width * scale, bladeImg.height * scale);

            // Fade the blade in alongside the handle's pop-in so it doesn't flash at
            // full size while the handle is still growing.
            const idx = (scene.platforms ? scene.platforms.indexOf(p) : 0);
            blade.setAlpha(0);
            scene.tweens.add({
                targets: blade, alpha: 1, duration: 400,
                delay: Math.max(0, idx) * 150, ease: 'Sine.easeOut'
            });

            p._fx.sawBlade     = blade;
            p._fx.sawTween     = null;
            p._fx.sawSpeedTween = null;
            p._fx.sawInX       = bodyLeft + inX  * scale;
            p._fx.sawOutX      = bodyLeft + outX * scale;
            // One full stroke cycle (in→out→in) takes baseCycleMs at timeScale 1,
            // i.e. sawBaseSpm strokes/min; we throttle timeScale to hit the target spm.
            const baseCycleMs = 1000;
            p._fx.sawHalfMs    = baseCycleMs / 2;
            p._fx.sawBaseSpm   = 60000 / baseCycleMs;   // strokes/min at timeScale 1
            p._fx.sawMinSpm    = params.minSpm  ?? 120;  // just after charging begins
            p._fx.sawMaxSpm    = params.maxSpm  ?? 1400; // at full charge
            p._fx.sawRampExp   = params.rampExp ?? 2.0;  // >1 = slow early, ramps later
            p._fx.sawSmoothMs  = params.speedSmoothMs ?? 700; // glide-to-target time
        },

        onProgress(scene, p, progress, params) {
            if (!p._fx || !p._fx.sawBlade) return;
            const mark = CONFIG.PLATFORM.OPERATING_CAPACITY_MARK || 1;
            const t    = Math.min(progress / mark, 1);   // 0 → 1 by the mark, then held

            // Start the reciprocation lazily on the first charge tick so the blade
            // rests at its spawn position until charging actually begins.
            if (!p._fx.sawTween && progress > 0) {
                const blade = p._fx.sawBlade;
                p._fx.sawTween = scene.tweens.add({
                    targets: blade,
                    x: { from: p._fx.sawInX, to: p._fx.sawOutX },
                    duration: p._fx.sawHalfMs,
                    yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                });
                p._fx.sawTween.timeScale = 0;
            }
            const tween = p._fx.sawTween;
            if (!tween) return;

            // Hold still until `spinStart` of charge, then remap so the stroke begins
            // at 0 right at that threshold and scales to 1 at full charge. Ease the
            // curve (tt^rampExp) so it keeps accelerating across the whole fill, then
            // glide the timeScale toward the target (MoveTowards-style) instead of
            // snapping when charge arrives in discrete steps.
            const start  = params.spinStart ?? 0.05;
            const tt     = start >= 1 ? 0 : Math.max(0, (t - start) / (1 - start));
            const eased  = Math.pow(tt, p._fx.sawRampExp);
            const spm    = p._fx.sawMinSpm + (p._fx.sawMaxSpm - p._fx.sawMinSpm) * eased;
            const target = spm / p._fx.sawBaseSpm;

            if (p._fx.sawSpeedTween) p._fx.sawSpeedTween.remove();
            p._fx.sawSpeedTween = scene.tweens.add({
                targets: tween, timeScale: target,
                duration: p._fx.sawSmoothMs, ease: 'Linear'
            });
        },

        onOvercharge() { /* keep sawing until the explosion/cleanup tears it down */ },

        cleanup(scene, p) {
            if (!p._fx) return;
            if (p._fx.sawSpeedTween) { p._fx.sawSpeedTween.remove(); p._fx.sawSpeedTween = null; }
            if (p._fx.sawTween) { p._fx.sawTween.remove(); p._fx.sawTween = null; }
            if (p._fx.sawBlade) {
                scene.tweens.killTweensOf(p._fx.sawBlade);
                p._fx.sawBlade.destroy();
                p._fx.sawBlade = null;
            }
        }
    }
};

/**
 * Resolve an anchor (fractions of the gadget's display box) to world coords.
 * anchor.x/y are 0..1 from the sprite's top-left; default = sprite center (0.5,0.5).
 * The gadget sprite is centered at (_gadgetOriginX, _gadgetOriginY) with origin 0.5.
 */
function _fxAnchorPos(p, anchor) {
    const ax = anchor && anchor.x !== undefined ? anchor.x : 0.5;
    const ay = anchor && anchor.y !== undefined ? anchor.y : 0.5;
    return {
        x: p._gadgetOriginX + (ax - 0.5) * p._gadgetDisplayWidth,
        y: p._gadgetOriginY + (ay - 0.5) * p._gadgetDisplayHeight
    };
}

function getChargeEffect(type) {
    return CHARGE_EFFECTS[type] || CHARGE_EFFECTS.none;
}
