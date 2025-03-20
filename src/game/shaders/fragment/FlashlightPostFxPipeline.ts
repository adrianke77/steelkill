import Phaser from 'phaser'

/**
 * A PostFX pipeline that renders a cone-shaped flashlight in front of the mech,
 * gradually reducing its brightening effect as the pixel's luminance approaches
 * the threshold, until there is no additional brightening at or above the threshold.
 */
export class FlashlightPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      name: 'FlashlightPostFxPipeline',
      game,
      renderTarget: true,
      fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler; 
      uniform vec2 resolution;
      uniform vec2 lightPosition;
      uniform float radius;
      uniform float coneAngle;
      uniform vec2 coneDirection;

      // Hardcoded brightness threshold
      float BRIGHTNESS_THRESHOLD = 0.5;

      varying vec2 outTexCoord;

      void main(void) {
        vec4 baseColor = texture2D(uMainSampler, outTexCoord);
        vec2 screenPos = outTexCoord * resolution;

        // Find the pixel's average luminance [0..1]
        float luminance = (baseColor.r + baseColor.g + baseColor.b) / 3.0;

        // Distance from the light center
        float dist = distance(screenPos, lightPosition);

        // Early out if fully outside the flashlight radius
        if (dist > radius) {
          gl_FragColor = baseColor;
          return;
        }

        // Unit vector from the light source to this pixel
        vec2 toPixel = normalize(screenPos - lightPosition);

        // Dot product to check how close we are to cone center
        float angleCos = dot(toPixel, coneDirection);
        float coneLimit = cos(coneAngle * 0.5);

        // If outside the cone, return unchanged
        if (angleCos < coneLimit) {
          gl_FragColor = baseColor;
          return;
        }

        // distFactor: near 1.0 at the light apex, 0.0 at the cone edge
        float distFactor = 1.0 - (dist / radius);

        // angleFactor: near 1.0 in the cone center, 0.0 at the boundary
        float angleFactor = (angleCos - coneLimit) / (1.0 - coneLimit);

        // Overall flashlight intensity [0..1]
        float intensity = clamp(angleFactor * distFactor, 0.0, 1.0);

        // Smooth fade-out factor for pixels near max brightness
        float fadeFactor = 1.0 - smoothstep(0.5, 0.95, luminance);

        // Calculate how far luminance is below the threshold, clamped to [0,1]
        float belowThreshold = clamp(BRIGHTNESS_THRESHOLD - luminance, 0.0, BRIGHTNESS_THRESHOLD);
        float thresholdFactor = belowThreshold / BRIGHTNESS_THRESHOLD;

        // Compute the final brightness factor 
        // No brightening at or above thresholdFactor=0
        float brightness = 1.0 + intensity * fadeFactor * 7.0 * thresholdFactor;

        vec3 finalColor = baseColor.rgb * brightness;
        gl_FragColor = vec4(finalColor, baseColor.a);
      }
      `,
    })
  }

  onPreRender() {
    // Update resolution every frame
    this.set2f('resolution', this.renderer.width, this.renderer.height)
  }

  setLightPosition(x: number, y: number) {
    this.set2f('lightPosition', x, y)
  }

  setRadius(r: number) {
    this.set1f('radius', r)
  }

  setConeAngle(angle: number) {
    this.set1f('coneAngle', angle)
  }

  setConeDirection(dx: number, dy: number) {
    this.set2f('coneDirection', dx, dy)
  }
}
