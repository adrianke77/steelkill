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

    // Infrared color mapping using lookup arrays for performance
    float average = (color.r + color.g + color.b) / 3.0;

    float thresholds[13];
    vec3 colors[13];

    thresholds[0] = 0.8;   colors[0] = vec3(0.8, 0.0, 0.0);   // Red
    thresholds[1] = 0.65;  colors[1] = vec3(0.6, 0.3, 0.0);   // Orange
    thresholds[2] = 0.55;  colors[2] = vec3(0.5, 0.5, 0.0);   // Yellow
    thresholds[3] = 0.40;  colors[3] = vec3(0.5, 0.7, 0.0);   // Yellow-Green
    thresholds[4] = 0.30;  colors[4] = vec3(0.0, 0.5, 0.0);   // Green
    thresholds[5] = 0.15;  colors[5] = vec3(0.0, 0.7, 0.5);   // Green-Blue
    thresholds[6] = 0.10;  colors[6] = vec3(0.0, 0.2, 1.0);   // Blue
    thresholds[7] = 0.07;  colors[7] = vec3(0.3, 0.0, 0.3);   // Purple-ish
    thresholds[8] = 0.5;   colors[8] = vec3(0.25, 0.0, 0.20);// Purple-ish
    thresholds[9] = 0.04;  colors[9] = vec3(0.2, 0.0, 0.17);   // Purple-ish
    thresholds[10] = 0.03; colors[10] = vec3(0.15, 0.0, 0.13);// Purple-ish
    thresholds[11] = 0.02; colors[11] = vec3(0.1, 0.0, 0.09);  // Purple-ish
    thresholds[12] = 0.01; colors[12] = vec3(0.05, 0.0, 0.05);// Purple

    vec3 finalColor = vec3(0.0); // Default to black

    for (int i = 0; i < 13; i++) {
        if (average > thresholds[i]) {
            finalColor = colors[i];
            break;
        }
    }

    vec4 infraredColor = vec4(finalColor, color.a);

    // Apply intensity and output the final color
    gl_FragColor = vec4(infraredColor.rgb * intensity, infraredColor.a);
}
`

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
    this.set2f('resolution', this.renderer.width, this.renderer.height)

    // If you wish to adjust 'intensity' at runtime, you can move it back to a uniform:
    // this.set1f('intensity', this.intensity);
  }
}
