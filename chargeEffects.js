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
