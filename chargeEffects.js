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
