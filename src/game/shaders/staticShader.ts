const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime;
uniform float uIntensity; // New uniform for intensity
varying vec2 outTexCoord;

// Function to generate random noise
float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = outTexCoord;

    // Fetch the texture color
    vec4 color = texture2D(uMainSampler, uv);

    // Generate random static noise based on the UV coordinates and time
    float noise = random(uv * uTime);

    // Use the uIntensity uniform to control the intensity of the static
    color.rgb = mix(color.rgb, vec3(noise), uIntensity);

    gl_FragColor = color;
}

`

export class StaticPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  staticIntensity: number

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader: frag,
    })
    this.staticIntensity = 0.05
  }

  setStaticIntensity(intensity: number): void {
    this.staticIntensity = intensity
  }

  onPreRender() {
    this.set1f('uTime', this.game.loop.time / 1000)
    this.set1f('uIntensity', this.staticIntensity)
  }
}
