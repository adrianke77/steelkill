const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform float uTime; // Use this uniform to animate the scanlines
varying vec2 outTexCoord;

void main() {
    vec2 uv = outTexCoord;

    // Fetch the texture color 
    vec4 color = texture2D(uMainSampler, uv);

    // Adjust the frequency and amplitude of the scanline effect
    float frequency = 800.0;  // Adjust this value to change the frequency of the scanlines
    float amplitude = 0.010;   // Adjust this value to change the intensity of the scanlines

    // Add animated scanline effect
    float scanline = sin((uv.y + uTime) * frequency) * amplitude;
    color.rgb -= scanline;

    gl_FragColor = color;
}

`

export class ScanlinesPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  time: number

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader: frag,
    })
  }

  onPreRender(): void {
    // slowly moving scanlines
    this.set1f('uTime', this.game.loop.time / 40000)
  }
}
