const frag = `
precision mediump float;

uniform sampler2D uMainSampler;
uniform vec2 resolution;

varying vec2 outTexCoord;

void main() {
    float intensity = 0.7; // Brightness/intensity adjustment variable inside shader

    vec4 color = texture2D(uMainSampler, outTexCoord);
    
    float average = (color.r + color.g + color.b) / 3.0;

    vec4 infraredColor = vec4(0.0, 0.0, 0.0, color.a);

    if (average > 0.875) {
        infraredColor = vec4(1.0, 0.0, 0.0, color.a); // Red
    } else if (average > 0.75) {
        infraredColor = vec4(1.0, 0.5, 0.0, color.a); // Orange
    } else if (average > 0.625) {
        infraredColor = vec4(1.0, 1.0, 0.0, color.a); // Yellow
    } else if (average > 0.5) {
        infraredColor = vec4(0.5, 1.0, 0.0, color.a); // Yellow-Green
    } else if (average > 0.375) {
        infraredColor = vec4(0.0, 1.0, 0.0, color.a); // Green
    } else if (average > 0.25) {
        infraredColor = vec4(0.0, 1.0, 0.5, color.a); // Green-Blue
    } else if (average > 0.125) {
        infraredColor = vec4(0.0, 0.2, 1.0, color.a); // Blue
    } else {
        infraredColor = vec4(0.0, 0.0, 0.0, color.a); // Black
    }

    // Adjust the brightness/intensity using the intensity variable
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
}
