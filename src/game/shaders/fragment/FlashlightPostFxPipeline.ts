import Phaser from 'phaser'

/**
 * A PostFX pipeline that renders a cone-shaped flashlight in front of the mech,
 * brightening pixels most strongly near the flashlight's apex and weakest at the edge.
 *
 * This version uses a smoother fade-out for pixels already lit or near max brightness,
 * preventing them from becoming overly bright.
 */
export class FlashlightPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
  constructor(game: Phaser.Game) {
    super({
      name: 'FlashlightPostFxPipeline',
      game: game,
      renderTarget: true,
      fragShader: `
      precision mediump float;

      uniform sampler2D uMainSampler; 
      uniform vec2 resolution;
      uniform vec2 lightPosition;    
      uniform float radius;          
      uniform float coneAngle;       
      uniform vec2 coneDirection;    

      varying vec2 outTexCoord;

      void main(void) {
        vec4 baseColor = texture2D(uMainSampler, outTexCoord);
        vec2 screenPos = outTexCoord * resolution;

        // Distance from the light center
        float dist = distance(screenPos, lightPosition);

        // Early out if fully outside the flashlight radius
        if (dist > radius) {
          gl_FragColor = baseColor;
          return;
        }

        // Unit vector pointing from the light source to this pixel
        vec2 toPixel = normalize(screenPos - lightPosition);

        // Dot product to check how close we are to cone center
        float angleCos = dot(toPixel, coneDirection);
        float coneLimit = cos(coneAngle * 0.5);

        // If outside the cone, return base color
        if (angleCos < coneLimit) {
          gl_FragColor = baseColor;
          return;
        }

        // distFactor: near 1.0 at the light apex, 0.0 at the cone edge
        float distFactor = 1.0 - (dist / radius);

        // angleFactor: near 1.0 in the cone center, 0.0 at the cone boundary
        float angleFactor = (angleCos - coneLimit) / (1.0 - coneLimit);

        // Overall flashlight intensity from 0..1
        float intensity = clamp(angleFactor * distFactor, 0.0, 1.0);

        // Compute luminance for the current pixel
        float luminance = (baseColor.r + baseColor.g + baseColor.b) / 3.0;

        // Smooth fade-out factor for pixels near max brightness
        // Range is (0.7 to 1.0) so that bright pixels are less affected
        float fadeFactor = 1.0 - smoothstep(0.5,0.95, luminance);

        // Compute the final brightness factor
        // Scale by both the flashlight intensity and how dark the pixel is
        float brightness = 1.0 + intensity * fadeFactor * 5.0;

        // Multiply the base color to brighten, with smooth fade-out
        vec3 finalColor = baseColor.rgb * brightness;

        gl_FragColor = vec4(finalColor, baseColor.a);
      }
      `
    });
  }

  onPreRender() {
    // Update resolution every frame
    this.set2f('resolution', this.renderer.width, this.renderer.height);
  }

  setLightPosition(x: number, y: number) {
    this.set2f('lightPosition', x, y);
  }

  setRadius(r: number) {
    this.set1f('radius', r);
  }

  setConeAngle(angle: number) {
    this.set1f('coneAngle', angle);
  }

  setConeDirection(dx: number, dy: number) {
    this.set2f('coneDirection', dx, dy);
  }
}
