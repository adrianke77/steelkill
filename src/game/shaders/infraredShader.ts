const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;

varying vec2 outTexCoord;

void main() {
    float intensity = 0.8;    // Brightness/intensity adjustment variable inside shader
    float blurAmount = 0.4;   // Blurriness control variable inside the shader

    vec2 texCoord = outTexCoord;
    vec4 color = vec4(0.0);

    // Calculate the blur radius in texture coordinates
    float blurRadius = blurAmount / resolution.x;

    // Number of samples in each direction (adjust for performance)
    const int samples = 2; // Declared as a const

    // Total number of samples (for averaging)
    const int totalSamples = (samples * 2 + 1) * (samples * 2 + 1);

    // Loop over neighboring pixels
    for (int x = -samples; x <= samples; x++) {
        for (int y = -samples; y <= samples; y++) {
            vec2 offset = vec2(float(x), float(y)) * blurRadius;
            vec4 sampleColor = texture2D(uMainSampler, texCoord + offset);
            color += sampleColor;
        }
    }

    // Average the sampled colors
    color /= float(totalSamples);

    // Infrared color mapping as before
    float average = (color.r + color.g + color.b) / 3.0;

    vec4 infraredColor = vec4(0.0, 0.0, 0.0, color.a);

    if (average > 0.9) {
        infraredColor = vec4(0.8, 0.0, 0.0, color.a); // Red
    } else if (average > 0.65) {
        infraredColor = vec4(0.6, 0.3, 0.0, color.a); // Orange
    } else if (average > 0.55) {
        infraredColor = vec4(0.5, 0.5, 0.0, color.a); // Yellow
    } else if (average > 0.40) {
        infraredColor = vec4(0.5, 0.7, 0.0, color.a); // Yellow-Green
    } else if (average > 0.35) {
        infraredColor = vec4(0.0, 0.5, 0.0, color.a); // Green
    } else if (average > 0.20) {
        infraredColor = vec4(0.0, 0.7, 0.5, color.a); // Green-Blue
    } else if (average > 0.125) {
        infraredColor = vec4(0.0, 0.2, 1.0, color.a); // Blue
    } else {
        infraredColor = vec4(0.0, 0.0, 0.0, color.a); // Black
    }

    // Apply intensity and output the final color
    gl_FragColor = vec4(infraredColor.rgb * intensity, infraredColor.a);
}
`;

export class InfraredPostFxPipeline extends Phaser.Renderer.WebGL.Pipelines
  .PostFXPipeline {
  time: number

  constructor(game: Phaser.Game) {
    super({
      game,
      fragShader: frag,
    })
  }

  onPreRender() {
    // Pass the resolution to the shader
    this.set2f('resolution', this.renderer.width, this.renderer.height);

    // If you wish to adjust 'intensity' at runtime, you can move it back to a uniform:
    // this.set1f('intensity', this.intensity);
  }
}
